// Rules for trainer-avatar module jobs. Pure functions: no network, no storage.
// The same numbers are enforced on the server (supabase/functions/_shared/module-jobs.ts).

export type JobStatus = "queued" | "generating" | "ready_for_review" | "failed" | "published" | "rejected";

export const JOB_STATUSES: JobStatus[] = ["queued", "generating", "ready_for_review", "failed", "published", "rejected"];

/** Pieces are at most 40 s; a job's narration is split into at least this many pieces. */
export const PIECE_MAX_SECONDS = 40;
/** LatentSync (fal.ai) bills $0.005 per second with a 40 s minimum per clip: $0.20 per piece. */
export const LATENTSYNC_USD_PER_PIECE = 0.2;
/** Narration pace used for estimates (words per minute). */
export const NARRATION_WORDS_PER_MINUTE = 150;
/** At most this many jobs per user may be queued or generating at once. */
export const MAX_CONCURRENT_JOBS_PER_USER = 2;

/** Estimated narration length in seconds for a script. */
export function estimateSeconds(scriptText: string): number {
  const words = scriptText.trim().split(/\s+/).filter(Boolean).length;
  return (words / NARRATION_WORDS_PER_MINUTE) * 60;
}

/** Number of pieces a narration of this length is split into (never more than 40 s each). */
export function piecesFor(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.max(1, Math.ceil(seconds / PIECE_MAX_SECONDS));
}

/** Estimated LatentSync cost for a script, in USD. ElevenLabs is charged on the plan and is not included here. */
export function estimateUsd(scriptText: string): number {
  return Math.round(piecesFor(estimateSeconds(scriptText)) * LATENTSYNC_USD_PER_PIECE * 100) / 100;
}

export type StartCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a new job may start. Checks the hard cap per job, the concurrency limit per user,
 * and that the trainer is allowed (consent recorded, belongs to the team).
 */
export function canStartJob(args: {
  estimateUsd: number;
  capUsd: number;
  activeJobsForUser: number;
  consentRecorded: boolean;
  hasBaseClips: boolean;
  trainerInTeam: boolean;
  userRole: string | null;
}): StartCheck {
  if (!args.userRole || !["creator", "admin"].includes(args.userRole)) {
    return { ok: false, reason: "Only creators and admins can generate trainer videos." };
  }
  if (!args.trainerInTeam) return { ok: false, reason: "This trainer is not in your team." };
  if (!args.consentRecorded) return { ok: false, reason: "Consent is not recorded for this trainer. Generation is blocked." };
  if (!args.hasBaseClips) return { ok: false, reason: "No base clips are uploaded for this trainer yet." };
  if (args.estimateUsd > args.capUsd) {
    return { ok: false, reason: `The estimate ($${args.estimateUsd.toFixed(2)}) is over the per-job cap ($${args.capUsd.toFixed(2)}).` };
  }
  if (args.activeJobsForUser >= MAX_CONCURRENT_JOBS_PER_USER) {
    return { ok: false, reason: `You already have ${MAX_CONCURRENT_JOBS_PER_USER} jobs running. Wait for one to finish.` };
  }
  return { ok: true };
}

export function statusLabel(status: JobStatus): string {
  switch (status) {
    case "queued": return "Queued";
    case "generating": return "Generating";
    case "ready_for_review": return "Ready for review";
    case "failed": return "Failed";
    case "published": return "Published";
    case "rejected": return "Rejected";
  }
}

/** Only a job waiting for review can be approved or rejected. */
export function canReview(status: JobStatus): boolean {
  return status === "ready_for_review";
}

export const AI_LABEL = "AI-generated";
