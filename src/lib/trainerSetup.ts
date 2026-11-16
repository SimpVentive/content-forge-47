// Rules for the Trainer setup screen: base clips and voice settings. Pure functions, no network.

export const MAX_CLIP_BYTES = 200 * 1024 * 1024; // 200 MB per clip
export const CLIP_MIN_SECONDS = 10;
export const CLIP_MAX_SECONDS = 30;

/** Approved ranges for generation voice settings (the defaults are stability 0.5 and style 0.3). */
export const VOICE_RANGES = {
  stability: { min: 0.35, max: 0.5, default: 0.5 },
  style: { min: 0.2, max: 0.4, default: 0.3 },
} as const;

export type ClipCheck = { ok: true } | { ok: false; reason: string };

/** A base clip must be an MP4 file, under the size limit. */
export function checkClipFile(name: string, sizeBytes: number): ClipCheck {
  if (!/\.mp4$/i.test(name)) return { ok: false, reason: `${name}: only MP4 clips are accepted.` };
  if (sizeBytes <= 0) return { ok: false, reason: `${name}: the file is empty.` };
  if (sizeBytes > MAX_CLIP_BYTES) return { ok: false, reason: `${name}: the clip is over 200 MB.` };
  return { ok: true };
}

/** A storage-safe file name: letters, numbers, dashes and dots only. */
export function safeClipName(name: string): string {
  const base = name.replace(/\.mp4$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "clip";
  return `${base}.mp4`;
}

/** The storage path for a clip: <owner>/<trainer>/clips/<name>. */
export function clipPath(ownerUserId: string, trainerId: string, fileName: string): string {
  return `${ownerUserId}/${trainerId}/clips/${safeClipName(fileName)}`;
}

/** Number of MP4 clips in a folder listing. */
export function countClips(names: string[]): number {
  return names.filter((n) => /\.mp4$/i.test(n)).length;
}

export type VoiceCheck = { ok: true; settings: VoiceSettings } | { ok: false; reason: string };

export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

/** Voice settings must sit inside the approved ranges. Similarity and the speaker boost stay fixed. */
export function checkVoiceSettings(stability: number, style: number): VoiceCheck {
  const s = VOICE_RANGES.stability;
  const y = VOICE_RANGES.style;
  if (!Number.isFinite(stability) || stability < s.min || stability > s.max) {
    return { ok: false, reason: `Stability must be between ${s.min} and ${s.max}.` };
  }
  if (!Number.isFinite(style) || style < y.min || style > y.max) {
    return { ok: false, reason: `Style must be between ${y.min} and ${y.max}.` };
  }
  return { ok: true, settings: { stability, similarity_boost: 0.75, style, use_speaker_boost: true } };
}
