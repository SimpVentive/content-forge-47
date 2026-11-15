// Server-side rules for trainer-avatar module jobs. Same numbers as src/lib/moduleJobs.ts.
export const PIECE_MAX_SECONDS = 40;
export const LATENTSYNC_USD_PER_PIECE = 0.2;
export const NARRATION_WORDS_PER_MINUTE = 150;
export const MAX_CONCURRENT_JOBS_PER_USER = 2;
export const MAX_SCRIPT_CHARS = 6000;

export function estimateUsd(scriptText: string): number {
  const words = scriptText.trim().split(/\s+/).filter(Boolean).length;
  const seconds = (words / NARRATION_WORDS_PER_MINUTE) * 60;
  if (seconds <= 0) return 0;
  const pieces = Math.max(1, Math.ceil(seconds / PIECE_MAX_SECONDS));
  return Math.round(pieces * LATENTSYNC_USD_PER_PIECE * 100) / 100;
}

/** The per-job cap, from the environment (MODULE_JOB_MAX_USD), default $10. */
export function jobCapUsd(): number {
  const raw = Deno.env.get("MODULE_JOB_MAX_USD");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10;
}
