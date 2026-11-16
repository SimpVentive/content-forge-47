"""Lip-sync score: mouth opening per frame against narration loudness, in windows.

For each window (default 2 s = 50 frames at 25 fps):
  - mouth opening per frame: distance between the inner upper and lower lip (MediaPipe landmarks 13 and 14),
    divided by face height (landmarks 10 to 152), so it does not depend on how big the face is.
  - loudness per frame: RMS of the narration audio over that frame's 40 ms.
  - score: Pearson r between the two inside the window. Near 1 = mouth opens with the voice.
  - best lag: the frame offset (within +/-5 frames, i.e. 0.2 s) where the correlation is highest.
    A large best lag, with a low lag-0 score, means the mouth and the voice are out of step.

Usage: python tools/lipsync_score.py <video.mp4> [window_seconds]
"""
import os, subprocess, sys, tempfile, wave
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402  (for the face model path and the ffmpeg binary)

FPS = 25.0
MAX_LAG = 5


def mouth_opening(video):
    opts = vision.FaceLandmarkerOptions(base_options=mp_tasks.BaseOptions(model_asset_path=mm.MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(str(video))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        H, W = f.shape[:2]
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))))
        if not res.face_landmarks:
            out.append(np.nan)
            continue
        p = np.array([(q.x * W, q.y * H) for q in res.face_landmarks[0]])
        face_h = np.hypot(*(p[10] - p[152]))
        out.append(np.hypot(*(p[13] - p[14])) / face_h)
    cap.release()
    lm.close()
    return np.array(out)


def loudness_per_frame(video, n_frames):
    tmp = Path(tempfile.mkdtemp(prefix="lipsync_")) / "audio.wav"
    subprocess.run([mm.FF, "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
                    "-sample_fmt", "s16", str(tmp)], check=True)
    with wave.open(str(tmp)) as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    tmp.unlink(missing_ok=True)
    hop = sr / FPS
    out = []
    for i in range(n_frames):
        seg = data[int(round(i * hop)): int(round((i + 1) * hop))]
        out.append(float(np.sqrt(np.mean(seg ** 2))) if seg.size else 0.0)
    return np.array(out)


def pearson(a, b):
    if len(a) < 5 or np.std(a) < 1e-9 or np.std(b) < 1e-9:
        return None
    return float(np.corrcoef(a, b)[0, 1])


def main():
    video = Path(sys.argv[1])
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    mouth = mouth_opening(video)
    loud = loudness_per_frame(video, len(mouth))
    n = len(mouth)
    win = int(round(seconds * FPS))
    print(f"{video.name}: {n} frames, {n / FPS:.2f} s, faces found in {np.sum(~np.isnan(mouth))} frames")
    print(f"{'window':>12}  {'r (lag 0)':>9}  {'best lag':>8}  {'r at best':>9}  note")
    rows = []
    for start in range(0, n, win):
        idx = np.arange(start, min(start + win, n))
        m, l = mouth[idx], loud[idx]
        ok = ~np.isnan(m)
        t0, t1 = idx[0] / FPS, (idx[-1] + 1) / FPS
        label = f"{t0:5.2f}-{t1:5.2f}s"
        if ok.sum() < 0.8 * len(idx):
            rows.append((label, None, None, None, "no face for most frames"))
            print(f"{label:>12}  {'-':>9}  {'-':>8}  {'-':>9}  no face for most frames")
            continue
        r0 = pearson(m[ok], l[ok])
        best = None
        for lag in range(-MAX_LAG, MAX_LAG + 1):
            seg_m = mouth[idx[0]: idx[-1] + 1]
            seg_l = loud[idx[0]: idx[-1] + 1]
            if lag >= 0:
                mm_, ll_ = seg_m[: len(seg_m) - lag], seg_l[lag:]
            else:
                mm_, ll_ = seg_m[-lag:], seg_l[: len(seg_l) + lag]
            okl = ~np.isnan(mm_)
            r = pearson(mm_[okl], ll_[okl]) if okl.sum() >= 5 else None
            if r is not None and (best is None or r > best[1]):
                best = (lag, r)
        note = "silent: little to match" if np.std(l) < 0.01 else ""
        rows.append((label, r0, best[0] if best else None, best[1] if best else None, note))
        r0s = f"{r0:9.2f}" if r0 is not None else f"{'-':>9}"
        bl = f"{best[0]:+8d}" if best else f"{'-':>8}"
        brs = f"{best[1]:9.2f}" if best else f"{'-':>9}"
        print(f"{label:>12}  {r0s}  {bl}  {brs}  {note}")
    scored = [r for r in rows if r[1] is not None]
    overall0 = pearson(mouth[~np.isnan(mouth)], loud[~np.isnan(mouth)])
    print(f"\noverall r (lag 0, all frames): {overall0:.2f}" if overall0 is not None else "\noverall: not measurable")
    print(f"mean window r (lag 0): {np.mean([r[1] for r in scored]):.2f} over {len(scored)} windows")
    print("weakest windows (lowest lag-0 r):")
    for r in sorted(scored, key=lambda r: r[1])[:3]:
        print(f"  {r[0]}  r={r[1]:.2f}  best lag {r[2]:+d} (r {r[3]:.2f})" if r[2] is not None else f"  {r[0]}  r={r[1]:.2f}")


if __name__ == "__main__":
    main()
