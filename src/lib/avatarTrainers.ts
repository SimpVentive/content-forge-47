export type AvatarTrainer = {
  id: string;
  name: string;
  region: "india" | "global";
  subtitle: string;
};

export const AVATAR_TRAINERS: AvatarTrainer[] = [
  { id: "priya", name: "Priya", region: "india", subtitle: "India trainer" },
  { id: "arjun", name: "Arjun", region: "india", subtitle: "India trainer" },
  { id: "neha", name: "Neha", region: "india", subtitle: "India trainer" },
  { id: "rohan", name: "Rohan", region: "india", subtitle: "India trainer" },
  { id: "daniel", name: "Daniel", region: "global", subtitle: "Global trainer" },
  { id: "emma", name: "Emma", region: "global", subtitle: "Global trainer" },
];

const INDIAN_LANGUAGE_SET = new Set([
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
]);

export function isIndianLanguage(language: string): boolean {
  return INDIAN_LANGUAGE_SET.has(language);
}

export function getDefaultTrainerIdForLanguage(language: string): string {
  const preferredRegion: AvatarTrainer["region"] = isIndianLanguage(language) ? "india" : "global";
  return AVATAR_TRAINERS.find((trainer) => trainer.region === preferredRegion)?.id || AVATAR_TRAINERS[0].id;
}

export type TrainerMedia = {
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
};

export function getTrainerMedia(trainerId: string, env: Record<string, string | undefined>): TrainerMedia {
  const suffix = trainerId.toUpperCase();
  const videoUrl = env[`VITE_AVATAR_VIDEO_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_URL?.trim() || undefined;
  const posterUrl = env[`VITE_AVATAR_VIDEO_POSTER_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_POSTER_URL?.trim() || undefined;

  const imageUrl = env[`VITE_AVATAR_IMAGE_URL_${suffix}`]?.trim()
    || env.VITE_AVATAR_IMAGE_URL?.trim()
    || `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(trainerId)}`;

  return { imageUrl, videoUrl, posterUrl };
}
