const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function readBoundedJson(request: Request, maxBytes = 20_000) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return { error: Response.json({ error: "İstek boyutu sınırı aşıldı." }, { status: 413, headers: { "Cache-Control": "no-store" } }) };
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return { error: Response.json({ error: "İstek boyutu sınırı aşıldı." }, { status: 413, headers: { "Cache-Control": "no-store" } }) };
  try {
    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
    return { body: body as Record<string, unknown> };
  } catch {
    return { error: Response.json({ error: "Geçersiz istek." }, { status: 400, headers: { "Cache-Control": "no-store" } }) };
  }
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

export function isValidEmail(value: string) {
  if (!EMAIL_PATTERN.test(value) || value.length > 180) return false;
  const [local, domain] = value.split("@");
  return Boolean(local && local.length <= 64 && domain && domain.length <= 253 && !domain.startsWith(".") && !domain.endsWith(".") && !domain.includes(".."));
}

function passesLuhn(digits: string) {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function containsLikelyCardNumber(value: string) {
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return candidates.some(candidate => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
  });
}

export function isValidPublicToken(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isValidRequestKey(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

export function isValidOrderNumber(value: string) {
  return /^MS-\d{8}-[A-Z0-9]{6}$/.test(value);
}
