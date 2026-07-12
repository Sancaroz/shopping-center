import { requireChatGPTUser } from "../chatgpt-auth";
import AdminPanel from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  return <AdminPanel userName={user.displayName} />;
}
