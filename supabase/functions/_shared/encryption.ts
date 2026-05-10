// AES-GCM encryption for provider API keys.
// Master key is base64-encoded 32 raw bytes in PROVIDER_KEY_ENCRYPTION_SECRET.
// Generate one: `openssl rand -base64 32`.
//
// Output format: <iv_b64>:<ciphertext_b64> — both standard base64.

const SECRET_B64 = Deno.env.get("PROVIDER_KEY_ENCRYPTION_SECRET");

const importKey = async (): Promise<CryptoKey> => {
  if (!SECRET_B64) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET not set");
  }
  const raw = Uint8Array.from(atob(SECRET_B64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET must decode to 32 bytes");
  }
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

const toB64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const fromB64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const encryptSecret = async (plaintext: string): Promise<string> => {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc),
  );
  return `${toB64(iv)}:${toB64(ct)}`;
};

export const decryptSecret = async (payload: string): Promise<string> => {
  const [ivB64, ctB64] = payload.split(":");
  if (!ivB64 || !ctB64) throw new Error("Malformed ciphertext");
  const key = await importKey();
  const iv = fromB64(ivB64);
  const ct = fromB64(ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
};
