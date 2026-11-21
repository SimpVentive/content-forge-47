"""Offline check: the trimmed piece keeps its picture and takes its sound from the 44.1 kHz narration.
No fal, no ElevenLabs, no spend.

Run: python tools/test_keep_narration_audio.py
"""
import re, shutil, subprocess, sys, tempfile, unittest, wave

import cv2
import numpy as np
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


def _onsets(envelope, threshold, rate, min_gap):
    above = envelope > threshold
    starts = np.flatnonzero(above & ~np.r_[False, above[:-1]])
    out, last = [], -1e9
    for i in starts:
        t = i / rate
        if t - last > min_gap:
            out.append(t)
            last = t
    return out


class ClickSyncTests(unittest.TestCase):
    """A flash and a click at known times must still line up in the final file."""

    CLICKS = [1.0, 2.0, 3.0, 4.0, 5.0]
    FPS = 25
    SECONDS = 6
    RATE = 44100

    def test_click_track_stays_in_sync_in_the_final_file(self):
        dir_ = Path(tempfile.mkdtemp(prefix="click_sync_"))
        try:
            # Picture: black, with one white frame at each click time (a 30 ms 1 kHz tone is played at the same time).
            picture = dir_ / "clicks.avi"
            writer = cv2.VideoWriter(str(picture), cv2.VideoWriter_fourcc(*"MJPG"), self.FPS, (160, 120))
            flash_frames = {round(t * self.FPS) for t in self.CLICKS}
            for i in range(self.SECONDS * self.FPS):
                writer.write(np.full((120, 160, 3), 255 if i in flash_frames else 0, np.uint8))
            writer.release()
            samples = np.zeros(self.SECONDS * self.RATE, np.float32)
            for t in self.CLICKS:
                start, n = int(t * self.RATE), int(0.03 * self.RATE)
                samples[start:start + n] = 0.5 * np.sin(2 * np.pi * 1000 * np.arange(n) / self.RATE)
            wav = dir_ / "clicks.wav"
            with wave.open(str(wav), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(self.RATE)
                w.writeframes((samples * 32767).astype(np.int16).tobytes())
            # The intermediate the pipeline makes: picture encoded, sound as PCM in Matroska.
            src = dir_ / "clicks.mkv"
            run_ff("-i", str(picture), "-i", str(wav), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
                   "-c:a", "pcm_s16le", "-shortest", str(src))
            out = dir_ / "clicks-final.mp4"
            mm.final_encode(src, out)

            # The sound of the final file, read back at 44.1 kHz mono.
            raw = subprocess.run([FF, "-v", "error", "-i", str(out), "-map", "0:a:0", "-f", "s16le", "-ac", "1",
                                  "-ar", str(self.RATE), "-"], capture_output=True).stdout
            audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
            envelope = np.convolve(np.abs(audio), np.ones(220) / 220, mode="same")  # about 5 ms
            heard = _onsets(envelope, 0.2 * envelope.max(), self.RATE, 0.5)

            # The picture of the final file: the time of the first frame of each white flash.
            cap = cv2.VideoCapture(str(out))
            fps = cap.get(cv2.CAP_PROP_FPS) or self.FPS
            seen, index = [], 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                seen.append(frame.mean() > 100)
                index += 1
            cap.release()
            flashes = [i / fps for i in range(1, len(seen)) if seen[i] and not seen[i - 1]]

            self.assertEqual(len(heard), len(self.CLICKS), f"clicks heard: {heard}")
            self.assertEqual(len(flashes), len(self.CLICKS), f"flashes seen: {flashes}")
            for h, f, t in zip(heard, flashes, self.CLICKS):
                self.assertLess(abs(h - t), 0.05, f"click at {h:.3f}s, expected {t}s")
                self.assertLess(abs(f - t), 0.05, f"flash at {f:.3f}s, expected {t}s")
                self.assertLess(abs(h - f), 0.05, f"sound {h:.3f}s and picture {f:.3f}s are out of step")

            audio_check = mm.measure_audio(out)
            self.assertLessEqual(abs(audio_check["drift_s"]), 0.1, f"duration drift: {audio_check}")
            self.assertGreaterEqual(audio_check["sample_rate"], 44100)
        finally:
            shutil.rmtree(dir_, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
