// Custom trainers: a person's own photo and voice (see supabase/migrations/20261108120000_custom_trainers.sql).
import { supabase } from "@/lib/supabase";
import { callEdgeFunction } from "@/lib/edgeFunctions";

export const CUSTOM_TRAINER_BUCKET = "custom-trainers";

// Same portrait shape as the built-in trainers (512 × 768 picture, 2:3).
export const PORTRAIT_WIDTH = 640;
export const PORTRAIT_HEIGHT = 960;
export const VOICE_MIN_SECONDS = 60;
export const VOICE_MAX_SECONDS = 180;

export type CustomTrainerStatus = "draft" | "processing" | "ready" | "failed";

export type CustomTrainer = {
  id: string;
  owner_user_id: string;
  owner_org_id: string | null;
  name: string;
  photo_path: string | null;
  voice_sample_path: string | null;
  voice_id: string | null;
  voice_status: CustomTrainerStatus;
  voice_error: string | null;
  created_at: string;
  deleted_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a trainer id belongs to a custom trainer (built-in ids are words like "priya"). */
export function isCustomTrainerId(id: string | null | undefined): boolean {
  return Boolean(id && UUID.test(id));
}

// The tables come from the migration; the generated Supabase types are refreshed after it is applied.
const db = () => supabase as unknown as { from: (table: string) => any; storage: any };

export async function listCustomTrainers(): Promise<CustomTrainer[]> {
  const { data, error } = await db()
    .from("custom_trainers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CustomTrainer[];
}

export async function getCustomTrainer(id: string): Promise<CustomTrainer | null> {
  const { data, error } = await db().from("custom_trainers").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return (data || null) as CustomTrainer | null;
}

export async function createCustomTrainer(userId: string, name: string): Promise<CustomTrainer> {
  const { data, error } = await db()
    .from("custom_trainers")
    .insert({ owner_user_id: userId, name: name.trim() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CustomTrainer;
}

/** Uploads one file into the trainer's folder and returns its storage path. */
export async function uploadTrainerFile(userId: string, trainerId: string, fileName: string, blob: Blob): Promise<string> {
  const path = `${userId}/${trainerId}/${fileName}`;
  const { error } = await db().storage.from(CUSTOM_TRAINER_BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function setTrainerFields(trainerId: string, fields: Partial<CustomTrainer>): Promise<void> {
  const { error } = await db()
    .from("custom_trainers")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", trainerId);
  if (error) throw new Error(error.message);
}

export async function recordConsent(userId: string, trainerId: string, sentence: string, audioPath: string | null): Promise<void> {
  const { error } = await db().from("custom_trainer_consents").insert({
    trainer_id: trainerId,
    owner_user_id: userId,
    consent_sentence: sentence,
    consent_audio_path: audioPath,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
  });
  if (error) throw new Error(error.message);
}

/** Creates the ElevenLabs voice from the uploaded sample. Returns the new voice id. */
export async function createCustomVoice(trainerId: string): Promise<string> {
  const result = await callEdgeFunction<{ voice_id: string }>("custom-trainer-voice", { trainer_id: trainerId });
  return result.voice_id;
}

/** Short-lived link to the trainer's photo (the bucket is private). */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(CUSTOM_TRAINER_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return (data?.signedUrl as string) || null;
}

/** Crops an image to the 2:3 portrait used by the built-in trainers and returns a JPEG. */
export async function cropToPortrait(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const targetRatio = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > targetRatio) {
    sw = Math.round(sh * targetRatio);
  } else {
    sh = Math.round(sw / targetRatio);
  }
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_WIDTH;
  canvas.height = PORTRAIT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not prepare the photo");
  return blob;
}

/** Reads the duration of an audio file in seconds. */
export function audioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const seconds = audio.duration;
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be read as audio"));
    };
    audio.src = url;
  });
}

/** Upload guidance shown on the upload screen. */
export const UPLOAD_GUIDELINES = [
  "Good, even light on your face. Avoid strong backlight.",
  "A plain, uncluttered background.",
  "Face the camera straight on, mouth closed, neutral expression.",
  "Quiet room for the voice recording. No music, fans or other voices.",
];

export type PhotoQuality = {
  /** Problems that stop the photo from being used. */
  blocking: string[];
  /** Problems the user should look at, but can accept. */
  warnings: string[];
};

export const MIN_PHOTO_SHORT_SIDE = 640;

/**
 * Checks a photo before it is cropped: size, brightness, contrast and sharpness.
 * Measured on a small copy, so it is quick on a phone or a laptop.
 */
export async function assessPhotoQuality(file: File): Promise<PhotoQuality> {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const bitmap = await createImageBitmap(file);
  const shortSide = Math.min(bitmap.width, bitmap.height);
  if (shortSide < MIN_PHOTO_SHORT_SIDE) {
    blocking.push(`The photo is too small (${bitmap.width} × ${bitmap.height} px). Use a photo at least ${MIN_PHOTO_SHORT_SIDE} px on its shorter side. A close-up taken on a phone is ideal.`);
  }

  // Analyse a 256 px copy: average brightness, contrast, and sharpness (variance of the Laplacian).
  const size = 256;
  const scale = size / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return { blocking, warnings };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const y = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = y;
    sum += y;
  }
  const mean = sum / gray.length;
  let varSum = 0;
  for (const y of gray) varSum += (y - mean) * (y - mean);
  const std = Math.sqrt(varSum / gray.length);

  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const lapMean = lapSum / count;
  const sharpness = lapSq / count - lapMean * lapMean;

  if (mean < 70) warnings.push("The photo is dark. Face a window or a light, and take it again if the face is hard to see.");
  if (mean > 215) warnings.push("The photo is very bright or washed out. Avoid strong light behind you.");
  if (std < 30) warnings.push("The photo has low contrast. Use even light and a plain background.");
  if (sharpness < 40) warnings.push("The photo looks blurry. Hold the camera still and check the focus.");

  return { blocking, warnings };
}
