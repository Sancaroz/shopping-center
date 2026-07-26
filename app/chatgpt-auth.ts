import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminUsers } from "../db/schema";

export type ChatGPTUser = {
  adminId: number;
  displayName: string;
  email: string;
  fullName: string | null;
  role: "owner" | "admin";
};

export type AuthenticatedChatGPTUser = Omit<ChatGPTUser, "adminId" | "role">;

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getAuthenticatedChatGPTUser(): Promise<AuthenticatedChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

async function authorizeChatGPTUser(user: AuthenticatedChatGPTUser): Promise<ChatGPTUser | null> {
  const db = getDb();
  let [member] = await db.select().from(adminUsers).where(eq(adminUsers.email, user.email)).limit(1);

  if (!member) {
    const [existingMember] = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
    if (!existingMember) {
      // Private preview access limits bootstrap to the first authenticated operator.
      [member] = await db.insert(adminUsers).values({
        email: user.email,
        displayName: user.displayName,
        role: "owner",
        active: true,
        createdBy: "private-site-bootstrap",
      }).onConflictDoNothing({ target: adminUsers.email }).returning();
      if (!member) [member] = await db.select().from(adminUsers).where(eq(adminUsers.email, user.email)).limit(1);
    }
  }

  if (!member?.active) return null;
  return {
    ...user,
    adminId: member.id,
    displayName: member.displayName.trim() || user.displayName,
    role: member.role === "owner" ? "owner" : "admin",
  };
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const user = await getAuthenticatedChatGPTUser();
  return user ? authorizeChatGPTUser(user) : null;
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const authenticatedUser = await getAuthenticatedChatGPTUser();
  if (!authenticatedUser) redirect(chatGPTSignInPath(returnTo));

  const user = await authorizeChatGPTUser(authenticatedUser);
  if (user) return user;

  redirect("/admin/erisim-yok");
}

export async function requireOwner(returnTo: string): Promise<ChatGPTUser> {
  const user = await requireChatGPTUser(returnTo);
  if (user.role === "owner") return user;
  redirect("/admin/erisim-yok?reason=owner");
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
