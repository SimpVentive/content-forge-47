# Architecture rules
- Static SCORM exports must bundle the actual LearnerPreview runtime and compiled project styles; a separate presentation renderer causes preview/export drift.
- Standalone learner packages must contain authored media and never contain sessions, private keys, or runtime authoring-service access; exported learners cannot depend on the author's login.
- Introduction images use a shared resolver and must be prepared before packaging; offline learners cannot generate missing images.- Every pipeline step that replaces the course script (reviewer, calibration, Final QA) must pass `acceptScriptRewrite`; AI rewrites often abbreviate with placeholders and silently destroy content.
- Late async voice replies must check the learner's current screen before playing; slow TTS otherwise plays one screen's audio over the next.
- Client logos are course-level learner props, rendered in the shared header and embedded in standalone exports; retain them in draft course settings so every screen and restored course uses the same branding.
