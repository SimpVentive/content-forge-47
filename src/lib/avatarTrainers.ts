export type AvatarTrainer = {
  id: string;
  name: string;
  region: "india" | "global";
  subtitle: string;
};

export const AVATAR_TRAINERS: AvatarTrainer[] = [
  { id: "priya",      name: "Priya",       region: "india",  subtitle: "India trainer" },
  { id: "arjun",      name: "Arjun",       region: "india",  subtitle: "India trainer" },
  { id: "soumya",     name: "Soumya",      region: "india",  subtitle: "India trainer" },
  { id: "vedprakash", name: "Ved Prakash", region: "india",  subtitle: "India trainer" },
  { id: "atul",       name: "Atul",        region: "india",  subtitle: "India trainer" },
  { id: "irina",      name: "Irina",       region: "global", subtitle: "Global trainer" },
  { id: "john",       name: "John",        region: "global", subtitle: "Global trainer" },
];

const INDIAN_LANGUAGE_SET = new Set([
  "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu",
]);

export function isIndianLanguage(language: string): boolean {
  return INDIAN_LANGUAGE_SET.has(language);
}

export function getDefaultTrainerIdForLanguage(language: string): string {
  const preferredRegion: AvatarTrainer["region"] = isIndianLanguage(language) ? "india" : "global";
  return AVATAR_TRAINERS.find((t) => t.region === preferredRegion)?.id || AVATAR_TRAINERS[0].id;
}

export type TrainerMedia = {
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
};

export type VisemeKey =
  | "rest" | "aa" | "ee" | "ih" | "oh" | "ou"
  | "fv" | "mbp" | "th" | "ch" | "l" | "r" | "wq";

export type VisemeShape = {
  width: number;     // multiplier of baseWidth
  height: number;    // multiplier of baseHeight (controls opening)
  lift: number;      // upper-lip lift (-1 to 1)
  roundness: number; // corner roundness (px)
};

export type AvatarLipSyncProfile = {
  baseWidth: number;   // mouth half-width at scale 1.0 (display px)
  baseHeight: number;  // max mouth opening height at scale 1.0 (display px)
  mouthTopPct: number; // mouth centre Y as % of rendered image height
  mouthLeftPct: number;// mouth centre X as % of rendered image width
  skinTone: string;    // hex — used to paint the skin patch behind lips
  lipColor: string;    // hex — lip line and fill tint
  closedOpacity: number;
  openOpacity: number;
  visemes: Record<VisemeKey, VisemeShape>;
};

const LOCAL_TRAINER_IMAGE_PATHS: Record<string, string> = {
  priya:      "/trainers/priya.png",
  arjun:      "/trainers/arjun.png",
  soumya:     "/trainers/soumya.png",
  vedprakash: "/trainers/vedprakash.png",
  atul:       "/trainers/atul.png",
  irina:      "/trainers/irina.png",
  john:       "/trainers/john.png",
};

const TRAINER_VOICE_IDS: Record<string, string> = {
  priya:      "pFZP5JQG7iQjIQuC4Bku",
  arjun:      "TX3LPaxmHKxFdv7VOQHJ",
  soumya:     "EXAVITQu4vr4xnSDxMaL",
  vedprakash: "onwK4e9ZLuTAKqWW03F9",
  atul:       "MF3mGyEYCl7XYWbV9V6O",
  irina:      "21m00Tcm4TlvDq8ikWAM",
  john:       "onwK4e9ZLuTAKqWW03F9",
};

const DEFAULT_VISEME_SHAPES: Record<VisemeKey, VisemeShape> = {
  rest: { width: 0.84, height: 0.15, lift: 0,     roundness: 999 },
  aa:   { width: 1.12, height: 1.1,  lift: 0.04,  roundness: 20  },
  ee:   { width: 1.22, height: 0.5,  lift: 0.03,  roundness: 18  },
  ih:   { width: 1.03, height: 0.62, lift: 0.02,  roundness: 16  },
  oh:   { width: 0.76, height: 1.02, lift: 0.01,  roundness: 999 },
  ou:   { width: 0.64, height: 0.9,  lift: 0.01,  roundness: 999 },
  fv:   { width: 1.18, height: 0.38, lift: -0.01, roundness: 10  },
  mbp:  { width: 0.88, height: 0.08, lift: 0,     roundness: 999 },
  th:   { width: 1.02, height: 0.44, lift: -0.01, roundness: 14  },
  ch:   { width: 0.96, height: 0.68, lift: 0.01,  roundness: 14  },
  l:    { width: 1.0,  height: 0.56, lift: 0,     roundness: 16  },
  r:    { width: 0.86, height: 0.58, lift: 0.01,  roundness: 999 },
  wq:   { width: 0.72, height: 0.62, lift: 0.02,  roundness: 999 },
};

// Per-trainer overrides — tweak mouthTopPct if mouth appears too high/low in UI
const TRAINER_LIP_SYNC_PRESETS: Record<string, Partial<AvatarLipSyncProfile> & {
  visemeTweaks?: Partial<Record<VisemeKey, Partial<VisemeShape>>>;
}> = {
  priya: {
    baseWidth: 34, baseHeight: 20,
    mouthTopPct: 62, mouthLeftPct: 50,
    skinTone: "#C8865A", lipColor: "#9C5E38",
  },
  arjun: {
    baseWidth: 36, baseHeight: 22,
    mouthTopPct: 61, mouthLeftPct: 50,
    skinTone: "#B07040", lipColor: "#8A4C28",
    visemeTweaks: { mbp: { height: 0.06 }, r: { width: 0.84 } },
  },
  soumya: {
    baseWidth: 34, baseHeight: 20,
    mouthTopPct: 62, mouthLeftPct: 50,
    skinTone: "#C07850", lipColor: "#9A5034",
    visemeTweaks: { ee: { width: 1.24 } },
  },
  vedprakash: {
    baseWidth: 36, baseHeight: 21,
    mouthTopPct: 61, mouthLeftPct: 50,
    skinTone: "#C08C60", lipColor: "#9C6840",
    visemeTweaks: { oh: { width: 0.78, height: 1.06 } },
  },
  atul: {
    baseWidth: 36, baseHeight: 22,
    mouthTopPct: 61, mouthLeftPct: 50,
    skinTone: "#B88050", lipColor: "#966038",
    visemeTweaks: { aa: { width: 1.08, height: 1.06 } },
  },
  irina: {
    baseWidth: 33, baseHeight: 20,
    mouthTopPct: 62, mouthLeftPct: 50,
    skinTone: "#F0C8A0", lipColor: "#C07860",
    visemeTweaks: { ee: { width: 1.26 }, l: { height: 0.58 } },
  },
  john: {
    baseWidth: 36, baseHeight: 22,
    mouthTopPct: 61, mouthLeftPct: 50,
    skinTone: "#D4A870", lipColor: "#A87850",
    visemeTweaks: { wq: { width: 0.7 } },
  },
};

function buildProfileForTrainer(trainerId: string): AvatarLipSyncProfile {
  const preset = TRAINER_LIP_SYNC_PRESETS[trainerId] || {};
  const visemes = Object.fromEntries(
    (Object.keys(DEFAULT_VISEME_SHAPES) as VisemeKey[]).map((key) => {
      const base = DEFAULT_VISEME_SHAPES[key];
      const tweak = preset.visemeTweaks?.[key] || {};
      return [key, { ...base, ...tweak }];
    })
  ) as Record<VisemeKey, VisemeShape>;

  return {
    baseWidth:    preset.baseWidth    ?? 34,
    baseHeight:   preset.baseHeight   ?? 20,
    mouthTopPct:  preset.mouthTopPct  ?? 62,
    mouthLeftPct: preset.mouthLeftPct ?? 50,
    skinTone:     preset.skinTone     ?? "#C0886A",
    lipColor:     preset.lipColor     ?? "#9A6040",
    closedOpacity: preset.closedOpacity ?? 0.2,
    openOpacity:   preset.openOpacity   ?? 0.9,
    visemes,
  };
}

export function getTrainerMedia(trainerId: string, env: Record<string, string | undefined>): TrainerMedia {
  const suffix = trainerId.toUpperCase();
  const videoUrl  = env[`VITE_AVATAR_VIDEO_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_URL?.trim() || undefined;
  const posterUrl = env[`VITE_AVATAR_VIDEO_POSTER_URL_${suffix}`]?.trim() || env.VITE_AVATAR_VIDEO_POSTER_URL?.trim() || undefined;
  const imageUrl  = env[`VITE_AVATAR_IMAGE_URL_${suffix}`]?.trim()
    || LOCAL_TRAINER_IMAGE_PATHS[trainerId]
    || env.VITE_AVATAR_IMAGE_URL?.trim()
    || LOCAL_TRAINER_IMAGE_PATHS["priya"];

  return { imageUrl, videoUrl, posterUrl };
}

export function getTrainerVoiceId(trainerId: string): string {
  return TRAINER_VOICE_IDS[trainerId] || TRAINER_VOICE_IDS.irina;
}

export function getTrainerLipSyncProfile(trainerId: string): AvatarLipSyncProfile {
  return buildProfileForTrainer(trainerId);
}
