import type { TrainerMedia } from "@/lib/avatarTrainers";

export interface LearnerExportMedia {
  trainerMedia?: TrainerMedia;
  audioBySlide?: Record<number, string>;
  introImages?: Record<number, string>;
}

// Session-only authored media; no credentials or learner answers are retained.
export const learnerExportMedia = new Map<string, LearnerExportMedia>();