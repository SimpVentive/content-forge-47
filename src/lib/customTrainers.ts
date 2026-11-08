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
