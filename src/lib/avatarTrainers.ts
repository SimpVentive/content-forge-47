export type AvatarTrainer = {
  id: string;
  name: string;
  region: "india" | "global";
  subtitle: string;
};

export const AVATAR_TRAINERS: AvatarTrainer[] = [
  { id: "priya", name: "Priya", region: "india", subtitle: "India trainer" },
  { id: "indira", name: "Indira", region: "india", subtitle: "India trainer" },
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

export type VisemeKey =
  | "rest"
  | "aa"
  | "ee"
  | "ih"
  | "oh"
  | "ou"
  | "fv"
  | "mbp"
  | "th"
  | "ch"
  | "l"
  | "r"
  | "wq";

export type VisemeShape = {
  width: number;
  height: number;
  lift: number;
  roundness: number;
};

export type AvatarLipSyncProfile = {
  baseWidth: number;
  baseHeight: number;
  closedOpacity: number;
  openOpacity: number;
  visemes: Record<VisemeKey, VisemeShape>;
};

const DEFAULT_TRAINER_IMAGE_PROMPTS: Record<string, string> = {
  priya: "realistic professional indian woman corporate trainer headshot, studio lighting, clean office background",
  indira: "realistic professional indian woman corporate trainer in navy blazer, office background, studio lighting",
  arjun: "realistic professional indian man corporate trainer headshot, studio lighting, clean office background",
  neha: "realistic professional indian woman learning consultant headshot, studio lighting, clean office background",
  rohan: "realistic professional indian man learning consultant headshot, studio lighting, clean office background",
  daniel: "realistic professional male corporate trainer headshot, studio lighting, clean office background",
  emma: "realistic professional female corporate trainer headshot, studio lighting, clean office background",
};

const LOCAL_TRAINER_IMAGE_PATHS: Record<string, string> = {
  priya: "/trainers/priya.png",
  indira: "/trainers/indira.png",
  arjun: "/trainers/arjun.png",
  neha: "/trainers/neha.png",
  rohan: "/trainers/rohan.png",
  daniel: "/trainers/daniel.png",
  emma: "/trainers/emma.png",
};

function getDefaultTrainerImageUrl(trainerId: string): string {
  const prompt = DEFAULT_TRAINER_IMAGE_PROMPTS[trainerId] || "realistic professional trainer headshot, studio lighting";
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=640&seed=${encodeURIComponent(trainerId)}&model=flux&nologo=true`;
}

const TRAINER_VOICE_IDS: Record<string, string> = {
  priya: "pFZP5JQG7iQjIQuC4Bku",
  indira: "EXAVITQu4vr4xnSDxMaL",
  arjun: "TX3LPaxmHKxFdv7VOQHJ",
  neha: "MF3mGyEYCl7XYWbV9V6O",
  rohan: "onwK4e9ZLuTAKqWW03F9",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  emma: "21m00Tcm4TlvDq8ikWAM",
};

const DEFAULT_VISEME_SHAPES: Record<VisemeKey, VisemeShape> = {
  rest: { width: 0.84, height: 0.2, lift: 0, roundness: 999 },
  aa: { width: 1.12, height: 1.1, lift: 0.02, roundness: 20 },
  ee: { width: 1.22, height: 0.5, lift: 0.02, roundness: 18 },
  ih: { width: 1.03, height: 0.62, lift: 0.02, roundness: 16 },
  oh: { width: 0.76, height: 1.02, lift: 0.01, roundness: 999 },
  ou: { width: 0.64, height: 0.9, lift: 0.01, roundness: 999 },
  fv: { width: 1.18, height: 0.38, lift: -0.01, roundness: 10 },
  mbp: { width: 0.88, height: 0.12, lift: 0, roundness: 999 },
  th: { width: 1.02, height: 0.44, lift: -0.01, roundness: 14 },
  ch: { width: 0.96, height: 0.68, lift: 0.01, roundness: 14 },
  l: { width: 1, height: 0.56, lift: 0, roundness: 16 },
  r: { width: 0.86, height: 0.58, lift: 0.01, roundness: 999 },
  wq: { width: 0.72, height: 0.62, lift: 0.02, roundness: 999 },
};

const TRAINER_LIP_SYNC_PRESETS: Record<string, Partial<AvatarLipSyncProfile> & { visemeTweaks?: Partial<Record<VisemeKey, Partial<VisemeShape>>> }> = {
  priya: {
    baseWidth: 35,
    baseHeight: 22,
    visemeTweaks: {
      ee: { width: 1.25 },
      aa: { height: 1.12 },
    },
  },
  indira: {
    baseWidth: 34,
    baseHeight: 21,
    visemeTweaks: {
      ou: { width: 0.66, height: 0.94 },
      th: { width: 1.05 },
    },
  },
  arjun: {
    baseWidth: 36,
    baseHeight: 23,
    visemeTweaks: {
      mbp: { height: 0.1 },
      r: { width: 0.84 },
    },
  },
  neha: {
    baseWidth: 33,
    baseHeight: 21,
    visemeTweaks: {
      ih: { width: 1.06 },
      fv: { width: 1.2 },
    },
  },
  rohan: {
    baseWidth: 35,
    baseHeight: 22,
    visemeTweaks: {
      oh: { width: 0.78, height: 1.08 },
      ch: { height: 0.72 },
    },
  },
  daniel: {
    baseWidth: 36,
    baseHeight: 23,
    visemeTweaks: {
      aa: { width: 1.08, height: 1.06 },
      wq: { width: 0.7 },
    },
  },
  emma: {
    baseWidth: 34,
    baseHeight: 22,
    visemeTweaks: {
      ee: { width: 1.24 },
      l: { height: 0.58 },
    },
  },
};

function buildProfileForTrainer(trainerId: string): AvatarLipSyncProfile {
  const preset = TRAINER_LIP_SYNC_PRESETS[trainerId] || {};
  const visemes = Object.fromEntries(
    (Object.keys(DEFAULT_VISEME_SHAPES) as VisemeKey[]).map((key) => {
      const baseShape = DEFAULT_VISEME_SHAPES[key];
      const tweak = preset.visemeTweaks?.[key] || {};
      return [key, { ...baseShape, ...tweak }];
    })
  ) as Record<VisemeKey, VisemeShape>;

  return {
    baseWidth: preset.baseWidth ?? 34,
    baseHeight: preset.baseHeight ?? 22,
    closedOpacity: preset.closedOpacity ?? 0.2,
    openOpacity: preset.openOpacity ?? 0.9,
    visemes,
  };
}

export function getTrainerMedia(trainerId: string, env: Record<string, string | undefined>): TrainerMedia {
  const suffix = trainerId.toUpperCase();
  const videoUrl = env[`VITE_AVATAR_VIDEO_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_URL?.trim() || undefined;
  const posterUrl = env[`VITE_AVATAR_VIDEO_POSTER_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_POSTER_URL?.trim() || undefined;
  const localImageUrl = LOCAL_TRAINER_IMAGE_PATHS[trainerId];

  const imageUrl = env[`VITE_AVATAR_IMAGE_URL_${suffix}`]?.trim()
    || localImageUrl
    || env.VITE_AVATAR_IMAGE_URL?.trim()
    || getDefaultTrainerImageUrl(trainerId);

  return { imageUrl, videoUrl, posterUrl };
}

export function getTrainerVoiceId(trainerId: string): string {
  return TRAINER_VOICE_IDS[trainerId] || TRAINER_VOICE_IDS.emma;
}

export function getTrainerLipSyncProfile(trainerId: string): AvatarLipSyncProfile {
  return buildProfileForTrainer(trainerId);
}
