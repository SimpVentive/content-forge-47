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

## Requirements

Python 3.12 with: opencv-python, mediapipe, numpy, fal-client, imageio-ffmpeg. The face model file
`public/mediapipe/face_landmarker.task` must be present.
