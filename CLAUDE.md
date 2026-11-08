# ContentForge: working rules

## Git workflow
- Work directly on `main`. Pushing to `main` deploys to testing.l-kurve.com automatically (`.github/workflows/deploy.yml`).
- For every task, in this order:
  1. `git pull origin main`
  2. Make the change.
  3. Run `npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run` and `npx vite build`.
  4. Commit and `git push origin main`.
- Never push if the build or the tests fail.
- Lovable also commits to `main`. Always pull first, and resolve conflicts without dropping either side's work.
- Do not commit test artifacts (screenshots, zips, videos, debug pages) unless the user asks.

## Secrets
- Never put keys in source, in `.env.example`, or in the deploy workflow.
- `.env` is git-ignored. Keep only local values there.
- Vite inlines every `VITE_*` variable into the public website. Do not add secret keys as `VITE_*` variables.
- HeyGen calls go through the Supabase edge function `heygen-video`, which reads its key from Supabase secrets. The browser never calls HeyGen directly.

## Learner package (SCORM)
- The package is the full learner player: `createLearnerScormPackage` in `src/lib/learnerScormPackage.ts`. Do not use the old document exporter for the package.
- The package must not request anything under `/trainers/`, and must not show raw "[Visual: ...]" or "Narrator: ..." text to learners.
- Narrator mouth: `src/lib/trainerMouth.ts` is the shared drawing and timing code. The mouth follows the narration track (`src/lib/mouthTrack.ts`). The player must not probe for sprite images.
