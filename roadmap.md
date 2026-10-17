# Static e-learning export parity
- [ ] Remove redundant media-quiz sections through the shared content layout; verify explanation/narration and dedicated assessments in preview and downloaded learners.
- [ ] Correct quiz answer resolution before shuffling and verify scoring/feedback in preview and standalone learners.
- [x] Restore client logos across all learner pages, output previews and offline exports; retain logos in saved course settings. Six regression tests passed; browser verified all test-course pages and embedded logo in the exported learner. User's own course remains unverified without sign-in.
- [x] Fix introduction image resolution and pre-export inclusion; preview/download image parity verified and 20 tests passed.
- [x] Package the actual learner preview and its styles, rather than the separate static renderer.
- [x] Preserve course settings, trainer, authored images, audio, and inserted videos in both export entry points.
- [x] Verify exported navigation, assessments, animation, images, trainer, fullscreen, and LMS score/completion using a downloaded test course; 14 export tests passed.
- [ ] Verify the user's existing course and recorded narration. Blocked: no usable preview session or saved course is available; user must sign in and export their course.