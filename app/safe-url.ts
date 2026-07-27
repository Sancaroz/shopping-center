const MAX_STOREFRONT_URL_LENGTH = 2_000;
const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;
const SAFE_HASH = /^#[A-Za-z][A-Za-z0-9_-]*$/;

function isSafeHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isSafeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  try {
    const parsed = new URL(value, "https://store.invalid");
    return parsed.origin === "https://store.invalid";
  } catch {
    return false;
  }
}

export function isSafeStorefrontUrl(value: string, options: { allowEmpty?: boolean; allowHash?: boolean; allowInternal?: boolean } = {}) {
  const { allowEmpty = true, allowHash = true, allowInternal = true } = options;
  if (!value) return allowEmpty;
  if (value.length > MAX_STOREFRONT_URL_LENGTH || CONTROL_OR_BACKSLASH.test(value) || value.trim() !== value) return false;
  if (allowHash && SAFE_HASH.test(value)) return true;
  if (allowInternal && isSafeInternalPath(value)) return true;
  return isSafeHttpsUrl(value);
}

export function isSafeImageUrl(value: string, allowEmpty = true) {
  return isSafeStorefrontUrl(value, { allowEmpty, allowHash: false, allowInternal: true });
}

export function isSafeExternalUrl(value: string, allowEmpty = true) {
  return isSafeStorefrontUrl(value, { allowEmpty, allowHash: false, allowInternal: false });
}
