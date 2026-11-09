import type { TrainerMedia } from "@/lib/avatarTrainers";

export interface LearnerExportMedia {
  trainerMedia?: TrainerMedia;
  audioBySlide?: Record<number, string>;
  /** Exact text each cached audio clip speaks; clips whose text no longer matches are discarded. */
  audioTextBySlide?: Record<number, string>;
  introImages?: Record<number, string>;
  /** A custom trainer packaged with the course: its own name, photo and voice. */
  customTrainer?: { name: string; photoUrl: string; voiceId: string; voiceStatus: string; voiceError: string | null };
  /** Saved talking videos keyed by the screen's narration text, with the file path inside the package. */
  talkingClips?: Record<string, { status: string; video_url: string | null }>;
}

// Session-only authored media; no credentials or learner answers are retained.
export const learnerExportMedia = new Map<string, LearnerExportMedia>();