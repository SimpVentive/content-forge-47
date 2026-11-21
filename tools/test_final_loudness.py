"""Offline check: the final encode measures within 1 LU of -16 LUFS; intermediates are not normalised.
No fal, no ElevenLabs, no spend. Measurement uses ffmpeg's own EBU R128 meter (ebur128 filter).

Run: python tools/test_final_loudness.py
"""
import re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402

FF = mm.FF
TARGET = -16.0
TOLERANCE = 1.0  # LU


def run_ff(*args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


def integrated_lufs(path):
    """The integrated loudness of the file, from ffmpeg's ebur128 summary."""
    err = subprocess.run([FF, "-hide_banner", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"Integrated loudness:\s*I:\s*(-?[\d.]+)\s*LUFS", err)
    if not m:
        raise AssertionError("no integrated loudness in the ffmpeg output")
    return float(m.group(1))


def audio_info(path):
    text = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    codec = re.search(r"Audio: (\w+)", text)
    rate = re.search(r"Audio:.*?(\d{4,6}) Hz", text)
    return (codec.group(1) if codec else None, int(rate.group(1)) if rate else None)


class FinalLoudnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = Path(tempfile.mkdtemp(prefix="final_loudness_"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def make_source(self, name, volume):
        """10 seconds of picture and sound (a tone at the given volume, stored as PCM in Matroska)."""
        path = self.dir / name
        run_ff("-f", "lavfi", "-i", "testsrc2=size=160x120:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
               "-t", "10", "-filter:a", f"volume={volume}", "-c:v", "libx264", "-pix_fmt", "yuv420p",
               "-c:a", "pcm_s16le", str(path))
        return path

    def test_quiet_source_measures_minus_16_lufs(self):
        src = self.make_source("quiet.mkv", 0.05)
        before = integrated_lufs(src)
        out = self.dir / "final-quiet.mp4"
        mm.final_encode(src, out)
        after = integrated_lufs(out)
        self.assertLess(before, -30, f"the test source should start quiet (it measured {before})")
        self.assertLessEqual(abs(after - TARGET), TOLERANCE, f"final loudness {after} LUFS is not within 1 LU of -16")

    def test_loud_source_measures_minus_16_lufs(self):
        src = self.make_source("loud.mkv", 0.9)
        out = self.dir / "final-loud.mp4"
        mm.final_encode(src, out)
        after = integrated_lufs(out)
        self.assertLessEqual(abs(after - TARGET), TOLERANCE, f"final loudness {after} LUFS is not within 1 LU of -16")

    def test_final_sound_is_aac_at_48k(self):
        out = self.dir / "final-format.mp4"
        mm.final_encode(self.make_source("format-source.mkv", 0.3), out)
        codec, rate = audio_info(out)
        self.assertEqual(codec, "aac")
        self.assertEqual(rate, 48000)

    def test_intermediates_are_not_normalised(self):
        src = self.make_source("narr-source.mkv", 0.05)
        before = integrated_lufs(src)
        cut = self.dir / "narration-cut.wav"
        mm.cut_audio(src, 0.0, 10.0, cut)
        self.assertAlmostEqual(integrated_lufs(cut), before, delta=0.5, msg="the narration cut must keep its level")
        self.assertGreater(abs(integrated_lufs(cut) - TARGET), TOLERANCE, "intermediates must not be normalised to -16")


if __name__ == "__main__":
    unittest.main(verbosity=2)
