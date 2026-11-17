// Pure rules for the worker gateway. No Deno and no network calls in this file, so the test suite can import it.
// The gateway builds every storage path itself, from the job's owner, trainer and job ids. A worker never sends a path.

/** A job generating with no progress for this long is failed as "worker stopped". Enforced in the claim SQL too. */
export const STALE_MINUTES = 45;
/** Signed download links last at most this long. The worker asks again when it needs one. */
export const LINK_TTL_SECONDS = 3600;
export const MAX_PROGRESS_CHARS = 200;
export const MAX_FAIL_CHARS = 300;
export const MAX_NAMES_PER_REQUEST = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A file name: letters, digits, dot, underscore, hyphen. No separators, no leading dot, 1 to 120 characters.
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/;
// A claim token: 32 random bytes, base64url without padding (43 characters).
const CLAIM_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const OPS = ["claim", "inputs", "links_download", "links_upload", "progress", "complete", "fail"] as const;
export type Op = (typeof OPS)[number];

export function isKnownOp(value: unknown): value is Op {
  return typeof value === "string" && (OPS as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isClaimToken(value: unknown): value is string {
  return typeof value === "string" && CLAIM_TOKEN.test(value);
}

/** A file name the worker may ask about. Returns the name, or null if it is not allowed. */
export function safeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!SAFE_NAME.test(value)) return null;
  if (value === "." || value === "..") return null;
  return value;
}

export const clipsPrefix = (owner: string, trainer: string) => `${owner}/${trainer}/clips`;
export const cachePrefix = (owner: string, trainer: string) => `${owner}/${trainer}/cache`;

export function outputPaths(owner: string, job: string) {
  return {
    final: `${owner}/${job}/final.mp4`,
    proof: `${owner}/${job}/proof.mp4`,
    report: `${owner}/${job}/run_report.json`,
  };
}

/** Text that is safe to store and show: no links, no long token-like strings, no control characters. */
export function sanitizeMessage(raw: unknown, maxChars: number): string {
  let text = typeof raw === "string" ? raw : "";
  text = text
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[removed]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) text = "Generation stopped.";
  return text.slice(0, maxChars);
}

/** Compares two strings in time that depends only on their length. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The approved ranges. Keep in step with VOICE_RANGES in src/lib/trainerSetup.ts and worker/worker.py.
export const VOICE_RANGES = {
  stability: { min: 0.35, max: 0.5, def: 0.5 },
  style: { min: 0.2, max: 0.4, def: 0.3 },
} as const;

/** Voice settings inside the approved ranges. Missing or non-numeric values get the default. */
export function clampVoiceSettings(raw: unknown) {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (key: "stability" | "style") => {
    const range = VOICE_RANGES[key];
    const value = source[key];
    const usable = typeof value === "number" && Number.isFinite(value);
    return Math.round(Math.min(Math.max(usable ? value : range.def, range.min), range.max) * 1000) / 1000;
  };
  return { stability: pick("stability"), similarity_boost: 0.75, style: pick("style"), use_speaker_boost: true };
}

/** The total cost in the run report, if it is a sensible number. Otherwise null. */
export function costFromReport(report: unknown): number | null {
  const total = (report as { costs?: { total_usd?: unknown } } | null)?.costs?.total_usd;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0 || total > 1000) return null;
  return Math.round(total * 100) / 100;
}

/** A random claim token, as base64url without padding. The caller supplies the random bytes. */
export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
