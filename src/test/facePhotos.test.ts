import { describe, expect, it } from "vitest";
import { alignmentError, applyTransform, convexHull, reviewPhoto, similarity, type Metrics, type Pt } from "@/lib/facePhotos";

// Measurements taken from the test photos (relative to face height).
const closed: Metrics = { opening: 0.001, width: 0.319, eyeOpen: 0.047, faceH: 1000, tilt: 0 };

describe("photo feedback", () => {
  it("accepts an 'ah' with a clear opening", () => {
    expect(reviewPhoto("ah", { ...closed, opening: 0.034 }, closed)).toEqual([]);
  });

  it("asks for more opening when 'eh' is barely open, and for less when it is wide", () => {
    expect(reviewPhoto("eh", { ...closed, opening: 0.001 }, closed)[0]).toContain("Open your mouth a little more");
    expect(reviewPhoto("eh", { ...closed, opening: 0.03 }, closed)[0]).toContain("Open your mouth less");
    expect(reviewPhoto("eh", { ...closed, opening: 0.007 }, closed)).toEqual([]);
  });

  it("asks for rounder lips when 'oo' is not narrower than the closed photo", () => {
    expect(reviewPhoto("oo", { ...closed, width: 0.318 }, closed)[0]).toContain("Round your lips");
    expect(reviewPhoto("oo", { ...closed, width: 0.268 }, closed)).toEqual([]);
  });

  it("asks for fully closed eyes when the blink is not clear", () => {
    expect(reviewPhoto("blink", { ...closed, eyeOpen: 0.046 }, closed)[0]).toContain("Close your eyes fully");
    expect(reviewPhoto("blink", { ...closed, eyeOpen: 0.031 }, closed)).toEqual([]);
  });

  it("flags a different distance from the camera and a tilted head", () => {
    expect(reviewPhoto("closed", { ...closed, faceH: 1300 }, closed).join(" ")).toContain("same distance");
    expect(reviewPhoto("closed", { ...closed, tilt: 9 }, closed).join(" ")).toContain("Keep your head straight");
  });
});

describe("alignment geometry", () => {
  const base: Pt[] = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 50, y: 50 },
  ];

  it("recovers a known scale, rotation and shift", () => {
    const moved = base.map(p => ({ x: 2 * p.x + 30, y: 2 * p.y - 10 }));
    const t = similarity(base, moved);
    expect(t.a).toBeCloseTo(2, 6);
    expect(t.b).toBeCloseTo(0, 6);
    expect(applyTransform(t, { x: 10, y: 10 })).toEqual({ x: 50, y: 10 });
  });

  it("has zero alignment error for identical anchors", () => {
    const face: Pt[] = Array.from({ length: 478 }, (_, i) => ({ x: (i * 37) % 400, y: (i * 53) % 400 }));
    expect(alignmentError(face, face)).toBeCloseTo(0, 6);
  });

  it("builds the outline of a region", () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }]);
    expect(hull).toHaveLength(4);
  });
});
