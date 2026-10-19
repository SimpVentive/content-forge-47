# Architecture rules
- Source-duration and credit word counts use the shared contentDuration module; file bytes and upload status messages cannot represent learning content because images and compression distort storage size.
- Static SCORM exports must bundle the actual LearnerPreview runtime and compiled project styles; a separate presentation renderer causes preview/export drift.
- Standalone learner packages must contain authored media and never contain sessions, private keys, or runtime authoring-service access; exported learners cannot depend on the author's login.
- Introduction images use a shared resolver and must be prepared before packaging; offline learners cannot generate missing images.- Every pipeline step that replaces the course script (reviewer, calibration, Final QA) must pass `acceptScriptRewrite`; AI rewrites often abbreviate with placeholders and silently destroy content.
- Late async voice replies must check the learner's current screen before playing; slow TTS otherwise plays one screen's audio over the next.
- Client logos are course-level learner props, rendered in the shared header and embedded in standalone exports; retain them in draft course settings so every screen and restored course uses the same branding.
- Learner navigation and course completion go through the shared progression rule in learnerProgression; per-button checks let learners skip to completion without viewing screens.
- Assessment keys are resolved against authored options before shuffling and stored as full option text; shared exact matching governs scoring and feedback so answer labels cannot drift or mark every option wrong.
- Legacy media-quiz content templates resolve to the shared guided-notes layout before rendering; obsolete supplemental panels must not have a separate preview/export branch.
