# Trainers

Each trainer has a folder here, named after the trainer (for example `trainers/harish/`):

- `voice.json`: the ElevenLabs voice ID and voice settings. Copy `voice.template.json` and fill in the ID.
- `clips/`: one or more base video clips of the real person (20 to 30 seconds each, same crop and framing).

These files are personal and are never committed (see `.gitignore`):
`voice.json`, `clips/`, and `cache/`, which holds generated audio and video.

Keys are never stored here. They go in `.env` at the project root, which is also never committed.
