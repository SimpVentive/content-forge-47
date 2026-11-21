#!/usr/bin/env python
"""Reusable lip-sync module pipeline.

    python tools/make_module.py --trainer harish --script script.txt --out out.mp4 [--workers 4] [--yes] [--upscale]

Steps: script -> ElevenLabs audio with timestamps -> split at sentence boundaries into equal pieces of 40 s or less
-> pick a base clip and start point for each piece -> LatentSync (pieces in parallel) -> join with a short cross-fade
-> checks -> proof copy with the burned-in "AI-generated" label.

Trainer config (trainers/<name>/):
    voice.json   ElevenLabs voice_id and settings
    clips/       one or more base video clips of the real person

Keys are read from .env (ELEVENLABS_API_KEY, fal_key). They are never printed, logged or written to a report.
Each provider call is made once. A failed piece is retried once, only after a network error. A failed piece never
restarts the module. Finished pieces are cached: a re-run with the same text and clips costs nothing for them.
"""
import argparse, base64, concurrent.futures as cf, hashlib, json, os, pathlib, re, shutil, subprocess, sys, time, urllib.error, urllib.request

import cv2
import fal_client
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRAINERS = ROOT / "trainers"
ENV = ROOT / ".env"
MODEL = str(ROOT / "public" / "mediapipe" / "face_landmarker.task")
def _find_ffmpeg():
    """ffmpeg from FFMPEG_PATH, else the imageio-ffmpeg package, else the system PATH."""
    import shutil
    env = os.environ.get("FFMPEG_PATH")
    if env and pathlib.Path(env).exists():
        return env
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    found = shutil.which("ffmpeg")
    if found:
        return found
    sys.exit("ffmpeg not found. Set FFMPEG_PATH, or install imageio-ffmpeg.")


FF = _find_ffmpeg()
# The lip-sync provider (name, endpoint, price per second, minimum seconds per clip) is read from one shared file,
# the same one the server (supabase/functions/_shared/module-jobs.ts) and the app (src/lib/moduleJobs.ts) read.
PROVIDER = json.loads((ROOT / "supabase" / "functions" / "_shared" / "lipsync-provider.json").read_text("utf8"))
LIPSYNC_ENDPOINT = PROVIDER["endpoint"]
PRICE_PER_SECOND = PROVIDER["price_per_second_usd"]
BILLING_MINIMUM_S = PROVIDER["minimum_seconds"]
PIECE_MAX = 40.0          # never over the billing minimum, so no piece is billed for more than it uses
LABEL_FILTER = (r"drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='AI-generated':fontcolor=white:fontsize=28:"
                "box=1:boxcolor=black@0.6:x=12:y=h-th-16")
FADE_FRAMES = 9               # 8-10 frame crossfade at every join
FADE = FADE_FRAMES / 25.0
ELEVEN_MODEL = "eleven_multilingual_v2"
SMALL = (78, 116)         # size used for pose matching


# ---------- configuration ----------
def read_env(name):
    """A key from the environment (the worker's secret store), else from .env. Never printed."""
    env_value = os.environ.get(name) or os.environ.get(name.upper())
    if env_value:
        return env_value
    if not ENV.exists():
        sys.exit(f"{name} is not set in the environment or .env")
    for line in ENV.read_text("utf8").splitlines():
        n, _, v = line.partition("=")
        if n.strip().lower() == name.lower():
            v = v.strip().strip('"').strip("'")
            if v:
                return v
    sys.exit(f"{name} is not set in .env")


def load_trainer(name):
    """A trainer by name (trainers/<name>/), or by folder path when --trainer-dir is given."""
    folder = pathlib.Path(name) if pathlib.Path(name).is_dir() else TRAINERS / name
    voice_path = folder / "voice.json"
    clips_dir = folder / "clips"
    if not voice_path.exists():
        sys.exit(f"Missing {voice_path}")
    voice = json.loads(voice_path.read_text("utf8"))
    clips = sorted(clips_dir.glob("*.mp4")) if clips_dir.exists() else []
    if not clips:
        sys.exit(f"No base clips (.mp4) in {clips_dir}")
    return voice, clips, folder / "cache"


def sha(*parts):
    h = hashlib.sha256()
    for p in parts:
        h.update(json.dumps(p, sort_keys=True, default=str).encode("utf8"))
    return h.hexdigest()[:20]


# ---------- media helpers ----------
def media_duration(path):
    proc = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", proc.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0


def ffmpeg(*args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


def cut_audio(src, start, end, dst):
    # WAV (16-bit, 44.1 kHz): lossless, so the voice is only encoded once, at the end.
    ffmpeg("-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(src), "-c:a", "pcm_s16le", "-ar", "44100", str(dst))


def read_frames(path, step=1, size=(620, 930)):
    cap = cv2.VideoCapture(str(path))
    frames, i = [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % step == 0:
            frames.append(cv2.resize(f, size))
        i += 1
    cap.release()
    return frames


def frame_at(clip, seconds):
    """A frame of the clip at this time, at the small size used for pose matching."""
    cap = cv2.VideoCapture(str(clip))
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, seconds) * 1000.0)
    ok, f = cap.read()
    cap.release()
    return cv2.resize(f, SMALL) if ok else None


# ---------- ElevenLabs ----------
def eleven_tts(text, voice, key):
    body = {"text": text, "model_id": voice.get("model_id", ELEVEN_MODEL), "voice_settings": voice["settings"]}
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode("utf8"), headers={"xi-api-key": key, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as err:
        sys.exit(f"ElevenLabs refused the request (HTTP {err.code}): {err.read()[:200].decode('utf8', 'replace')}")
    return base64.b64decode(data["audio_base64"]), data.get("alignment") or {}


# ---------- script to pieces ----------
def break_points(alignment):
    """(time, is_sentence_end) at the end of each sentence and each word."""
    chars = alignment.get("characters", [])
    ends = alignment.get("character_end_times_seconds", [])
    out = []
    for i, c in enumerate(chars):
        nxt = chars[i + 1] if i + 1 < len(chars) else " "
        if c in ".!?" and nxt in " \n":
            out.append((ends[i], True))
        elif c in " ,;:" and i > 0 and chars[i - 1] not in " ,;:":
            out.append((ends[i - 1], False))
    return out


def plan_pieces(points, total):
    """Smallest number of pieces (from the 40 s minimum) that has a sentence gap at every join."""
    first = max(1, int(np.ceil(total / PIECE_MAX - 1e-9)))
    for n in range(first, first + 4):
        bounds = _plan_with(points, total, n)
        if bounds:
            return bounds
    sys.exit("No sentence breaks give pieces of 20-40 s. Add full stops, or change the script.")


def _plan_with(points, total, n):
    """Pieces of 20-40 s, every join at a sentence gap, cuts as close as possible to the even split.

    Chooses all cuts together (dynamic programming), so an early cut can't leave a later piece over 40 s.
    """
    MIN_PIECE = 20.0
    nodes = [0.0] + sorted(t for t, is_sentence in points if is_sentence and MIN_PIECE <= t <= total - MIN_PIECE) + [total]
    if n == 1:
        return [0.0, total] if total <= PIECE_MAX else None
    INF = float("inf")
    m = len(nodes)
    # cost[k][j]: best total deviation for k cuts, the last one at node j
    cost = [[INF] * m for _ in range(n)]
    back = [[-1] * m for _ in range(n)]
    cost[0][0] = 0.0
    for k in range(1, n):
        target = total * k / n
        for j in range(1, m - 1):
            for i in range(m):
                if cost[k - 1][i] == INF:
                    continue
                length = nodes[j] - nodes[i]
                if not (MIN_PIECE <= length <= PIECE_MAX):
                    continue
                c = cost[k - 1][i] + abs(nodes[j] - target)
                if c < cost[k][j]:
                    cost[k][j] = c
                    back[k][j] = i
    best_j, best_c = -1, INF
    for j in range(1, m - 1):
        last = total - nodes[j]
        if cost[n - 1][j] < INF and MIN_PIECE <= last <= PIECE_MAX and cost[n - 1][j] < best_c:
            best_j, best_c = j, cost[n - 1][j]
    if best_j < 0:
        return None
    cut_nodes, j = [], best_j
    for k in range(n - 1, 0, -1):
        cut_nodes.append(j)
        j = back[k][j]
    cuts = [nodes[x] for x in reversed(cut_nodes)]
    bounds = [0.0] + cuts + [total]
    return bounds


# ---------- base clips ----------
def pick_clip(clips, previous_clip):
    if len(clips) == 1:
        return clips[0], True
    choices = [c for c in clips if c != previous_clip]
    return choices[0], False


def virtual_segments(offset, length, clip_len):
    """How the base piece plays: from `offset`, forward through the clip, then backward, repeating.

    Returns segments (clip_start, duration, reversed) that add up to `length`.
    """
    period = 2.0 * clip_len
    segs, u, remaining = [], offset, length
    while remaining > 1e-9:
        p = u % period
        if p < clip_len:
            seg = min(clip_len - p, remaining)
            segs.append((p, seg, False))
        else:
            seg = min(period - p, remaining)
            segs.append((period - p - seg, seg, True))
        u += seg
        remaining -= seg
    return segs


def end_clip_time(offset, length, clip_len):
    """Clip time of the last frame of the piece (its pose is what the next piece must continue from)."""
    segs = virtual_segments(offset, length, clip_len)
    start, dur, rev = segs[-1]
    last = start + dur - 1.0 / 25.0
    return last if not rev else start + 1.0 / 25.0


def best_start(clip, length, previous_frame):
    """Start offset in the clip whose frame best matches the pose the previous piece ends on."""
    clip_len = media_duration(clip)
    if previous_frame is None:
        return 0.0
    frames = read_frames(clip, step=2, size=SMALL)
    target = cv2.cvtColor(previous_frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
    best_i, best_d = 0, 1e9
    for i in range(len(frames)):
        d = np.mean(np.abs(cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY).astype(np.float32) - target))
        if d < best_d:
            best_i, best_d = i, d
    return best_i * 2 / 25.0


def make_base_piece(clip, offset, length, dst):
    """Build the base video for one piece exactly as virtual_segments describes it."""
    clip_len = media_duration(clip)
    work_dir = dst.parent
    parts = []
    for k, (start, dur, rev) in enumerate(virtual_segments(offset, length, clip_len)):
        part = work_dir / f"{dst.stem}.seg{k}.mp4"
        vf = ["-vf", "reverse"] if rev else []
        ffmpeg("-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(clip), *vf, "-an",
               "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(part))
        parts.append(part)
    if len(parts) == 1:
        shutil.copy(parts[0], dst)
        return
    lst = work_dir / f"{dst.stem}.txt"
    lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), "utf8")
    ffmpeg("-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(dst))


# ---------- LatentSync ----------
def run_latentsync(video_url, audio_url):
    args = {"video_url": video_url, "audio_url": audio_url}
    try:
        return fal_client.subscribe(LIPSYNC_ENDPOINT, arguments=args, with_logs=False)
    except (ConnectionError, TimeoutError, OSError) as err:
        print(f"    network error ({type(err).__name__}); retrying this piece once", flush=True)
        return fal_client.subscribe(LIPSYNC_ENDPOINT, arguments=args, with_logs=False)


def clip_cost(seconds):
    return round(max(BILLING_MINIMUM_S, seconds) * PRICE_PER_SECOND, 4)


def estimate_for_seconds(seconds):
    """Estimate for a narration of this length: equal pieces of at most PIECE_MAX, each billed by clip_cost.
    Same rule as estimateUsdForSeconds in supabase/functions/_shared/module-jobs.ts, so the two agree."""
    if seconds <= 0:
        return 0.0
    pieces = max(1, int(-(-seconds // PIECE_MAX)))  # ceiling division
    return round(pieces * clip_cost(seconds / pieces), 2)


# ---------- checks ----------
def face_track(path, step=10):
    """Nose position per sampled frame, in face heights (None where no face is found)."""
    opts = vision.FaceLandmarkerOptions(base_options=mp_tasks.BaseOptions(model_asset_path=MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(str(path))
    track, i = [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % step == 0:
            H, W = f.shape[:2]
            res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))))
            if res.face_landmarks:
                p = np.array([(q.x * W, q.y * H) for q in res.face_landmarks[0]])
                fh = np.hypot(*(p[10] - p[152]))
                track.append((p[1] / fh, fh / H))
            else:
                track.append(None)
        i += 1
    cap.release()
    lm.close()
    return track


def face_checks(path, reference=None):
    """Face visible in the piece, and (against the base clip) the same face moving the same way."""
    track = face_track(path)
    found = [t for t in track if t is not None]
    share = len(found) / len(track) if track else 0.0
    sizes = [t[1] for t in found]
    result = {"face_share": round(share, 3), "face_size_share": round(float(np.median(sizes)), 3) if sizes else 0.0}
    if reference is not None:
        ref = face_track(reference)
        pairs = [(a, b) for a, b in zip(track, ref) if a is not None and b is not None]
        dev = float(np.median([np.hypot(*(a[0] - b[0])) for a, b in pairs])) if pairs else 9.0
        result["motion_deviation_from_base"] = round(dev, 4)
        result["ok"] = share >= 0.9 and dev < 0.05
    else:
        result["ok"] = share >= 0.9
    return result


def join_checks(video_path, boundary_times):
    frames = read_frames(video_path, step=1, size=(155, 232))
    diffs = np.array([np.mean(np.abs(frames[i].astype(np.int16) - frames[i - 1].astype(np.int16))) for i in range(1, len(frames))])
    median = float(np.median(diffs)) if len(diffs) else 0.0
    out = []
    for t in boundary_times:
        i = int(round(t * 25))
        window = diffs[max(0, i - 3): i + 3]
        peak = float(window.max()) if len(window) else 0.0
        out.append({"at_s": round(t, 2), "peak_change": round(peak, 2), "hard_cut": bool(median and peak > 3 * median)})
    return out, round(median, 2)



# ---------- face normalisation and join selection ----------
def track_all(path):
    """Face centre and size in every frame: (cx, cy, fh) in pixels, or None where no face is found."""
    opts = vision.FaceLandmarkerOptions(base_options=mp_tasks.BaseOptions(model_asset_path=MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(str(path))
    track = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        H, W = f.shape[:2]
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))))
        if res.face_landmarks:
            p = np.array([(q.x * W, q.y * H) for q in res.face_landmarks[0]])
            c = (p[10] + p[152]) / 2.0
            track.append((float(c[0]), float(c[1]), float(np.hypot(*(p[10] - p[152])))))
        else:
            track.append(None)
    cap.release()
    lm.close()
    return track


def smooth_track(track, window=7):
    """Fills gaps and smooths the track, so the warp does not jitter from frame to frame."""
    arr = np.array([t if t is not None else (np.nan, np.nan, np.nan) for t in track], dtype=float)
    idx = np.arange(len(arr))
    for k in range(3):
        good = ~np.isnan(arr[:, k])
        if good.sum() >= 2:
            arr[:, k] = np.interp(idx, idx[good], arr[good, k])
    kernel = np.ones(window) / window
    out = np.zeros_like(arr)
    for k in range(3):
        padded = np.pad(arr[:, k], window // 2, mode="edge")
        out[:, k] = np.convolve(padded, kernel, mode="valid")
    return out


def background_colour(path, every=10):
    """Median colour of the top 8% of the frame, sampled every few frames. Used to fill the edges a warp uncovers.
    The edges are filled, not copied: copying (replicate) smears the edge pixels into long streaks."""
    cap = cv2.VideoCapture(str(path))
    samples, i = [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % every == 0:
            band = f[:max(1, int(f.shape[0] * 0.08))].reshape(-1, 3)
            samples.append(np.median(band, axis=0))
        i += 1
    cap.release()
    return tuple(float(c) for c in np.median(np.array(samples), axis=0)) if samples else (0.0, 0.0, 0.0)


def normalise_piece(src, dst, track_smooth, ref, fill=(0.0, 0.0, 0.0)):
    """Warp every frame so the face sits at the reference position and size (no zoom drift).
    Edges the warp uncovers are filled with the background colour."""
    rcx, rcy, rfh = ref
    cap = cv2.VideoCapture(str(src))
    tmp = dst.with_name(dst.stem + ".noaudio.avi")
    writer = None
    W = H = 0
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if writer is None:
            H, W = f.shape[:2]
            writer = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"MJPG"), 25, (W, H))
        cx, cy, fh = track_smooth[min(i, len(track_smooth) - 1)]
        sc = rfh / fh
        M = np.array([[sc, 0, rcx - sc * cx], [0, sc, rcy - sc * cy]], dtype=np.float32)
        writer.write(cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                                    borderValue=tuple(float(c) for c in fill)))
        i += 1
    cap.release()
    if writer is not None:
        writer.release()
    # No audio: the trim step takes the sound from the narration, so this file's audio is never used.
    ffmpeg("-i", str(tmp), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-an", str(dst))
    tmp.unlink(missing_ok=True)


def pose_cost(frame_a, frame_b, y_frac):
    """Hand and body pose distance at a join: the frame below the chin (the mouth is left out, it moves with every word)."""
    y0 = int(SMALL[1] * y_frac)
    a = cv2.resize(frame_a, SMALL)[y0:].astype(np.float32)
    b = cv2.resize(frame_b, SMALL)[y0:].astype(np.float32)
    return float(np.mean(np.abs(a - b)))


def lower_half_change(path, y_frac, limit=400):
    """Typical frame-to-frame change below the chin, from a piece (used as the join threshold)."""
    cap = cv2.VideoCapture(str(path))
    prev, changes = None, []
    while len(changes) < limit:
        ok, f = cap.read()
        if not ok:
            break
        small = cv2.resize(f, SMALL)[int(SMALL[1] * y_frac):].astype(np.float32)
        if prev is not None:
            changes.append(float(np.mean(np.abs(small - prev))))
        prev = small
    cap.release()
    return float(np.median(changes)) if changes else 0.0


def last_frame(path):
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, n - 1))
    ok, f = cap.read()
    cap.release()
    return f if ok else None


def first_frame(path):
    cap = cv2.VideoCapture(str(path))
    ok, f = cap.read()
    cap.release()
    return f if ok else None



def read_frame_at(path, index):
    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, index))
    ok, f = cap.read()
    cap.release()
    return f if ok else None


def trim_piece(src, start_s, end_s, dst):
    """Keep video and audio from start_s to end_s (seconds), so they stay in step."""
    ffmpeg("-i", str(src), "-ss", f"{start_s:.4f}", "-to", f"{end_s:.4f}", "-c:v", "libx264", "-pix_fmt", "yuv420p",
           "-crf", "18", "-c:a", "aac", "-b:a", "192k", str(dst))


def trim_piece_with_narration(src, narration, piece_start, piece_end, start_s, end_s, dst):
    """Keep the picture from src, and take the sound from the narration itself, at 44.1 kHz.
    LatentSync returns its audio at 16 kHz mono, which lowers the quality of the voice, so that audio is not kept.
    piece_start and piece_end are where the piece sits in the narration (seconds). start_s and end_s are the part of
    the piece that is kept (seconds from the start of the piece)."""
    # The intermediate is a Matroska file with uncompressed (PCM) sound, so nothing is compressed before the final encode.
    seg = dst.with_name(dst.stem + "-narration.wav")
    cut_audio(narration, piece_start, piece_end, seg)
    ffmpeg("-i", str(src), "-i", str(seg), "-ss", f"{start_s:.4f}", "-to", f"{end_s:.4f}",
           "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
           "-c:a", "pcm_s16le", "-ar", "44100", str(dst))


JOIN_SEARCH = 4   # frames: how far a join may move at either side (a pause is never longer than this in the audio)


def search_join(a_path, b_path, y_frac, a_frames, b_frames):
    """Best pair of join frames: the last kept frame of A (dropping up to JOIN_SEARCH frames) and the first kept
    frame of B (skipping up to JOIN_SEARCH frames). Returns (a_drop, b_skip, cost)."""
    best = (0, 0, float("inf"))
    for drop in range(JOIN_SEARCH + 1):
        fa = read_frame_at(a_path, a_frames - 1 - drop)
        if fa is None:
            continue
        for skip in range(JOIN_SEARCH + 1):
            fb = read_frame_at(b_path, skip)
            if fb is None:
                continue
            cost = pose_cost(fa, fb, y_frac) + 0.5 * drop + 0.5 * skip   # small penalty: keep as much as possible
            if cost < best[2]:
                best = (drop, skip, cost)
    return best


# ---------- main ----------
def assemble_pieces(norm_files, join_plan, joined_tmp):
    """Joins the trimmed pieces into one video at joined_tmp and returns the join centres in seconds.
    A crossfade starts at the end of the earlier clip minus the fade; a cut is a one-frame fade.
    One piece has no join. It is re-encoded with the same settings, because ffmpeg rejects an empty filter graph."""
    # Intermediate: picture as before, sound as PCM. The one AAC encode is in the label step.
    out_args = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "pcm_s16le"]
    if len(norm_files) == 1:
        ffmpeg("-i", str(norm_files[0]), *out_args, str(joined_tmp))
        return []
    lengths_out = [media_duration(p) for p in norm_files]
    inputs = []
    for p in norm_files:
        inputs += ["-i", str(p)]
    filters, chain_v, chain_a = [], "[0:v]", "[0:a]"
    S, join_centres = 0.0, []
    for k in range(1, len(norm_files)):
        fade = join_plan[k - 1]["fade_frames"] / 25.0
        offset = S + lengths_out[k - 1] - fade
        join_centres.append(offset + fade / 2)
        ov, oa = f"[v{k}]", f"[a{k}]"
        filters.append(f"{chain_v}[{k}:v]xfade=transition=fade:duration={fade:.4f}:offset={offset:.4f}{ov}")
        filters.append(f"{chain_a}[{k}:a]acrossfade=d={fade:.4f}{oa}")
        chain_v, chain_a = ov, oa
        S = offset
    ffmpeg(*inputs, "-filter_complex", ";".join(filters), "-map", chain_v, "-map", chain_a, *out_args, str(joined_tmp))
    return join_centres


LOUDNESS_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=7"   # EBU R128: integrated -16 LUFS, true peak -1.5 dBTP, range 7 LU


def final_encode(src, dst):
    """The one encode of the sound, and the last encode of the picture. It burns in the AI-generated label, normalises the
    loudness to -16 LUFS, and encodes the sound once as AAC (192 kbps, 48 kHz). Done here and nowhere else."""
    ffmpeg("-i", str(src), "-vf", LABEL_FILTER, "-af", LOUDNESS_FILTER, "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(dst))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trainer", required=True, help="trainer name, or the trainer folder (--trainer-dir)")
    ap.add_argument("--script", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=4, help="pieces processed at once (default 4)")
    ap.add_argument("--yes", action="store_true", help="run without asking after the cost estimate")
    ap.add_argument("--upscale", action="store_true", help="off by default; no upscaler is configured yet")
    args = ap.parse_args()

    voice, clips, cache_dir = load_trainer(args.trainer)  # a folder path works too
    script = pathlib.Path(args.script).read_text("utf8").strip()
    if not script:
        sys.exit("The script is empty")
    out_path = pathlib.Path(args.out).with_suffix(".mp4")
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    work = cache_dir
    work.mkdir(parents=True, exist_ok=True)
    report = {"trainer": args.trainer, "script_chars": len(script), "started": time.strftime("%Y-%m-%d %H:%M:%S"),
              "voice_id": voice["voice_id"], "settings": voice["settings"], "clips": [c.name for c in clips],
              "workers": args.workers, "pose_match": "base clip (pieces run in parallel)",
              "elevenlabs": {}, "pieces": [], "checks": {}, "costs": {}, "times_s": {}}

    if args.upscale:
        print("--upscale: no upscaler is configured for this pipeline. Nothing was run for it.", flush=True)
        report["upscale"] = "requested, not available (no upscaler configured)"

    el_key = read_env("ELEVENLABS_API_KEY")
    os.environ["FAL_KEY"] = read_env("fal_key")

    # 1. Audio and timestamps (cached by text, voice and settings)
    t0 = time.time()
    tts_key = sha(script, voice["voice_id"], voice["settings"], voice.get("model_id", ELEVEN_MODEL))
    narration = work / f"narration-{tts_key}.mp3"
    align_path = work / f"narration-{tts_key}.json"
    if narration.exists() and align_path.exists():
        alignment = json.loads(align_path.read_text("utf8"))
        report["elevenlabs"]["cached"] = True
    else:
        audio, alignment = eleven_tts(script, voice, el_key)
        narration.write_bytes(audio)
        align_path.write_text(json.dumps(alignment), "utf8")
        report["elevenlabs"]["cached"] = False
    report["elevenlabs"]["characters"] = len(script)
    report["times_s"]["narration"] = round(time.time() - t0, 1)
    total = media_duration(narration)
    report["narration_seconds"] = round(total, 2)

    # 2. Pieces (equal, 40 s or less, cut at sentence breaks)
    bounds = plan_pieces(break_points(alignment), total)
    n = len(bounds) - 1
    lengths = [bounds[i + 1] - bounds[i] for i in range(n)]
    est = sum(clip_cost(L) for L in lengths)
    print(f"Narration {total:.1f} s -> {n} pieces: " + ", ".join(f"{L:.1f}s" for L in lengths), flush=True)
    print(f"Estimated LatentSync cost: ${est:.2f} ({n} clips, at least {BILLING_MINIMUM_S} s billed per clip)", flush=True)
    print(f"ElevenLabs: {len(script)} characters, charged on your plan (check the dashboard for the rate)", flush=True)
    if not args.yes:
        if not sys.stdin.isatty():
            sys.exit("Confirm the estimate with --yes to run.")
        if input("Run now? [y/N] ").strip().lower() != "y":
            sys.exit("Stopped before generating.")
    report["costs"]["estimate_latentsync_usd"] = round(est, 2)

    # 3. Clip and start point for each piece, in order (base clips only, so pieces can run in parallel)
    plans = []
    previous_clip, previous_end_frame = None, None
    for i in range(n):
        s, e = bounds[i], bounds[i + 1]
        length = e - s
        clip, repeat_warning = pick_clip(clips, previous_clip)
        start = best_start(clip, length, previous_end_frame)
        clip_len = media_duration(clip)
        end_t = end_clip_time(start, length, clip_len)
        plans.append({"piece": i, "start_s": s, "end_s": e, "length_s": length, "clip": clip, "clip_start": start,
                      "predicted_end_clip_time": end_t, "repeat_warning": bool(repeat_warning and i > 0)})
        previous_end_frame = frame_at(clip, end_t)
        previous_clip = clip
        print(f"Piece {i}: {s:.1f}-{e:.1f} s, clip {clip.name} start {start:.2f} s, ends on clip time {end_t:.2f} s", flush=True)

    # 4. Process pieces in parallel. Each piece is cached, and a failed piece is retried only by re-running the command.
    def process(plan):
        i = plan["piece"]
        s, e, length, clip, start = plan["start_s"], plan["end_s"], plan["length_s"], plan["clip"], plan["clip_start"]
        key = sha(tts_key, i, round(s, 3), round(e, 3), clip.name, round(start, 3), LIPSYNC_ENDPOINT)
        synced = work / f"piece-{key}.mp4"
        synced_existed = synced.exists()
        v_path = work / f"base-{key}.mp4"
        info = {"piece": i, "start_s": round(s, 2), "end_s": round(e, 2), "length_s": round(length, 2),
                "clip": clip.name, "clip_start_s": round(start, 2), "clip_repeated_for_consecutive_pieces": plan["repeat_warning"]}
        if synced.exists():
            info.update({"cached": True, "cost_usd": 0.0, "seconds_taken": 0.0})
        else:
            a_path = work / f"audio-{key}.wav"
            v_path = work / f"base-{key}.mp4"
            cut_audio(narration, s, e, a_path)
            make_base_piece(clip, start, length, v_path)
            t1 = time.time()
            v_url = fal_client.upload_file(str(v_path))
            a_url = fal_client.upload_file(str(a_path))
            result = run_latentsync(v_url, a_url)
            url = (result.get("video") or {}).get("url")
            if not url:
                raise RuntimeError("no video in the response")
            with urllib.request.urlopen(url, timeout=900) as resp:
                synced.write_bytes(resp.read())
            took = time.time() - t1
            info.update({"cached": False, "cost_usd": clip_cost(length), "seconds_taken": round(took, 1)})
        info["file"] = synced.name
        info["checks"] = face_checks(synced, reference=v_path if v_path.exists() else None)
        info["duration_s"] = round(media_duration(synced), 2)
        print(f"Piece {i} done: cost ${info['cost_usd']:.2f}, {info['seconds_taken']} s"
              f"{' (cached)' if info['cached'] else ''}, face ok={info['checks']['ok']}", flush=True)
        return info, synced

    results, failures = {}, []
    with cf.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(process, p): p["piece"] for p in plans}
        for fut in cf.as_completed(futures):
            i = futures[fut]
            try:
                results[i] = fut.result()
            except Exception as err:
                failures.append({"piece": i, "error": type(err).__name__})
                print(f"Piece {i} failed ({type(err).__name__}). Re-run the same command: only this piece is retried.", flush=True)
    report["pieces"] = [results[i][0] for i in sorted(results)] + [{"piece": f["piece"], "failed": f["error"]} for f in failures]
    report["costs"]["latentsync_usd"] = round(sum((r[0].get("cost_usd") or 0) for r in results.values()), 2)
    if failures:
        report["status"] = "stopped: " + str(len(failures)) + " piece(s) failed; re-run to retry them"
        report["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
        (out_dir / "run_report.json").write_text(json.dumps(report, indent=1), "utf8")
        print(json.dumps({"status": report["status"], "cost_usd": report["costs"]["latentsync_usd"]}, indent=1), flush=True)
        sys.exit(1)
    piece_files = [results[i][1] for i in range(n)]

    # 5. Face normalisation: every frame of every piece is warped to one reference face position and size.
    tracks = {}
    for i, pf in enumerate(piece_files):
        tracks[i] = smooth_track(track_all(pf))
    valid = np.concatenate([t[~np.isnan(t).any(axis=1)] for t in tracks.values()])
    ref = (float(np.median(valid[:, 0])), float(np.median(valid[:, 1])), float(np.median(valid[:, 2])))
    report["face_reference"] = {"cx": round(ref[0], 1), "cy": round(ref[1], 1), "face_height_px": round(ref[2], 1)}
    norm_files = []
    for i, pf in enumerate(piece_files):
        # The key includes the fill version, so normalised pieces made with the old edge copying are not reused.
        nf = work / f"norm-{pf.stem}-{sha(list(ref), 'bgfill-v2')}.mp4"
        if not nf.exists():
            normalise_piece(pf, nf, tracks[i], ref, fill=background_colour(pf))
        norm_files.append(nf)
    print(f"Normalised {len(norm_files)} pieces to face centre ({ref[0]:.0f}, {ref[1]:.0f}), face height {ref[2]:.0f} px", flush=True)

    # 6. Joins: choose the join frames by pose cost (dropping up to 4 frames at either side, always in the pause),
    # then decide: low cost -> 5-frame crossfade; high cost -> straight cut at the pause.
    y_frac = min(0.95, max(0.5, (ref[1] + 0.6 * ref[2]) / 930.0))
    frame_counts = [int(round(media_duration(p) * 25)) for p in norm_files]
    trims = [[0, frame_counts[k]] for k in range(len(norm_files))]   # kept frame range [first, last+1) per piece
    join_plan = []
    for k in range(len(norm_files) - 1):
        drop, skip, cost_search = search_join(norm_files[k], norm_files[k + 1], y_frac, frame_counts[k], frame_counts[k + 1])
        trims[k][1] = frame_counts[k] - drop
        trims[k + 1][0] = skip
        join_plan.append({"join": k + 1, "dropped_from_end_of_piece": drop, "skipped_at_start_of_next": skip,
                          "pose_cost": round(cost_search, 2)})
    threshold = float(np.median([2.5 * lower_half_change(p, y_frac) for p in norm_files]))
    for j in join_plan:
        j["threshold"] = round(threshold, 2)
        j["mode"] = "crossfade" if j["pose_cost"] <= threshold else "cut"
        j["fade_frames"] = 5 if j["mode"] == "crossfade" else 1
    trimmed = []
    for k, (a, b) in enumerate(trims):
        # The "-narr48" name is new: trims made before this change are not reused.
        dst = work / f"trim-{norm_files[k].stem}-{a}-{b}-narr48.mkv"
        if not dst.exists():
            trim_piece_with_narration(norm_files[k], narration, bounds[k], bounds[k + 1], a / 25.0, b / 25.0, dst)
        trimmed.append(dst)
    norm_files = trimmed
    print("Joins: " + ", ".join(f"{j['mode']} (cost {j['pose_cost']}, drop {j['dropped_from_end_of_piece']}, skip {j['skipped_at_start_of_next']})" for j in join_plan), flush=True)
    joined_tmp = work / f"joined-{sha([p.name for p in norm_files], [j['mode'] for j in join_plan])}.mkv"
    join_centres = assemble_pieces(norm_files, join_plan, joined_tmp)
    # The "AI-generated" label is burned into the final video itself, not only the proof copy.
    final_encode(joined_tmp, out_path)

    # 7. Checks: raw change at every frame, flags above 3x the median, ghosting, and a contact sheet per join.
    sys.path.insert(0, str(ROOT / "tools"))
    import join_audit
    sheets = ROOT / "docs" / "screenshots" / "joins"
    audit = join_audit.audit(out_path, join_centres, sheets, tag=args.trainer)
    video_s = media_duration(out_path)
    audio_only = work / f"check-audio-{sha(out_path.name, str(out_path.stat().st_size))}.wav"
    ffmpeg("-i", str(out_path), "-vn", "-ac", "1", "-ar", "16000", str(audio_only))
    audio_s = media_duration(audio_only)
    report["join_plan"] = join_plan
    report["checks"] = {
        "per_frame": {k: v for k, v in audit.items() if k not in ("spike_frames_over_3x", "ghost_frames_over_3x_variance", "joins")},
        "spike_frames_over_3x": audit["spike_frames_over_3x"],
        "ghost_frames_over_3x_variance": audit["ghost_frames_over_3x_variance"],
        "joins": audit["joins"],
        "video_seconds": round(video_s, 2), "audio_seconds": round(audio_s, 2),
        "duration_drift_s": round(video_s - audio_s, 3),
        "duration_ok": abs(video_s - audio_s) < 0.1,
        "faces_flagged": [p["piece"] for p in report["pieces"] if "checks" in p and not p["checks"]["ok"]],
    }
    report["status"] = "done"
    report["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    report["times_s"]["sum_of_piece_times"] = round(sum(p.get("seconds_taken", 0) for p in report["pieces"]), 1)
    report["costs"]["total_usd"] = report["costs"]["latentsync_usd"]

    # 7. Proof copy: the same labelled video, kept beside the final for review.
    proof = out_path.with_name(out_path.stem + "-proof.mp4")
    shutil.copy(out_path, proof)
    report["outputs"] = {"video": str(out_path), "proof": str(proof)}
    (out_dir / "run_report.json").write_text(json.dumps(report, indent=1), "utf8")
    print(json.dumps({"status": report["status"], "video": str(out_path), "proof": str(proof),
                      "cost_usd": report["costs"]["total_usd"], "joins": len(report["checks"]["joins"]),
                      "spike_frames_over_3x": len(report["checks"]["spike_frames_over_3x"]), "faces_flagged": report["checks"]["faces_flagged"]}, indent=1), flush=True)


if __name__ == "__main__":
    main()
