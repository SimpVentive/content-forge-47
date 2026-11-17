# Tools

Offline tools for the trainer and lip-sync pipeline. They are not part of the web app build.

## make_module.py

Builds a lip-synced module video for one trainer from a script.

    python tools/make_module.py --trainer <name> --script <script.txt> --out <out.mp4> [--workers 4] [--yes]

Steps: script to ElevenLabs audio with timestamps, then equal pieces of 40 seconds or less, cut at sentence
gaps, then a base clip and start point per piece, then LatentSync on each piece (pieces run in parallel), then
face normalisation, then joins (crossfade when the join cost is low, otherwise a straight cut at the pause), then
checks, then a proof copy with an "AI-generated" label.

Writes `<out>.mp4`, `<out>-proof.mp4` and `run_report.json`. Finished pieces are cached, so a re-run costs
nothing for unchanged pieces. A failed piece is retried by re-running the command; the whole module is not restarted.

Keys are read from `.env` (`ELEVENLABS_API_KEY`, `fal_key`). They are never printed or written to a report.

## join_audit.py

Audits a finished video: raw change at every frame (flags above 3 times the median), ghosting (excluding straight
cuts), face and body distance for each join, and a contact sheet of 5 frames either side of each join.

    python tools/join_audit.py <video.mp4> <join_seconds,...> <cut,crossfade,...> <tag>

## find_clean_stretches.py

Finds stretches of a source video where the presenter is on the plain background, with no slide text, inset or
logo, and marks rest-pose clips (10 to 30 seconds, same pose at both ends, head still).

    python tools/find_clean_stretches.py <source.mp4> [report.json]

Rest pose is approximate. Check the clips by eye before using them.

## lipsync_score.py

Scores lip sync: mouth opening per frame (from the inner lip landmarks) against narration loudness, as a
correlation in 2-second windows, with the best lag within 0.2 seconds.

    python tools/lipsync_score.py <video.mp4> [window_seconds]

A real recording of a presenter scores about 0.24 overall. A lip-synced piece scores near 0.

## prepare_worker_test.py and run_worker.py (throwaway project only)

Runs one worker test against the throwaway project. Nothing here touches live.

    python tools/prepare_worker_test.py            creates a creator, team, trainer (with a consent record and its clip) and one queued job; spends nothing
    python tools/prepare_worker_test.py --cleanup  removes what that run created

    python tools/run_worker.py                     starts the worker in the background; it spends money when it runs a job
    python tools/run_worker.py --stop              stops it

Keys come from the environment or the Supabase CLI, never from a file. Before starting the worker, set
`ELEVENLABS_API_KEY`, `FAL_KEY` and `THROWAWAY_WORKER_PASS` in the PowerShell window. The launcher refuses any URL that is
not the throwaway project. The worker itself has no service key: it reaches Supabase only through the worker gateway.

## Worker gateway (throwaway project only)

    python tools/test_worker_gateway.py    45 checks against the deployed gateway: passes, claims, tokens, paths, status rules, stale jobs. Spends nothing.
    python tools/test_worker_pieces.py     a failed run still saves its pieces; a failed cache upload still ends the job. Uses a fake tool; spends nothing.

Needs `THROWAWAY_WORKER_PASS` set to the pass currently on the throwaway function. Rollback for the migration:
`tools/rollback_worker_gateway.sql` (not run anywhere). Read-only check: `tools/live_checks_worker_gateway.sql`.

## Local tests (no fal, no ElevenLabs, no spend)

    python tools/test_make_module_join.py     one, two and three piece joins, and the audit and label on one piece
    python tools/test_normalise_fill.py       edges uncovered by the face warp are filled, not streaked

## Known limitations

- **Lip sync is weak.** On one test the lip-synced piece scored about 0.02, against about 0.24 for a real recording
  of the same presenter, using `lipsync_score.py`. Revisit when a better lip-sync model is available.
- **The provider is hard-coded, not a setting.** `LIPSYNC_ENDPOINT` in `make_module.py` is `fal-ai/latentsync`,
  and the request arguments and the LatentSync price (also in `supabase/functions/_shared/module-jobs.ts`) assume
  that model. Changing the model means changing those places together.
- **Edges uncovered by the face warp are filled with the background colour.** Where the presenter's body ends at
  the camera frame, a straight edge is visible.
- **The owner's browser can insert consent records.** `custom_trainer_consents` allows an owner to insert their own
  rows from the browser, so a record shows that the owner filed it, not that the person verified it. Generation relies
  on that record. Fix later: a server function that stores the recording, and its own migration that removes the
  browser insert policy. This changes a live table, so it is not part of the trainer migration.

## Requirements

Python 3.12 with: opencv-python, mediapipe, numpy, fal-client, imageio-ffmpeg. The face model file
`public/mediapipe/face_landmarker.task` must be present.
