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

## Requirements

Python 3.12 with: opencv-python, mediapipe, numpy, fal-client, imageio-ffmpeg. The face model file
`public/mediapipe/face_landmarker.task` must be present.
