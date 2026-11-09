// POST /custom-trainer-video
// Auth: Bearer user JWT. The caller must own the trainer.
//
// Actions (body.action):
//   "start"   { trainer_id, text, kind? }        Creates one talking-photo clip (voice + photo + text). Reuses a finished clip.
//   "status"  { clip_id }                         Checks a clip; when HeyGen is done, saves the video and returns it.
//   "lookup"  { trainer_id, texts: string[] }     Returns the saved clips for these texts (no new generation).
//
// Clips are keyed by a hash of (model version, voice id, photo path, text). An unchanged clip is never made twice.
// Keys: ELEVENLABS_API_KEY (voice audio) and HEYGEN_API_KEY_V3 / HEYGEN_API_KEY_ACTIVE / HEYGEN_API_KEY (video).

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const BUCKET = "custom-trainers";
const MODEL_VERSION = "talking-photo-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_SECONDS = 3600;
const MAX_TEXT = 600;

type Admin = ReturnType<typeof adminClient>;

function heygenKey(): string {
  return Deno.env.get("HEYGEN_API_KEY_V3") ?? Deno.env.get("HEYGEN_API_KEY_ACTIVE") ?? Deno.env.get("HEYGEN_API_KEY") ?? "";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function clipHash(voiceId: string, photoPath: string, text: string): Promise<string> {
  return sha256Hex(JSON.stringify([MODEL_VERSION, voiceId, photoPath, text.trim()]));
}

async function loadOwnedTrainer(admin: Admin, userId: string, trainerId: string) {
  const { data, error } = await admin
    .from("custom_trainers")
    .select("id, owner_user_id, voice_id, voice_status, photo_path, deleted_at")
    .eq("id", trainerId)
    .maybeSingle();
  if (error) return { error: "Could not load the trainer" as const };
  if (!data || data.deleted_at) return { notFound: true as const };
  if (data.owner_user_id !== userId) return { forbidden: true as const };
  return { trainer: data };
}

async function signed(admin: Admin, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_SECONDS);
  return (data?.signedUrl as string) || null;
}

async function withVideoUrl(admin: Admin, row: Record<string, any>) {
  return { ...row, video_url: row.status === "ready" ? await signed(admin, row.video_path) : null };
}

async function markFailed(admin: Admin, clipId: string, message: string) {
  await admin.from("custom_trainer_clips").update({ status: "failed", error: message.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", clipId);
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  let user;
  try {
    ({ user } = await getAuthedUser(req));
  } catch (e) {
    if (e instanceof AuthError) return e.status === 403 ? forbidden(e.message) : unauthorized(e.message);
    return serverError("Auth failure");
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const admin = adminClient();

  if (body.action === "start") return startClip(admin, user.id, body);
  if (body.action === "status") return checkClip(admin, user.id, body);
  if (body.action === "lookup") return lookupClips(admin, user.id, body);
  return badRequest("action must be start, status or lookup");
});

async function startClip(admin: Admin, userId: string, body: Record<string, any>) {
  const trainerId = String(body.trainer_id || "");
  const text = String(body.text || "").trim();
  const kind = body.kind === "sample" ? "sample" : "course";
  if (!UUID.test(trainerId)) return badRequest("trainer_id is invalid");
  if (!text || text.length > MAX_TEXT) return badRequest(`text must be 1 to ${MAX_TEXT} characters`);

  const found = await loadOwnedTrainer(admin, userId, trainerId);
  if ("error" in found) return serverError(found.error);
  if ("notFound" in found) return notFound("Trainer not found");
  if ("forbidden" in found) return forbidden("You do not own this trainer");
  const trainer = found.trainer;
  if (trainer.voice_status !== "ready" || !trainer.voice_id) return badRequest("This trainer's voice is not ready yet");
  if (!trainer.photo_path) return badRequest("This trainer has no photo");

  const hash = await clipHash(trainer.voice_id, trainer.photo_path, text);
  const { data: existing } = await admin
    .from("custom_trainer_clips")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("clip_hash", hash)
    .maybeSingle();

  // Never regenerate an unchanged clip: finished and in-progress clips are returned as they are.
  if (existing && (existing.status === "ready" || existing.status === "processing")) {
    return ok(await withVideoUrl(admin, existing));
  }

  const now = new Date().toISOString();
  const words = text.split(/\s+/).length;
  const estSeconds = Math.round((words / 150) * 60);
  let clipId: string;
  if (existing) {
    clipId = existing.id;
    await admin.from("custom_trainer_clips").update({ status: "processing", error: null, updated_at: now, kind }).eq("id", clipId);
  } else {
    const { data: created, error: insertErr } = await admin
      .from("custom_trainer_clips")
      .insert({ trainer_id: trainerId, owner_user_id: userId, clip_hash: hash, kind, text_preview: text.slice(0, 200), est_seconds: estSeconds, status: "processing" })
      .select("id")
      .single();
    if (insertErr || !created) return serverError("Could not record the clip");
    clipId = created.id;
  }

  // 1. The trainer's own voice speaks the text.
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ElevenLabs");
  if (!elevenKey) {
    await markFailed(admin, clipId, "ELEVENLABS_API_KEY secret is not set");
    return serverError("ELEVENLABS_API_KEY secret is not set");
  }
  let audio: ArrayBuffer;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${trainer.voice_id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      await markFailed(admin, clipId, `Voice service returned ${res.status}: ${detail.slice(0, 200)}`);
      return badRequest(`The voice could not speak this text (${res.status})`);
    }
    audio = await res.arrayBuffer();
  } catch {
    await markFailed(admin, clipId, "The voice service is unreachable");
    return serverError("The voice service is unreachable");
  }

  // 2. Keep the audio in the trainer's folder and send it with the photo to HeyGen.
  const audioPath = `${userId}/${trainerId}/clips/${hash}.mp3`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(audioPath, new Blob([audio], { type: "audio/mpeg" }), { upsert: true, contentType: "audio/mpeg" });
  if (upErr) {
    await markFailed(admin, clipId, "Could not save the audio");
    return serverError("Could not save the audio");
  }
  const photoUrl = await signed(admin, trainer.photo_path);
  const audioUrl = await signed(admin, audioPath);
  if (!photoUrl || !audioUrl) {
    await markFailed(admin, clipId, "Could not open the photo or audio for the video service");
    return serverError("Could not open the photo or audio for the video service");
  }

  const key = heygenKey();
  if (!key) {
    await markFailed(admin, clipId, "HeyGen API key is not configured");
    return serverError("HeyGen API key is not configured");
  }
  let heygenVideoId: string | undefined;
  try {
    const res = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "image",
        image: { type: "url", url: photoUrl },
        audio_url: audioUrl,
        title: `ContentForge ${trainer.id.slice(0, 8)} ${hash.slice(0, 8)}`,
        aspect_ratio: "auto",
        resolution: "720p",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const message = data?.error?.message || data?.message || `Video service returned ${res.status}`;
      await markFailed(admin, clipId, String(message));
      return badRequest(`The video could not be started: ${message}`);
    }
    heygenVideoId = data?.data?.video_id ?? data?.video_id;
  } catch {
    await markFailed(admin, clipId, "The video service is unreachable");
    return serverError("The video service is unreachable");
  }
  if (!heygenVideoId) {
    await markFailed(admin, clipId, "No video id returned by the video service");
    return serverError("No video id returned by the video service");
  }

  const { data: row } = await admin
    .from("custom_trainer_clips")
    .update({ heygen_video_id: heygenVideoId, audio_path: audioPath, status: "processing", updated_at: new Date().toISOString() })
    .eq("id", clipId)
    .select("*")
    .single();
  return ok(await withVideoUrl(admin, row || { id: clipId, status: "processing" }));
}

async function checkClip(admin: Admin, userId: string, body: Record<string, any>) {
  const clipId = String(body.clip_id || "");
  if (!UUID.test(clipId)) return badRequest("clip_id is invalid");
  const { data: clip } = await admin.from("custom_trainer_clips").select("*").eq("id", clipId).maybeSingle();
  if (!clip) return notFound("Clip not found");
  if (clip.owner_user_id !== userId) return forbidden("You do not own this clip");
  if (clip.status !== "processing" || !clip.heygen_video_id) return ok(await withVideoUrl(admin, clip));

  const key = heygenKey();
  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(clip.heygen_video_id)}`, {
    headers: { "X-Api-Key": key },
  });
  const data = await res.json().catch(() => ({}));
  const d = data?.data ?? data;
  if (!res.ok) return ok({ ...clip, video_url: null, note: `Video service status ${res.status}` });

  if (d?.status === "failed") {
    await markFailed(admin, clipId, String(d?.error?.message ?? d?.error ?? "The video service could not render this clip"));
    const { data: failed } = await admin.from("custom_trainer_clips").select("*").eq("id", clipId).single();
    return ok({ ...failed, video_url: null });
  }
  if (d?.status !== "completed" || !(d?.video_url ?? d?.captioned_video_url)) {
    return ok({ ...clip, video_url: null });
  }

  // Finished: save the video in the trainer's folder so it is never generated again.
  const url = d.video_url ?? d.captioned_video_url;
  const video = await fetch(url);
  if (!video.ok) return ok({ ...clip, video_url: null, note: "Could not download the finished video yet" });
  const videoPath = `${clip.owner_user_id}/${clip.trainer_id}/clips/${clip.clip_hash}.mp4`;
  const blob = await video.blob();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(videoPath, blob, { upsert: true, contentType: "video/mp4" });
  if (upErr) return serverError("Could not save the video");
  const { data: ready } = await admin
    .from("custom_trainer_clips")
    .update({ status: "ready", video_path: videoPath, error: null, updated_at: new Date().toISOString() })
    .eq("id", clipId)
    .select("*")
    .single();
  return ok(await withVideoUrl(admin, ready || clip));
}

async function lookupClips(admin: Admin, userId: string, body: Record<string, any>) {
  const trainerId = String(body.trainer_id || "");
  const texts: string[] = Array.isArray(body.texts) ? body.texts.map((t: unknown) => String(t).trim()).filter(Boolean) : [];
  if (!UUID.test(trainerId)) return badRequest("trainer_id is invalid");
  if (texts.length > 200) return badRequest("Too many texts in one request");

  const found = await loadOwnedTrainer(admin, userId, trainerId);
  if ("error" in found) return serverError(found.error);
  if ("notFound" in found) return notFound("Trainer not found");
  if ("forbidden" in found) return forbidden("You do not own this trainer");
  const trainer = found.trainer;
  if (!trainer.voice_id || !trainer.photo_path) return ok({ clips: {} });

  const hashes = await Promise.all(texts.map((t) => clipHash(trainer.voice_id as string, trainer.photo_path as string, t)));
  const { data: rows } = await admin.from("custom_trainer_clips").select("*").eq("trainer_id", trainerId).in("clip_hash", hashes);
  const byHash = new Map((rows || []).map((r: Record<string, any>) => [r.clip_hash, r]));
  const clips: Record<string, unknown> = {};
  for (let i = 0; i < texts.length; i++) {
    const row = byHash.get(hashes[i]);
    if (row) clips[texts[i]] = await withVideoUrl(admin, row);
  }
  return ok({ clips });
}
