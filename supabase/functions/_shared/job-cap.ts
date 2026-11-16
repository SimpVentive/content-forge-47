// The per-job cap, read from the environment. Kept apart from module-jobs.ts, which the app's tests import,
// so that module has no Deno references.

/** The per-job cap, from the environment (MODULE_JOB_MAX_USD), default $10. */
export function jobCapUsd(): number {
  const raw = Deno.env.get("MODULE_JOB_MAX_USD");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10;
}
