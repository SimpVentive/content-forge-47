# Trainer-avatar worker

Runs `tools/make_module.py` for queued module jobs and writes the results back to Supabase.

## What it does
1. Polls `module_jobs` for `queued` jobs and claims one with a conditional update.
2. Downloads the trainer's `voice.json`, base clips and cached pieces from the `trainer-clips` bucket.
3. Runs `tools/make_module.py` (the "AI-generated" label is burned into the final video).
4. Uploads the final video, the proof copy and the run report to `generated-videos`, and the new pieces to the cache.
5. Sets the job to `ready_for_review`, or `failed` with a short message.

Nothing is published here. A creator or admin approves the job in the app.

## Environment (set in the host's secret store, never in the code)

| Name | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for the job table and buckets |
| `ELEVENLABS_API_KEY` | Voice narration |
| `FAL_KEY` | LatentSync on fal.ai |
| `WORKER_POLL_SECONDS` | Optional, default 15 |
| `MODULE_WORKERS` | Optional, pieces in parallel, default 4 |

## Running it

    pip install -r worker/requirements.txt
    python worker/worker.py

On Render: create a background worker from this repository, build command `pip install -r worker/requirements.txt`,
start command `python worker/worker.py`, and set the environment above. Instance: Standard (1 CPU, 2 GB).

## Notes
- Peak memory for face tracking on one piece was about 200 MB in testing. 2 GB is enough.
- Pieces are cached in `trainer-clips/<owner>/<trainer>/cache/`, so a restart does not pay for them again.
- A failed job is marked `failed`. The creator can submit it again.
