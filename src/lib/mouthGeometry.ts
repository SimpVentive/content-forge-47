// Mouth shapes for Option 2 trainers: pure geometry and selection rules (no browser or network code here).
// Mirrors the approved prototype: the open-mouth candidate is picked by measurement, and "eh" and "ah" are morphed
// from the closed photo toward it, with the blend solved so the gap measured on the output hits the target.

export type Pt = { x: number; y: number };

// MediaPipe Face Landmarker indices.
export const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415];
export const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
// Inner-lip ring: the opening the teeth show through.
export const APERTURE = [13, 14, 78, 308, 82, 312, 87, 317];
// How far each jaw point follows the mouth. The chin drops most; the sides of the jaw follow less.
export const JAW_W: Record<number, number> = {
  152: 1.0, 136: 0.5, 172: 0.5, 150: 0.5, 149: 0.5, 176: 0.5, 148: 0.5,
  377: 0.5, 400: 0.5, 378: 0.5, 379: 0.5, 365: 0.5, 397: 0.5, 288: 0.5,
};
export const JAW = Object.keys(JAW_W).map(Number);

/** Limits from the approved calibration. A one-pixel shift of an unchanged photo moves the jaw by 0.004 and the corners by 0.003. */
export const LIMITS = {
  jaw: 0.0125,
  corner: 0.015,
  /** An open candidate is usable as the morph source only if its gap is in this range. */
  sourceGapMin: 0.06,
  sourceGapMax: 0.12,
  /** Blink: the eyes must close to at most this share of their open height. */
  eyeRatio: 0.75,
  /** Accepted gap error for eh (0.020) and ah (0.045). */
  gapTolerance: 0.0005,
};

export const TARGET_GAP = { eh: 0.02, ah: 0.045 } as const;

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function faceHeight(p: Pt[]): number {
  return dist(p[10], p[152]);
}

export type MouthMetrics = {
  /** Inner-lip gap as a share of face height. */
  gap: number;
  /** Mouth width as a share of the closed photo's width. */
  width: number;
  /** Jaw movement, average over the jaw points, as a share of face height. */
  jaw: number;
  /** Largest vertical movement of a smile corner, as a share of face height. */
  corner: number;
};

export function mouthMetrics(pts: Pt[], base: Pt[]): MouthMetrics {
  const fh = faceHeight(base);
  const gap = dist(pts[13], pts[14]) / fh;
  const width = dist(pts[61], pts[291]) / dist(base[61], base[291]);
  const jaw = JAW.reduce((s, i) => s + dist(pts[i], base[i]), 0) / JAW.length / fh;
  const corner = Math.max(Math.abs(pts[61].y - base[61].y), Math.abs(pts[291].y - base[291].y)) / fh;
  return { gap, width, jaw, corner };
}

/** Average eye opening as a share of face height. */
export function eyeOpening(p: Pt[]): number {
  return ((dist(p[159], p[145]) + dist(p[386], p[374])) / 2) / faceHeight(p);
}

export function acceptable(m: MouthMetrics): boolean {
  return m.jaw <= LIMITS.jaw && m.corner <= LIMITS.corner;
}

/** Higher is better: visible teeth, a still jaw and still smile corners. */
export function sourceScore(teeth: number, m: MouthMetrics): number {
  return teeth - 2 * m.jaw - 2 * m.corner;
}

/** Index of the best usable open candidate, or -1 when none passes. */
export function pickSource(cands: { metrics: MouthMetrics; teeth: number }[]): number {
  let best = -1;
  let bestScore = -Infinity;
  cands.forEach((c, i) => {
    const { gap } = c.metrics;
    if (gap < LIMITS.sourceGapMin || gap > LIMITS.sourceGapMax) return;
    if (!acceptable(c.metrics)) return;
    const s = sourceScore(c.teeth, c.metrics);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

// ---------- masks ----------

/** Convex hull (monotone chain). Points come back in order around the shape. */
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

function insideConvex(poly: Pt[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (c === 0) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

function fillHull(mask: Uint8Array, w: number, h: number, poly: Pt[]): void {
  if (poly.length < 3) return;
  const x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x))));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...poly.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.y))));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...poly.map((p) => p.y))));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (insideConvex(poly, x + 0.5, y + 0.5)) mask[y * w + x] = 255;
    }
  }
}

function insideRoundedRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

function fillEllipse(mask: Uint8Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) mask[y * w + x] = 255;
    }
  }
}

/** Lips, plus everything from just below the nose down to the chin, out to the sides of the mouth. */
export function mouthMask(w: number, h: number, pts: Pt[]): Uint8Array {
  const mask = new Uint8Array(w * h);
  fillHull(mask, w, h, convexHull(LIPS.map((i) => pts[i])));
  const left = pts[61].x;
  const right = pts[291].x;
  const span = right - left;
  const cx = (left + right) / 2;
  const top = pts[2].y + 4;
  const chin = pts[152].y;
  const x0 = cx - 0.9 * span;
  const x1 = cx + 0.9 * span;
  const y1 = chin - 0.1 * (chin - top);
  const radius = 0.5 * span;
  for (let y = Math.max(0, Math.floor(top)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
      if (insideRoundedRect(x + 0.5, y + 0.5, x0, top, x1, y1, radius)) mask[y * w + x] = 255;
    }
  }
  fillEllipse(mask, w, h, cx, (chin - 0.45 * span + chin + 0.06 * span) / 2, 0.9 * span, (0.06 * span + 0.45 * span) / 2);
  return mask;
}

/** Both eyes, slightly grown, for the blink. */
export function eyeMask(w: number, h: number, pts: Pt[]): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (const indices of [LEFT_EYE, RIGHT_EYE]) {
    const eye = indices.map((i) => pts[i]);
    const span = Math.max(...eye.map((p) => p.x)) - Math.min(...eye.map((p) => p.x));
    const grow = Math.max(6, Math.round(span * 0.2));
    const one = new Uint8Array(w * h);
    fillHull(one, w, h, convexHull(eye));
    const grown = dilate(one, w, h, grow);
    for (let i = 0; i < mask.length; i++) if (grown[i]) mask[i] = 255;
  }
  return mask;
}

/** Square dilation by r pixels. */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const horiz = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r);
      const b = Math.min(w - 1, x + r);
      for (let k = a; k <= b; k++) {
        if (mask[y * w + k]) {
          horiz[y * w + x] = 255;
          break;
        }
      }
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, y - r);
      const b = Math.min(h - 1, y + r);
      for (let k = a; k <= b; k++) {
        if (horiz[k * w + x]) {
          out[y * w + x] = 255;
          break;
        }
      }
    }
  }
  return out;
}

// ---------- compositing ----------

/** Three box-blur passes: a close stand-in for a Gaussian. */
function blur(values: Float32Array, w: number, h: number, r: number): Float32Array {
  let src = values;
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;
        for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += src[y * w + k]; n++; }
        tmp[y * w + x] = s / n;
      }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;
        for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += tmp[k * w + x]; n++; }
        out[y * w + x] = s / n;
      }
    }
    src = out;
  }
  return src;
}

/** Takes the generated pixels only inside the mask. Outside it, every pixel is the original, unchanged. */
export function composite(orig: Uint8ClampedArray, gen: Uint8ClampedArray, mask: Uint8Array, w: number, h: number): Uint8ClampedArray {
  const hard = new Float32Array(w * h);
  for (let i = 0; i < hard.length; i++) hard[i] = mask[i] / 255;
  const soft = blur(hard, w, h, 5);
  const out = new Uint8ClampedArray(orig.length);
  for (let i = 0; i < w * h; i++) {
    const m = soft[i] * hard[i];
    const o = i * 4;
    for (let c = 0; c < 3; c++) out[o + c] = orig[o + c] * (1 - m) + gen[o + c] * m;
    out[o + 3] = 255;
  }
  return out;
}

// ---------- morph ----------

/** Per-pixel displacement (2 values per pixel), nonzero only in the mouth and jaw region. Lip points move with the
 * open shape; the chin and jaw follow with their weights; the smile corners keep their height. */
export function denseField(closed: Pt[], open: Pt[], w: number, h: number): Float32Array {
  const fh = faceHeight(closed);
  const sigma = 0.025 * fh;
  const disp = new Map<number, Pt>();
  for (const i of LIPS) disp.set(i, { x: open[i].x - closed[i].x, y: open[i].y - closed[i].y });
  for (const [i, wgt] of Object.entries(JAW_W)) {
    const k = Number(i);
    disp.set(k, { x: wgt * (open[k].x - closed[k].x), y: wgt * (open[k].y - closed[k].y) });
  }
  for (const i of [61, 291]) {
    const d = disp.get(i);
    if (d) d.y = 0;
  }
  const ids = [...new Set([...LIPS, ...JAW])];
  const field = new Float32Array(w * h * 2);
  const xs = ids.map((i) => closed[i].x);
  const ys = ids.map((i) => closed[i].y);
  const dvx = ids.map((i) => (disp.get(i) as Pt).x);
  const dvy = ids.map((i) => (disp.get(i) as Pt).y);
  const pad = 0.12 * fh;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys) + pad));
  const twoSigma2 = 2 * sigma * sigma;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let nx = 0;
      let ny = 0;
      let den = 0;
      for (let k = 0; k < ids.length; k++) {
        const dx = x - xs[k];
        const dy = y - ys[k];
        const wgt = Math.exp(-(dx * dx + dy * dy) / twoSigma2);
        nx += wgt * dvx[k];
        ny += wgt * dvy[k];
        den += wgt;
      }
      if (den > 1e-3) {
        const o = (y * w + x) * 2;
        field[o] = nx / den;
        field[o + 1] = ny / den;
      }
    }
  }
  return field;
}

function sample(img: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: number): number {
  const cx = Math.min(Math.max(x, 0), w - 1);
  const cy = Math.min(Math.max(y, 0), h - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const v00 = img[(y0 * w + x0) * 4 + c];
  const v10 = img[(y0 * w + x1) * 4 + c];
  const v01 = img[(y1 * w + x0) * 4 + c];
  const v11 = img[(y1 * w + x1) * 4 + c];
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

/** Two-image morph at blend t: the closed photo moves t of the way toward the open shape, the open photo the rest;
 * the two are cross-dissolved with weight t. Pixels with no displacement are copied exactly. */
export function morph(t: number, closed: Uint8ClampedArray, open: Uint8ClampedArray, w: number, h: number, field: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(closed.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const dx = field[i * 2];
      const dy = field[i * 2 + 1];
      if (dx === 0 && dy === 0) {
        out[o] = closed[o];
        out[o + 1] = closed[o + 1];
        out[o + 2] = closed[o + 2];
        out[o + 3] = 255;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const cv = sample(closed, w, h, x - t * dx, y - t * dy, c);
        const ov = sample(open, w, h, x + (1 - t) * dx, y + (1 - t) * dy, c);
        out[o + c] = (1 - t) * cv + t * ov;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

// ---------- measurement helpers ----------

/** Share of the open mouth's pixels that are bright and low in colour (teeth). */
export function teethShare(rgba: Uint8ClampedArray, w: number, h: number, pts: Pt[]): number {
  const poly = convexHull(APERTURE.map((i) => pts[i]));
  let inside = 0;
  let bright = 0;
  const x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x))));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...poly.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.y))));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...poly.map((p) => p.y))));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!insideConvex(poly, x + 0.5, y + 0.5)) continue;
      inside++;
      const o = (y * w + x) * 4;
      const r = rgba[o] / 255;
      const g = rgba[o + 1] / 255;
      const b = rgba[o + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const s = max === 0 ? 0 : (max - min) / max;
      if (max > 0.588 && s < 0.275) bright++;
    }
  }
  return inside === 0 ? 0 : bright / inside;
}

/** Eye opening ratio of a candidate compared with the closed photo (1 = unchanged). */
export function blinkRatio(pts: Pt[], basePts: Pt[]): number {
  return eyeOpening(pts) / eyeOpening(basePts);
}

/** Finds the blend t whose measured gap is closest to the target, by bisection. The gap is measured on the output itself. */
export async function solveBlend(target: number, gapAt: (t: number) => Promise<number>, tol = LIMITS.gapTolerance, iterations = 22): Promise<{ t: number; gap: number; error: number }> {
  let lo = 0;
  let hi = 1;
  let best: { t: number; gap: number; error: number } | null = null;
  for (let i = 0; i < iterations; i++) {
    const t = (lo + hi) / 2;
    const gap = await gapAt(t);
    const error = Math.abs(gap - target);
    if (!best || error < best.error) best = { t, gap, error };
    if (error <= tol) break;
    if (gap < target) lo = t;
    else hi = t;
  }
  return best as { t: number; gap: number; error: number };
}
