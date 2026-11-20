"""Offline checks for clean_for_speech. No network, no spend.

Run: python tools/test_speech_text.py
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from speech_text import clean_for_speech  # noqa: E402


class CleanForSpeechTests(unittest.TestCase):
    def test_pause_cue_becomes_an_ellipsis(self):
        self.assertEqual(clean_for_speech("Stop here. [PAUSE 2s] Then continue."), "Stop here. ... Then continue.")

    def test_pacing_cues_are_removed(self):
        self.assertEqual(clean_for_speech("This is [EMPHASIZE] important."), "This is important.")
        self.assertEqual(clean_for_speech("Go [SLOW DOWN] now."), "Go now.")
        self.assertEqual(clean_for_speech("[WHISPER] Quietly."), "Quietly.")

    def test_video_markers_are_removed(self):
        self.assertEqual(clean_for_speech("Intro. [VIDEO CUE: show the chart] Next point."), "Intro. Next point.")
        self.assertEqual(clean_for_speech("[ACTION: nod] Hello."), "Hello.")

    def test_no_cue_text_remains(self):
        text = "Start [PAUSE 1s] [EMPHASIZE] now [SLOW DOWN] and [VIDEO CUE: x] finish."
        cleaned = clean_for_speech(text)
        for word in ("PAUSE", "EMPHASIZE", "SLOW DOWN", "VIDEO CUE", "["):
            self.assertNotIn(word, cleaned)

    def test_other_brackets_are_left_alone(self):
        self.assertEqual(clean_for_speech("See the [Chart Title] today."), "See the [Chart Title] today.")

    def test_existing_punctuation_is_kept(self):
        self.assertEqual(clean_for_speech("Yes, really! Why? Sure."), "Yes, really! Why? Sure.")

    def test_no_space_before_punctuation_after_removal(self):
        self.assertEqual(clean_for_speech("A point [EMPHASIZE]."), "A point.")

    def test_blank_or_cue_only_input_gives_empty_text(self):
        self.assertEqual(clean_for_speech("   "), "")
        self.assertEqual(clean_for_speech("[EMPHASIZE]"), "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
