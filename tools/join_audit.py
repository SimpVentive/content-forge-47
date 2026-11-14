"""Audit of a finished module video.

For every frame: raw change from the frame before (flags above 3x the median).
Ghosting: a dissolve shows as a high pixel variance across a short window, so frames with high window variance are
flagged. Straight cuts are excluded from the ghost check (a cut is not a dissolve).
For every join: face distance and body distance, reported separately.
  - face distance: centre and face size, from the face landmarks of the frame before and the frame after the join
  - body distance: mean pixel difference below the chin (hands, shoulders, shirt); the mouth is left out.
Contact sheet per join: 5 frames either side, the join frame outlined in green.
"""
import json, pathlib, sys
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = str(ROOT / "public" / "mediapipe" / "face_landmarker.task")
SMALL = (155, 232)


def read_all(path, size=SMALL):
    cap = cv2.VideoCapture(str(path))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(cv2.resize(f, size))
    cap.release()
    return out


def face_of(lm, frame_full):
    H, W = frame_full.shape[:2]
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(frame_full, cv2.COLOR_BGR2RGB))))
    if not res.face_landmarks:
        return None, None
    p = np.array([(q.x * W, q.y * H) for q in res.face_landmarks[0]])
    centre = (p[10] + p[152]) / 2.0
    fh = float(np.hypot(*(p[10] - p[152])))
    return np.array([centre[0], centre[1], fh]), p


def read_full_at(path, index):
    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, index))
    ok, f = cap.read()
    cap.release()
    return f if ok else None


def join_distances(video, frame_index, lm):
    """Face and body distance across one join (the frame before and the frame after the join)."""
    before = read_full_at(video, frame_index - 1)
    after = read_full_at(video, frame_index + 1)
    if before is None or after is None:
        return {"face_distance": None, "body_distance": None}
    fa, pa = face_of(lm, before)
    fb, pb = face_of(lm, after)
    if fa is None or fb is None:
        face = None
    else:
        face = float((abs(fa[0] - fb[0]) + abs(fa[1] - fb[1]) + abs(fa[2] - fb[2])) / fa[2])
    H = before.shape[0]
    chin_y = int(((pa[152][1] if pa is not None else H * 0.5)) + 0.03 * H)
    chin_y = min(max(chin_y, 0), H - 1)
    a = cv2.resize(before[chin_y:], SMALL).astype(np.float32)
    b = cv2.resize(after[chin_y:], SMALL).astype(np.float32)
    body = float(np.mean(np.abs(a - b)))
    return {"face_distance": round(face, 4) if face is not None else None, "body_distance": round(body, 2)}


def audit(video, join_times, sheet_dir=None, tag="audit", cut_joins=None):
    """join_times: seconds at each join; cut_joins: True for straight cuts (same length as join_times)."""
    cut_joins = cut_joins or [False] * len(join_times)
    fr = read_all(video)
    x = np.stack(fr).astype(np.int16)
    change = np.zeros(len(fr))
    change[1:] = np.abs(x[1:] - x[:-1]).mean(axis=(1, 2, 3))
    median = float(np.median(change[1:]))
    spikes = [int(i) for i in np.nonzero(change > 3 * median)[0] if i > 0]

    join_frames = [int(round(t * 25.0)) for t in join_times]
    near_cut = np.zeros(len(fr), bool)
    for f, is_cut in zip(join_frames, cut_joins):
        if is_cut:
            near_cut[max(0, f - 4): f + 5] = True
    win = 5
    var = np.zeros(len(fr))
    for i in range(len(fr)):
        a, b = max(0, i - win // 2), min(len(fr), i + win // 2 + 1)
        var[i] = x[a:b].astype(np.float32).var(axis=0).mean()
    var_med = float(np.median(var))
    ghosts = [int(i) for i in np.nonzero((var > 3 * var_med) & (~near_cut))[0]]

    opts = vision.FaceLandmarkerOptions(base_options=mp_tasks.BaseOptions(model_asset_path=MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    joins = []
    for k, (t, f, is_cut) in enumerate(zip(join_times, join_frames, cut_joins)):
        d = join_distances(video, f, lm)
        joins.append({"join": k + 1, "at_s": round(t, 2), "frame": f, "mode": "cut" if is_cut else "crossfade",
                      "change_at_join": round(float(change[max(0, f - 1): f + 2].max()), 2),
                      "change_at_join_vs_median": round(float(change[max(0, f - 1): f + 2].max()) / median, 2) if median else None,
                      **d})
        if sheet_dir is not None:
            sheet_dir.mkdir(parents=True, exist_ok=True)
            lo, hi = max(0, f - 5), min(len(fr), f + 6)
            tiles = []
            for i in range(lo, hi):
                tile = fr[i].copy()
                cv2.putText(tile, str(i), (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                if i == f:
                    cv2.rectangle(tile, (0, 0), (tile.shape[1] - 1, tile.shape[0] - 1), (0, 255, 0), 2)
                tiles.append(tile)
            cv2.imwrite(str(sheet_dir / f"{tag}-join{k + 1}-frame{f}.png"), np.hstack(tiles))
    lm.close()
    return {"frames": len(fr), "median_frame_change": round(median, 2),
            "spike_frames_over_3x": spikes, "spike_count": len(spikes),
            "ghost_frames_over_3x_variance": ghosts, "ghost_count": len(ghosts),
            "ghost_check_excludes_cuts": True, "joins": joins,
            "max_change_at_joins": round(max(j["change_at_join"] for j in joins), 2) if joins else None}


if __name__ == "__main__":
    video = pathlib.Path(sys.argv[1])
    times = [float(t) for t in sys.argv[2].split(",")] if len(sys.argv) > 2 and sys.argv[2] else []
    cuts = [c == "cut" for c in sys.argv[3].split(",")] if len(sys.argv) > 3 and sys.argv[3] else None
    tag = sys.argv[4] if len(sys.argv) > 4 else "audit"
    sheets = ROOT / "docs" / "screenshots" / "joins"
    res = audit(video, times, sheets, tag, cuts)
    print(json.dumps({k: v for k, v in res.items() if k not in ("spike_frames_over_3x", "ghost_frames_over_3x_variance")}, indent=1))
