"""Offline check: the trimmed piece keeps its picture and takes its sound from the 44.1 kHz narration.
No fal, no ElevenLabs, no spend.

Run: python tools/test_keep_narration_audio.py
"""
import re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402

FF = mm.FF


def run_ff(*args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


def header(path):
    text = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    rate = re.search(r"Audio:.*?(\d{4,6}) Hz", text)
    codec = re.search(r"Audio: (\w+)", text)
    duration = re.search(r"Duration: (\d+):(\d+):([\d.]+)", text)
    seconds = int(duration.group(1)) * 3600 + int(duration.group(2)) * 60 + float(duration.group(3)) if duration else None
    return {
        "audio_rate": int(rate.group(1)) if rate else None,
        "audio_codec": codec.group(1) if codec else None,
        "has_video": bool(re.search(r"Video:", text)),
        "seconds": seconds,
    }


class KeepNarrationAudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = Path(tempfile.mkdtemp(prefix="keep_narration_"))
        # A normalised piece: 6 s of picture and no sound (the sound comes from the narration).
        cls.piece = cls.dir / "piece.mp4"
        run_ff("-f", "lavfi", "-i", "testsrc2=size=160x120:rate=25", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=16000",
               "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", str(cls.piece))
        # The narration: 10 s at 44.1 kHz.
        cls.narration = cls.dir / "narration.mp3"
        run_ff("-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100", "-t", "10", "-c:a", "libmp3lame", str(cls.narration))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def test_trimmed_piece_has_44_1k_sound_and_the_right_length(self):
        dst = self.dir / "trim-keep.mkv"
        # The piece sits at 2 s to 8 s of the narration. We keep 0.5 s to 3.0 s of the piece.
        mm.trim_piece_with_narration(self.piece, self.narration, 2.0, 8.0, 0.5, 3.0, dst)
        info = header(dst)
        self.assertTrue(dst.exists())
        self.assertTrue(info["has_video"], "the picture must be kept")
        self.assertEqual(info["audio_rate"], 44100, f"the sound must come from the narration: {info}")
        self.assertEqual(info["audio_codec"], "pcm_s16le", f"the intermediate sound must be uncompressed: {info}")
        self.assertAlmostEqual(info["seconds"], 2.5, delta=0.15)

    def test_the_narration_piece_is_cut_from_the_right_place(self):
        dst = self.dir / "trim-place.mkv"
        mm.trim_piece_with_narration(self.piece, self.narration, 2.0, 8.0, 0.0, 6.0, dst)
        self.assertAlmostEqual(header(dst)["seconds"], 6.0, delta=0.15)
        self.assertFalse(list(self.dir.glob("*-narration.wav.tmp")), "no stray temporary files")

    def test_the_old_16k_piece_is_not_the_result(self):
        dst = self.dir / "trim-old-check.mkv"
        mm.trim_piece_with_narration(self.piece, self.narration, 2.0, 8.0, 0.0, 3.0, dst)
        self.assertNotEqual(header(dst)["audio_rate"], 16000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
