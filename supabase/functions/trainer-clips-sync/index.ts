// POST /trainer-clips-sync
// Body: { trainer_id }
// Auth: Bearer user JWT. Only the trainer's owner may sync. The clip count is counted here, from storage,
// and written with the service role. The browser cannot set base_clip_count (see the migration's guard).

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";
import { adminClient } from "../_shared/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");

  let user;
  try {
    ({ user } = await getAuthedUser(req));
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    return serverError("Auth failure");
  }

  let body: { trainer_id?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const trainerId = String(body.trainer_id || "");
  if (!UUID.test(trainerId)) return badRequest("trainer_id must be an id");

  const admin = adminClient();
  const { data: trainer } = await admin
    .from("custom_trainers").select("id, owner_user_id, deleted_at").eq("id", trainerId).maybeSingle();
  if (!trainer || trainer.deleted_at) return notFound("Trainer not found.");
  if (trainer.owner_user_id !== user.id) return forbidden("Only the trainer's owner can sync its clips.");

  // Count MP4 files under <owner>/<trainer>/clips/ in the private bucket.
  const { data: listing, error: listError } = await admin.storage
    .from("trainer-clips").list(`${user.id}/${trainerId}/clips`, { limit: 1000 });
  if (listError) return serverError("The clips could not be listed.");
  const count = (listing ?? []).filter((o) => /\.mp4$/i.test(o.name)).length;

  const { error } = await admin.from("custom_trainers").update({ base_clip_count: count }).eq("id", trainerId);
  if (error) return serverError("The clip count could not be saved.");
  return ok({ trainer_id: trainerId, base_clip_count: count });
});
