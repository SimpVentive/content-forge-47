# Architecture rules
- Static SCORM exports must bundle the actual LearnerPreview runtime and compiled project styles; a separate presentation renderer causes preview/export drift.
- Standalone learner packages must contain authored media and never contain sessions, private keys, or runtime authoring-service access; exported learners cannot depend on the author's login.