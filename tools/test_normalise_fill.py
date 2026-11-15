"""Local test for the face-normalisation edge fill in tools/make_module.py. No fal, no ElevenLabs, no face model.

A synthetic video has a blue background and a green edge (so copied edge pixels would show as green streaks).
The warp zooms out and shifts the frame, so strips at the edges are uncovered. Those strips must be the background
colour, not green. Run: python tools/test_normalise_fill.py
"""
import shutil, sys, tempfile, unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402

W, H, FRAMES = 320, 400, 20
BLUE = (150, 40, 40)     # BGR background
GREEN = (0, 255, 0)      # BGR edge colour that replicate would copy into the streaks


def make_video(path):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 25, (W, H))
    for _ in range(FRAMES):
        frame = np.zeros((H, W, 3), np.uint8)
        frame[:, :] = BLUE
        frame[:2, :] = GREEN
        frame[-2:, :] = GREEN
        frame[:, :2] = GREEN
        frame[:, -2:] = GREEN
        frame[150:250, 120:200] = (60, 180, 230)   # a small "face" block in the middle
        writer.write(frame)
    writer.release()


class FillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = Path(tempfile.mkdtemp(prefix="normalise_fill_"))
        cls.src = cls.dir / "src.avi"
        make_video(cls.src)
        # Face is smaller in the source (140 px) than the reference (100 px): a zoom out, so edges are uncovered.
        cls.track = [(160.0, 200.0, 140.0)] * FRAMES
        cls.ref = (160.0, 200.0, 100.0)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def normalised(self, fill):
        dst = self.dir / f"norm-{fill[0]:.0f}.mp4"
        mm.normalise_piece(self.src, dst, self.track, self.ref, fill=fill)
        self.assertTrue(dst.exists())
        cap = cv2.VideoCapture(str(dst))
        ok, frame = cap.read()
        cap.release()
        self.assertTrue(ok)
        return frame.astype(np.int32)

    def test_background_colour_is_sampled(self):
        colour = mm.background_colour(self.src)
        self.assertTrue(np.allclose(colour, BLUE, atol=6), colour)

    def test_uncovered_edges_are_filled_not_streaked(self):
        frame = self.normalised(BLUE)
        strips = {"left": frame[:, :20], "right": frame[:, -20:], "top": frame[:20, :], "bottom": frame[-20:, :]}
        for name, strip in strips.items():
            mean = strip.reshape(-1, 3).mean(axis=0)
            self.assertTrue(np.allclose(mean, BLUE, atol=12), f"{name} edge is {mean.round()}, expected the fill colour")
            # Replicate would leave green streaks: a clearly green share of pixels in the strip.
            green = (strip[:, :, 1] - strip[:, :, 0] > 120).mean()
            self.assertLess(green, 0.02, f"{name} edge still has green streaks ({green:.1%})")

    def test_face_is_still_in_the_frame(self):
        frame = self.normalised(BLUE)
        centre = frame[H // 2, W // 2]
        self.assertTrue(np.allclose(centre, (60, 180, 230), atol=25), f"centre is {centre}, face block missing")


if __name__ == "__main__":
    unittest.main(verbosity=2)
