"""Local tests for joining pieces in tools/make_module.py. No fal, no ElevenLabs, no spend.

Generates small sample videos with ffmpeg, then checks assemble_pieces for one, two and three pieces:
the output exists, has video and audio, has the expected length, and returns the expected join centres.
The one-piece case also runs the join audit and the "AI-generated" label step on its output.

Run: python tools/test_make_module_join.py
"""
import re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402

PIECE_SECONDS = 4.0


def make_sample(path):
    mm.ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
              "-t", str(PIECE_SECONDS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(path))


def streams(path):
    """Returns 'video' and 'audio' if the file has each stream."""
    err = subprocess.run([mm.FF, "-i", str(path)], capture_output=True, text=True).stderr
    found = set()
    if re.search(r"Stream #\d+:\d+.*Video:", err):
        found.add("video")
    if re.search(r"Stream #\d+:\d+.*Audio:", err):
        found.add("audio")
    return found


def plan(modes):
    """A join plan like make_module builds: fade_frames 5 for a crossfade, 1 for a cut."""
    return [{"mode": m, "fade_frames": 1 if m == "cut" else 5} for m in modes]


class JoinTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = Path(tempfile.mkdtemp(prefix="make_module_join_"))
        cls.pieces = []
        for i in range(3):
            p = cls.dir / f"piece{i}.mp4"
            make_sample(p)
            cls.pieces.append(p)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def assemble(self, n, modes):
        out = self.dir / f"joined-{n}-{'-'.join(modes)}.mp4"
        centres = mm.assemble_pieces(self.pieces[:n], plan(modes), out)
        return out, centres

    def test_one_piece(self):
        out, centres = self.assemble(1, [])
        self.assertTrue(out.exists(), "one-piece output was not written")
        self.assertEqual(centres, [], "one piece has no joins")
        self.assertAlmostEqual(mm.media_duration(out), PIECE_SECONDS, delta=0.15)
        self.assertEqual(streams(out), {"video", "audio"})

    def test_one_piece_passes_audit_and_label(self):
        import join_audit
        out, _ = self.assemble(1, [])
        result = join_audit.audit(out, [], None, tag="test-one-piece")
        self.assertGreater(result["frames"], 0)
        self.assertEqual(result["joins"], [])
        self.assertIsNone(result["max_change_at_joins"])
        labelled = self.dir / "labelled-one-piece.mp4"
        mm.ffmpeg("-i", str(out), "-vf", mm.LABEL_FILTER, "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                  "-crf", "18", str(labelled))
        self.assertTrue(labelled.exists(), "label step did not write the video")
        self.assertEqual(streams(labelled), {"video", "audio"})

    def test_two_pieces_one_crossfade(self):
        out, centres = self.assemble(2, ["crossfade"])
        self.assertTrue(out.exists())
        fade = 5 / 25.0
        self.assertAlmostEqual(mm.media_duration(out), 2 * PIECE_SECONDS - fade, delta=0.15)
        self.assertEqual(len(centres), 1)
        self.assertAlmostEqual(centres[0], PIECE_SECONDS - fade / 2, delta=0.1)
        self.assertEqual(streams(out), {"video", "audio"})

    def test_three_pieces_crossfade_then_cut(self):
        out, centres = self.assemble(3, ["crossfade", "cut"])
        self.assertTrue(out.exists())
        expected = 3 * PIECE_SECONDS - 5 / 25.0 - 1 / 25.0
        self.assertAlmostEqual(mm.media_duration(out), expected, delta=0.2)
        self.assertEqual(len(centres), 2)
        self.assertEqual(streams(out), {"video", "audio"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
