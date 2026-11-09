// Option 2 trainers: five photos (closed, eh, ah, blink, and optionally oo) are checked, aligned to the closed photo,
// and blended so only the mouth or the eyes change. The face model loads only on the trainer-creation screen.

export type Pt = { x: number; y: number };
export type PhotoSlot = "closed" | "eh" | "ah" | "oo" | "blink";
export const PHOTO_SLOTS: PhotoSlot[] = ["closed", "eh", "ah", "blink", "oo"];
export const REQUIRED_SLOTS: PhotoSlot[] = ["closed", "eh", "ah", "blink"];

// MediaPipe Face Landmarker indices (478 points).
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
// Points that do not move when the mouth or the eyes change: used to line the photos up.
const ANCHORS = [33, 263, 1, 6, 168, 234, 454, 152, 10];

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL = "/mediapipe/face_landmarker.task";

// ---------- geometry (pure) ----------

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function faceHeight(p: Pt[]): number {
  return dist(p[10], p[152]);
}

export type Metrics = {
  /** Lip opening relative to face height. */
  opening: number;
  /** Mouth width relative to face height. */
  width: number;
  /** Average eye opening relative to face height. */
  eyeOpen: number;
  /** Face height in pixels. */
  faceH: number;
  /** Angle of the line between the eyes, in degrees. */
  tilt: number;
};

export function measure(p: Pt[]): Metrics {
  const fh = faceHeight(p);
  const tilt = (Math.atan2(p[263].y - p[33].y, p[263].x - p[33].x) * 180) / Math.PI;
  return {
    opening: dist(p[13], p[14]) / fh,
    width: dist(p[61], p[291]) / fh,
    eyeOpen: (dist(p[159], p[145]) + dist(p[386], p[374])) / 2 / fh,
    faceH: fh,
    tilt,
  };
}

/** Feedback for one photo, compared with the closed-mouth photo. An empty list means the photo is fine. */
export function reviewPhoto(slot: PhotoSlot, m: Metrics, closed: Metrics): string[] {
  const messages: string[] = [];
  const scale = m.faceH / closed.faceH;
  if (scale < 0.85 || scale > 1.15) messages.push("Keep the same distance from the camera as in the closed photo, so the face is the same size.");
  if (Math.abs(m.tilt - closed.tilt) > 5) messages.push("Keep your head straight, as in the closed photo. Don't tilt it.");
  switch (slot) {
    case "closed":
      if (m.opening > 0.006) messages.push("Close your mouth gently and relax your lips.");
      break;
    case "eh":
      if (m.opening < 0.004) messages.push("Open your mouth a little more, as if saying 'eh'.");
      if (m.opening > 0.02) messages.push("Open your mouth less. 'Eh' is a small opening; 'ah' is the wide one.");
      break;
    case "ah":
      if (m.opening < 0.02) messages.push("Open your mouth wide, as if saying 'ah', with your top teeth visible.");
      break;
    case "oo":
      if (m.width > closed.width * 0.92) messages.push("Round your lips, as if saying 'oo'. Your mouth should look narrower.");
      break;
    case "blink":
      if (m.eyeOpen > closed.eyeOpen * 0.75) messages.push("Close your eyes fully, as if blinking.");
      break;
  }
  return messages;
}

/** Similarity transform (scale, rotation, translation) that maps the source points onto the destination points. */
export function similarity(src: Pt[], dst: Pt[]): { a: number; b: number; tx: number; ty: number } {
  const n = src.length;
  const cs = { x: src.reduce((s, p) => s + p.x, 0) / n, y: src.reduce((s, p) => s + p.y, 0) / n };
  const cd = { x: dst.reduce((s, p) => s + p.x, 0) / n, y: dst.reduce((s, p) => s + p.y, 0) / n };
  let num_a = 0, num_b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const xs = src[i].x - cs.x, ys = src[i].y - cs.y;
    const xd = dst[i].x - cd.x, yd = dst[i].y - cd.y;
    num_a += xs * xd + ys * yd;
    num_b += xs * yd - ys * xd;
    den += xs * xs + ys * ys;
  }
  const a = den ? num_a / den : 1;
  const b = den ? num_b / den : 0;
  return { a, b, tx: cd.x - (a * cs.x - b * cs.y), ty: cd.y - (b * cs.x + a * cs.y) };
}

export function applyTransform(t: { a: number; b: number; tx: number; ty: number }, p: Pt): Pt {
  return { x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty };
}

/** Average distance, in pixels, between the aligned anchors and the closed photo's anchors. */
export function alignmentError(photo: Pt[], closed: Pt[]): number {
  const t = similarity(ANCHORS.map(i => photo[i]), ANCHORS.map(i => closed[i]));
  const errs = ANCHORS.map(i => dist(applyTransform(t, photo[i]), closed[i]));
  return errs.reduce((s, e) => s + e, 0) / errs.length;
}

/** Convex hull (monotone chain), counter-clockwise. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function regionPoints(p: Pt[], region: "mouth" | "eyes", grow: number): Pt[] {
  const idx = region === "mouth" ? LIPS : [...LEFT_EYE, ...RIGHT_EYE];
  const pts = idx.map(i => p[i]);
  const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length;
  const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length;
  return pts.map(q => ({ x: cx + (q.x - cx) * (1 + grow), y: cy + (q.y - cy) * (1 + grow) }));
}

// ---------- browser: landmarks and image composition ----------

type Landmarker = { detect: (image: ImageBitmap) => { faceLandmarks: { x: number; y: number }[][] }; close: () => void };
let landmarkerPromise: Promise<Landmarker> | null = null;

/** Loads the face model. Called only from the trainer-creation screen. */
export function loadFaceLandmarker(): Promise<Landmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const lm = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numFaces: 1,
      });
      return lm as unknown as Landmarker;
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Face landmarks in pixels of the image. */
export async function landmarksOf(image: ImageBitmap): Promise<Pt[]> {
  const lm = await loadFaceLandmarker();
  const result = lm.detect(image);
  const face = result.faceLandmarks?.[0];
  if (!face) throw new Error("No face found in this photo. Use a clear, front-facing photo.");
  return face.map(p => ({ x: p.x * image.width, y: p.y * image.height }));
}

/** Aligns the photo to the closed photo and pastes only the mouth or the eyes, with a soft edge. */
export async function composeSlot(closed: ImageBitmap, closedPts: Pt[], photo: ImageBitmap, photoPts: Pt[], region: "mouth" | "eyes"): Promise<Blob> {
  const W = closed.width, H = closed.height;
  const t = similarity(ANCHORS.map(i => photoPts[i]), ANCHORS.map(i => closedPts[i]));

  // 1. the photo, moved onto the closed photo's position
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext("2d");
  if (!lctx) throw new Error("Image processing is not available in this browser");
  lctx.setTransform(t.a, t.b, -t.b, t.a, t.tx, t.ty);
  lctx.drawImage(photo, 0, 0);
  lctx.setTransform(1, 0, 0, 1, 0, 0);

  // 2. a soft mask around the region
  const spread = Math.max(...closedPts.map(p => p.x)) - Math.min(...closedPts.map(p => p.x));
  const blurPx = Math.max(3, Math.round(spread * (region === "mouth" ? 0.012 : 0.008)));
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext("2d");
  if (!mctx) throw new Error("Image processing is not available in this browser");
  const hull = convexHull(regionPoints(closedPts, region, region === "mouth" ? 0.25 : 0.12));
  mctx.filter = `blur(${blurPx}px)`;
  mctx.fillStyle = "#fff";
  mctx.beginPath();
  hull.forEach((p, i) => (i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y)));
  mctx.closePath();
  mctx.fill();
  mctx.filter = "none";

  // 3. keep only the masked part of the moved photo
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(mask, 0, 0);
  lctx.globalCompositeOperation = "source-over";

  // 4. the closed photo with that part pasted on top
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Image processing is not available in this browser");
  octx.drawImage(closed, 0, 0);
  octx.drawImage(layer, 0, 0);
  const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not prepare the photo");
  return blob;
}

/** Frees the face model's memory once the screen is done with it. */
export async function releaseFaceLandmarker(): Promise<void> {
  if (!landmarkerPromise) return;
  const lm = await landmarkerPromise.catch(() => null);
  lm?.close();
  landmarkerPromise = null;
}
