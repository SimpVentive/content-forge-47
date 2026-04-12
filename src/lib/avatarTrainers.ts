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

const DEFAULT_TRAINER_IMAGE_PROMPTS: Record<string, string> = {
  priya: "realistic professional indian woman corporate trainer headshot, studio lighting, clean office background",
  arjun: "realistic professional indian man corporate trainer headshot, studio lighting, clean office background",
  neha: "realistic professional indian woman learning consultant headshot, studio lighting, clean office background",
  rohan: "realistic professional indian man learning consultant headshot, studio lighting, clean office background",
  daniel: "realistic professional male corporate trainer headshot, studio lighting, clean office background",
  emma: "realistic professional female corporate trainer headshot, studio lighting, clean office background",
};

function getDefaultTrainerImageUrl(trainerId: string): string {
  const prompt = DEFAULT_TRAINER_IMAGE_PROMPTS[trainerId] || "realistic professional trainer headshot, studio lighting";
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=640&seed=${encodeURIComponent(trainerId)}&model=flux&nologo=true`;
}

export function getTrainerMedia(trainerId: string, env: Record<string, string | undefined>): TrainerMedia {
  const suffix = trainerId.toUpperCase();
  const videoUrl = env[`VITE_AVATAR_VIDEO_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_URL?.trim() || undefined;
  const posterUrl = env[`VITE_AVATAR_VIDEO_POSTER_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_POSTER_URL?.trim() || undefined;

  const imageUrl = env[`VITE_AVATAR_IMAGE_URL_${suffix}`]?.trim()
    || env.VITE_AVATAR_IMAGE_URL?.trim()
    || getDefaultTrainerImageUrl(trainerId);

  return { imageUrl, videoUrl, posterUrl };
}
