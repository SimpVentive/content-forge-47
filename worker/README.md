# Trainer-avatar worker

Runs `tools/make_module.py` for queued module jobs. The worker has no Supabase service key. It reaches the database
and storage only through the **worker gateway**, an edge function (`supabase/functions/worker-gateway`) that runs a fixed
list of operations.

## What it does
1. Claims the oldest queued job (`claim`). The gateway returns the job id and a claim token, which is kept in memory only.
2. Reads the job's script, voice and settings (`inputs`), then downloads the trainer's clips and cached pieces through
   signed links (`links_download`).
3. Runs `tools/make_module.py`. The "AI-generated" label is burned into the final video.
4. Uploads the final video, the proof copy, the run report and the new pieces through signed upload links (`links_upload`).
5. Reports `complete` (the job becomes `ready_for_review`) or `fail` (with a fixed message).

Nothing is published here. A creator or admin approves the job in the app.

## Environment (set in the host's secret store, never in the code)

| Name | Purpose | Required |
|---|---|---|
| `WORKER_GATEWAY_URL` | `https://<project>.supabase.co/functions/v1/worker-gateway` | Yes |
| `WORKER_PASS` | The worker pass, sent as `X-Worker-Pass` | Yes |
| `SUPABASE_ANON_KEY` | The public anon key, sent as the Bearer token (the platform checks it) | Yes |
| `ELEVENLABS_API_KEY` | Voice narration | Yes |
| `FAL_KEY` | LatentSync on fal.ai | Yes |
| `WORKER_POLL_SECONDS` | Seconds between polls | No (default 15) |
| `MODULE_WORKERS` | Pieces in parallel | No (default 4) |
| `WORK_DIR` | Where job folders go | No (default `worker/work`) |

The worker no longer uses `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`. Remove them from the host.

## Running it

    pip install -r worker/requirements.txt
    python worker/worker.py

On Render: a background worker from this repository, build command `pip install -r worker/requirements.txt`, start
command `python worker/worker.py`, and the environment above. Instance: Standard (1 CPU, 2 GB).

## Rotating the worker pass
See `supabase/functions/worker-gateway` and the design notes in the pull request. In short: set `WORKER_PASS_NEXT` in the
Supabase function secrets, change `WORKER_PASS` on the host and restart the worker, then move the new value into
`WORKER_PASS` on Supabase and delete `WORKER_PASS_NEXT`.

## Notes
- A job with no progress for 45 minutes is failed as "worker stopped". The worker sends progress every five minutes while
  the tool runs, so a normal run is never stale.
- Signed download links last at most one hour. The worker asks again when it needs one. Signed upload links use the
  Supabase default lifetime, which the platform sets and the gateway cannot shorten.
- Pieces are cached in `module-cache/<owner>/<trainer>/cache/`. The bucket has no browser policies.
- Voice settings are clamped to the approved ranges on the server, before the worker sees them.
- A failed job is marked `failed`. The creator can submit it again.
