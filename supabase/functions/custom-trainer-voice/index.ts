// POST /custom-trainer-voice
// Body: { trainer_id: string }
// Auth: Bearer user JWT. The caller must own the trainer and have a consent record for it.
//
// Creates an ElevenLabs voice from the trainer's uploaded voice sample and saves the voice ID on the trainer.
// The ElevenLabs key is read from the Supabase secret ELEVENLABS_API_KEY (same as elevenlabs-tts).

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const BUCKET = "custom-trainers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const { data: trainer, error: trainerErr } = await admin
    .from("custom_trainers")
    .select("id, owner_user_id, name, voice_sample_path, voice_status, deleted_at")
    .eq("id", trainerId)
    .maybeSingle();
  if (trainerErr) return serverError("Could not load the trainer");
  if (!trainer || trainer.deleted_at) return notFound("Trainer not found");
  if (trainer.owner_user_id !== user.id) return forbidden("You do not own this trainer");
  if (!trainer.voice_sample_path) return badRequest("Upload a voice recording first");

  const { count: consentCount } = await admin
    .from("custom_trainer_consents")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", trainerId);
  if (!consentCount) return forbidden("Consent must be recorded before a voice is created");

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ElevenLabs");
  if (!apiKey) return serverError("ELEVENLABS_API_KEY secret is not set");

  await admin.from("custom_trainers").update({ voice_status: "processing", voice_error: null, updated_at: new Date().toISOString() }).eq("id", trainerId);

  const { data: sample, error: downloadErr } = await admin.storage.from(BUCKET).download(trainer.voice_sample_path);
  if (downloadErr || !sample) {
    await markFailed(admin, trainerId, "Could not read the voice recording");
    return serverError("Could not read the voice recording");
  }

  const form = new FormData();
  form.append("name", `ContentForge ${trainer.name} ${trainerId.slice(0, 8)}`);
  form.append("description", "Consented voice for ContentForge course narration");
  form.append("remove_background_noise", "true");
  form.append("files", sample, "voice-sample");

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });
  } catch {
    await markFailed(admin, trainerId, "ElevenLabs is unreachable");
    return serverError("ElevenLabs is unreachable");
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.voice_id) {
    const message = payload?.detail?.message || payload?.detail || `ElevenLabs returned ${res.status}`;
    await markFailed(admin, trainerId, String(message).slice(0, 300));
    return badRequest(`Voice creation failed: ${String(message)}`);
  }

  const { error: saveErr } = await admin
    .from("custom_trainers")
    .update({ voice_id: payload.voice_id, voice_status: "ready", voice_error: null, updated_at: new Date().toISOString() })
    .eq("id", trainerId);
  if (saveErr) return serverError("Voice was created but could not be saved");

  return ok({ voice_id: payload.voice_id, voice_status: "ready" });
});

async function markFailed(admin: ReturnType<typeof adminClient>, trainerId: string, message: string) {
  await admin
    .from("custom_trainers")
    .update({ voice_status: "failed", voice_error: message, updated_at: new Date().toISOString() })
    .eq("id", trainerId);
}
