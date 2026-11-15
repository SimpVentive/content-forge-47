// Server-side rules for trainer-avatar module jobs. The lip-sync provider is read from lipsync-provider.json,
// the same file tools/make_module.py (the worker) and src/lib/moduleJobs.ts read.
import provider from "./lipsync-provider.json" with { type: "json" };

export const LIPSYNC_PROVIDER = provider as {
  name: string;
  endpoint: string;
  price_per_second_usd: number;
  minimum_seconds: number;
};
export const PIECE_MAX_SECONDS = 40;
export const NARRATION_WORDS_PER_MINUTE = 150;
export const MAX_CONCURRENT_JOBS_PER_USER = 2;
export const MAX_SCRIPT_CHARS = 6000;

/** What the provider bills for one clip of this length: at least the minimum, at the per-second price. */
export function billedUsd(seconds: number): number {
  return Math.round(Math.max(LIPSYNC_PROVIDER.minimum_seconds, seconds) * LIPSYNC_PROVIDER.price_per_second_usd * 10000) / 10000;
}

/** Estimate for a narration of this many seconds: equal pieces of at most PIECE_MAX_SECONDS, each billed as above. */
export function estimateUsdForSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  const pieces = Math.max(1, Math.ceil(seconds / PIECE_MAX_SECONDS));
  const each = seconds / pieces;
  return Math.round(pieces * billedUsd(each) * 100) / 100;
}

export function estimateUsd(scriptText: string): number {
  const words = scriptText.trim().split(/\s+/).filter(Boolean).length;
  return estimateUsdForSeconds((words / NARRATION_WORDS_PER_MINUTE) * 60);
}
