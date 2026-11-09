// POST /custom-trainer-delete
// Body: { trainer_id: string }
// Auth: Bearer user JWT. The caller must own the trainer.
//
// Removes the trainer's voice clone (ElevenLabs), its photo, voice sample, narration audio and talking videos
// (storage), and its clip records. The trainer is marked deleted. The consent record is kept as proof of consent.

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const BUCKET = "custom-trainers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof adminClient>;

// Every file under a folder, including nested folders (clips/ holds the audio and video files).
async function listFilesRecursive(admin: Admin, folder: string): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (error || !data) return [];
  const files: string[] = [];
  for (const entry of data) {
    const path = `${folder}/${entry.name}`;
    if (entry.id) files.push(path);
    else files.push(...(await listFilesRecursive(admin, path)));
  }
  return files;
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

  let body: { trainer_id?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const trainerId = String(body.trainer_id || "");
  if (!UUID.test(trainerId)) return badRequest("trainer_id is invalid");

  const admin = adminClient();
  const { data: trainer, error: loadErr } = await admin
    .from("custom_trainers")
    .select("id, owner_user_id, voice_id, deleted_at")
    .eq("id", trainerId)
    .maybeSingle();
  if (loadErr) return serverError("Could not load the trainer");
  if (!trainer || trainer.deleted_at) return notFound("Trainer not found");
  if (trainer.owner_user_id !== user.id) return forbidden("You do not own this trainer");

  // 1. The voice clone goes first, so a failure here leaves the trainer intact and the user can try again.
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ElevenLabs");
  if (trainer.voice_id) {
    if (!elevenKey) return serverError("ELEVENLABS_API_KEY secret is not set");
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${trainer.voice_id}`, {
      method: "DELETE",
      headers: { "xi-api-key": elevenKey },
    });
    // 404 means the voice is already gone, which is fine.
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => "");
      return serverError(`The voice could not be removed (${res.status}). Nothing was deleted. ${detail.slice(0, 160)}`);
    }
  }

  // 2. Stored files: photo, voice sample, narration audio and talking videos.
  const folder = `${user.id}/${trainerId}`;
  // The consent recording stays with the consent record (proof of consent), so it is not removed.
  const files = (await listFilesRecursive(admin, folder)).filter((path) => !/\/consent\.[a-z0-9]+$/i.test(path));
  if (files.length) {
    const { error: removeErr } = await admin.storage.from(BUCKET).remove(files);
    if (removeErr) return serverError("Some files could not be removed. Try again.");
  }

  // 3. Clip records and the trainer itself. The consent record is kept.
  await admin.from("custom_trainer_clips").delete().eq("trainer_id", trainerId);
  const { error: markErr } = await admin
    .from("custom_trainers")
    .update({
      deleted_at: new Date().toISOString(),
      voice_id: null,
      voice_status: "failed",
      voice_error: "Deleted by the owner",
      photo_path: null,
      voice_sample_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trainerId);
  if (markErr) return serverError("The trainer could not be marked deleted");

  return ok({ deleted: true, files_removed: files.length });
});
