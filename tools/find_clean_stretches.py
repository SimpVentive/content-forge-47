"""Find clean stretches for rest-pose base clips in a source video.

Clean frame: plain blue background, no light slide or inset panel, no teal slide text, presenter's face found.
The ISB logo is outside the head-and-shoulders crop, so it is cropped out.
Rest pose (approximate): a still head and little movement in the body over the stretch.
Writes a JSON report next to the video path given.
"""
import json, pathlib, sys
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = str(ROOT / "public" / "mediapipe" / "face_landmarker.task")
CLASSIFY_EVERY = 15      # frames: 2 per second at 30 fps
MOTION_EVERY = 6         # frames: 5 per second for the body motion
MIN_CLIP_S = 10.0
MAX_CLIP_S = 30.0
POSE_SAME = 12.0   # mean grey difference between the first and last body frames of a clip
CROP = (330, 0, 680, 1080)  # x0, y0, x1, y1 on the 1920x1080 source: head and shoulders, clear of the logo (x > 1700)


def classify(frame):
    """Clean-background measures. The logo (top right, x > 1700) is excluded; slides and insets sit in the side
    margins, so light panels are measured there (the presenter's light shirt is in the middle and is not counted)."""
    region = frame[:, :1700]
    small = cv2.resize(region, (425, 270))
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    b, g, r = [small[..., i].astype(int) for i in range(3)]
    blue_bg = (b > 90) & (r < 90) & (g < 110) & (b > r + 40)
    light = (hsv[..., 2] > 200) & (hsv[..., 1] < 60)
    teal = (g > 150) & (b > 150) & (r < 120) & (np.abs(g - b) < 60)
    W = small.shape[1]
    margins = np.zeros(small.shape[:2], bool)
    margins[:, : int(0.2 * W)] = True
    margins[:, int(0.8 * W):] = True
    # Slide text, insets and panels sit to the right of the presenter: any non-background pixels there mean slide content.
    zone = frame[:, 1000:1700]
    zb, zg, zr = [zone[..., i].astype(int) for i in range(3)]
    zone_blue = (zb > 90) & (zr < 90) & (zg < 110) & (zb > zr + 40)
    return {"blue": float(blue_bg[margins].mean()), "light": float(light[margins].mean()), "teal": float(teal.mean()),
            "slide_zone": float((~zone_blue).mean())}


OUT_JSON = str(ROOT / "docs" / "screenshots" / "clean-stretches.json")


def main(src, out_json=None):
    global OUT_JSON
    if out_json:
        OUT_JSON = out_json
    src = pathlib.Path(src)
    cap = cv2.VideoCapture(str(src))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    opts = vision.FaceLandmarkerOptions(base_options=mp_tasks.BaseOptions(model_asset_path=MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    x0, y0, x1, y1 = CROP
    rows = []   # per classified frame
    motion = {}  # per motion frame: body motion value
    body_imgs = {}
    prev_body = None
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % CLASSIFY_EVERY == 0:
            c = classify(f)
            H, W = f.shape[:2]
            res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))))
            face = None
            if res.face_landmarks:
                p = np.array([(q.x * W, q.y * H) for q in res.face_landmarks[0]])
                fh = float(np.hypot(*(p[10] - p[152])))
                c_ = (p[10] + p[152]) / 2
                face = [float(c_[0]), float(c_[1]), fh]
            clean = bool(c["blue"] > 0.6 and c["light"] < 0.02 and c["slide_zone"] < 0.006 and face is not None)
            rows.append({"t": round(i / fps, 2), "clean": clean, "face": face, **{k: round(v, 4) for k, v in c.items()}})
        if i % MOTION_EVERY == 0:
            body = cv2.cvtColor(cv2.resize(f[int(y0 + 0.55 * (y1 - y0)):y1, x0:x1], (120, 90)), cv2.COLOR_BGR2GRAY).astype(np.float32)
            if prev_body is not None:
                motion[round(i / fps, 2)] = float(np.mean(np.abs(body - prev_body)))
            prev_body = body
            body_imgs[round(i / fps, 2)] = body
        i += 1
    cap.release()
    lm.close()

    # Clean runs (contiguous classified frames that are clean)
    runs, start = [], None
    for k, r in enumerate(rows):
        if r["clean"] and start is None:
            start = k
        if (not r["clean"] or k == len(rows) - 1) and start is not None:
            end = k if not r["clean"] else k + 1
            runs.append((rows[start]["t"], rows[end - 1]["t"]))
            start = None
    clean_seconds = sum(e - s for s, e in runs)

    # Rest-pose check per run: head still and little body motion
    def run_stats(s, e):
        faces = [r["face"] for r in rows if s <= r["t"] <= e and r["face"] is not None]
        fh = np.median([f[2] for f in faces]) if faces else 1.0
        centre_jitter = float(np.std([f[0] for f in faces]) / fh) if faces else 9.0
        mot = [v for t, v in motion.items() if s <= t <= e]
        return {"head_jitter": round(centre_jitter, 4), "body_motion": round(float(np.median(mot)), 2) if mot else None}

    run_report = []
    for s, e in runs:
        st = run_stats(s, e)
        run_report.append({"start_s": s, "end_s": e, "seconds": round(e - s, 1), **st})

    # Rest-pose clips: 10-30 s windows inside clean runs, where the first and last frames show the same pose
    # (body image nearly the same) and the head is still.
    times = sorted(body_imgs)
    clips = []
    for rr in run_report:
        if rr["seconds"] < MIN_CLIP_S:
            continue
        t = rr["start_s"]
        while t + MIN_CLIP_S <= rr["end_s"] + 1e-6:
            found = None
            for length in np.arange(MIN_CLIP_S, min(MAX_CLIP_S, rr["end_s"] - t) + 1e-6, 1.0):
                e = t + length
                st = [x for x in times if abs(x - t) < 0.11]
                en = [x for x in times if abs(x - e) < 0.11]
                if not st or not en:
                    continue
                a, b = body_imgs[st[0]], body_imgs[en[0]]
                pose_diff = float(np.mean(np.abs(a - b)))
                faces = [r["face"] for r in rows if t <= r["t"] <= e and r["face"] is not None]
                fh = np.median([f[2] for f in faces]) if faces else 1.0
                jitter = float(np.std([f[0] for f in faces]) / fh) if faces else 9.0
                if pose_diff < POSE_SAME and jitter < 0.05:
                    found = {"start_s": round(t, 1), "end_s": round(e, 1), "length_s": round(length, 1),
                             "start_end_pose_diff": round(pose_diff, 2), "head_jitter": round(jitter, 4)}
            if found:
                clips.append(found)
                t = found["end_s"]
            else:
                t += 1.0
    clean_clips = clips
    result = {"source": str(src), "clean_seconds_total": round(clean_seconds, 1),
              "clean_runs": run_report, "rest_pose_clips": clean_clips, "rest_pose_clip_count": len(clean_clips),
              "note": "Rest pose is approximate (still head, little body motion). Check the clips by eye before using them."}
    out = pathlib.Path(OUT_JSON)
    out.write_text(json.dumps(result, indent=1), "utf8")
    print(json.dumps({k: v for k, v in result.items() if k not in ("clean_runs",)}, indent=1))
    print("clean runs:")
    for rr in run_report:
        print(f"  {rr['start_s']:6.1f} - {rr['end_s']:6.1f} s  ({rr['seconds']} s)  head jitter {rr['head_jitter']}  body motion {rr['body_motion']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
