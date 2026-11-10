import { describe, expect, it } from "vitest";
import {
  APERTURE,
  LIPS,
  LIMITS,
  composite,
  convexHull,
  denseField,
  mouthMask,
  mouthMetrics,
  morph,
  pickSource,
  solveBlend,
  teethShare,
  type Pt,
} from "@/lib/mouthGeometry";

/** A 478-point face with every point at the same spot, then the points that matter placed explicitly. */
function faceAt(overrides: Record<number, Pt>, fill: Pt = { x: 100, y: 100 }): Pt[] {
  const pts: Pt[] = Array.from({ length: 478 }, () => ({ ...fill }));
  for (const i of LIPS) pts[i] = { x: 100, y: 100 };
  for (const [i, p] of Object.entries(overrides)) pts[Number(i)] = p;
  return pts;
}

function standardFace(openGap = 0): Pt[] {
  return faceAt({
    10: { x: 100, y: 40 },
    2: { x: 100, y: 90 },
    152: { x: 100, y: 160 },
    61: { x: 80, y: 100 },
    291: { x: 120, y: 100 },
    13: { x: 100, y: 100 - openGap / 2 },
    14: { x: 100, y: 100 + openGap / 2 },
  });
}

describe("convexHull", () => {
  it("drops interior points", () => {
    const hull = convexHull([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 },
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });
});

describe("mouthMask", () => {
  it("covers the lips and the chin area below them, and nothing far away", () => {
    const w = 200;
    const h = 200;
    const mask = mouthMask(w, h, standardFace());
    expect(mask[100 * w + 100]).toBe(255); // inside the lips
    expect(mask[150 * w + 100]).toBe(255); // jaw below the mouth, down to the chin
    expect(mask[5 * w + 5]).toBe(0); // far corner
    expect(mask[40 * w + 100]).toBe(0); // forehead, above the nose
  });
});

describe("morph and composite guarantees", () => {
  it("morph with no displacement returns the closed photo exactly", () => {
    const w = 20;
    const h = 20;
    const closed = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256);
    const open = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 11) % 256);
    const field = new Float32Array(w * h * 2);
    const out = morph(0.5, closed, open, w, h, field);
    for (let i = 0; i < w * h; i++) {
      expect(out[i * 4]).toBe(closed[i * 4]);
      expect(out[i * 4 + 1]).toBe(closed[i * 4 + 1]);
      expect(out[i * 4 + 2]).toBe(closed[i * 4 + 2]);
    }
  });

  it("composite leaves every pixel outside the mask identical to the original", () => {
    const w = 30;
    const h = 30;
    const orig = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 7) % 256);
    const gen = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 13 + 5) % 256);
    const mask = new Uint8Array(w * h);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) mask[y * w + x] = 255;
    const out = composite(orig, gen, mask, w, h);
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) continue;
      expect(out[i * 4]).toBe(orig[i * 4]);
      expect(out[i * 4 + 1]).toBe(orig[i * 4 + 1]);
      expect(out[i * 4 + 2]).toBe(orig[i * 4 + 2]);
    }
  });

  it("the dense field is zero when the open shape equals the closed shape", () => {
    const face = standardFace();
    const field = denseField(face, face, 200, 200);
    expect(field.every((v) => v === 0)).toBe(true);
  });
});

describe("solveBlend", () => {
  it("finds the blend whose measured gap hits the target", async () => {
    const gapAt = async (t: number) => 0.08 * t;
    const eh = await solveBlend(0.02, gapAt);
    const ah = await solveBlend(0.045, gapAt);
    expect(eh.error).toBeLessThanOrEqual(LIMITS.gapTolerance);
    expect(ah.error).toBeLessThanOrEqual(LIMITS.gapTolerance);
    expect(eh.t).toBeCloseTo(0.25, 2);
    expect(ah.t).toBeCloseTo(0.5625, 2);
  });
});

describe("pickSource", () => {
  it("skips candidates outside the gap range, the jaw or corner limits, and keeps the best teeth-to-movement score", () => {
    const calm = { jaw: 0.004, corner: 0.005, gap: 0.07, width: 1 };
    const cands = [
      { metrics: { ...calm, gap: 0.05 }, teeth: 0.5 }, // gap too small
      { metrics: { ...calm, gap: 0.08 }, teeth: 0.2 },
      { metrics: { ...calm, gap: 0.09, jaw: 0.02 }, teeth: 0.4 }, // jaw moved too much
      { metrics: { ...calm, gap: 0.07 }, teeth: 0.3 }, // best
    ];
    expect(pickSource(cands)).toBe(3);
  });

  it("returns -1 when no candidate is usable", () => {
    expect(pickSource([{ metrics: { jaw: 0, corner: 0, gap: 0.01, width: 1 }, teeth: 0.5 }])).toBe(-1);
  });
});

describe("measurement", () => {
  it("reads the inner-lip gap relative to face height", () => {
    const base = standardFace();
    const open = standardFace(16); // 16 px gap on a 120 px face
    const m = mouthMetrics(open, base);
    expect(m.gap).toBeCloseTo(16 / 120, 4);
    expect(m.jaw).toBeCloseTo(0, 6);
    expect(m.corner).toBeCloseTo(0, 6);
  });

  it("teeth share is high on a bright open mouth and zero on a dark one", () => {
    const w = 100;
    const h = 100;
    const pts = faceAt({
      13: { x: 50, y: 40 }, 14: { x: 50, y: 60 }, 78: { x: 35, y: 50 }, 308: { x: 65, y: 50 },
      82: { x: 40, y: 42 }, 312: { x: 60, y: 42 }, 87: { x: 40, y: 58 }, 317: { x: 60, y: 58 },
    });
    expect(APERTURE.every((i) => pts[i])).toBe(true);
    const white = new Uint8ClampedArray(w * h * 4).fill(255);
    const black = new Uint8ClampedArray(w * h * 4);
    for (let i = 3; i < white.length; i += 4) { white[i] = 255; black[i] = 255; }
    expect(teethShare(white, w, h, pts)).toBeGreaterThan(0.9);
    expect(teethShare(black, w, h, pts)).toBe(0);
  });
});
