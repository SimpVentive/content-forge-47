// Option 2 trainers, made from one photo with no user choices:
//   1. crop the photo to a 2:3 head-and-shoulders frame (no AI redrawing)
//   2. ask Flux Fill for several open-mouth candidates; keep the one the measurements pick
//   3. ask for blink candidates; keep the one that closes the eyes best
//   4. morph the closed photo toward the open shape for "eh" (gap 0.020) and "ah" (gap 0.045)
// The raw Flux images stay in memory only. They are never shown, saved or sent to learners.

import { supabase } from "@/lib/supabase";
import { landmarksOf, releaseFaceLandmarker } from "@/lib/facePhotos";
import {
  LIMITS,
  TARGET_GAP,
  blinkRatio,
  composite,
  denseField,
  eyeMask,
  morph,
  mouthMask,
  mouthMetrics,
  pickSource,
  solveBlend,
  teethShare,
  faceHeight,
  type MouthMetrics,
  type Pt,
} from "@/lib/mouthGeometry";

export type MouthReport = {
  openCandidates: number;
  openRounds: number;
  sourceGap: number;
  blinkRounds: number;
  blinkRatio: number;
  eh: { t: number; gap: number };
  ah: { t: number; gap: number };
};

export type MouthSet = {
  /** The cropped, closed-mouth portrait. */
  closed: Blob;
  eh: Blob;
  ah: Blob;
  blink: Blob;
  report: MouthReport;
};

type Rgba = { rgba: Uint8ClampedArray; w: number; h: number };

const KEEP = "Keep the same person, face, jaw, skin, glasses, clothing, background and lighting exactly as they are. ";
const OPEN_PROMPT = KEEP + "Speaking naturally, mouth moderately open, about a third less wide than a full 'ah', relaxed full upper lip, upper teeth just visible, same slight smile, jaw and face unchanged. No other change.";
const BLINK_PROMPT = "Keep the same person, face, glasses, skin, clothing, background and lighting exactly as they are. Change only the eyes: both eyelids gently closed, as in a natural blink, lashes relaxed. No other change.";
const OPEN_CANDIDATES = 4;
const OPEN_ROUNDS = 3;
const BLINK_CANDIDATES = 4;
const BLINK_ROUNDS = 2;
const MAX_FRAME_HEIGHT = 1600;

const FAIL_OPEN = "Could not make a natural open mouth from this photo. Use a clear, front-facing photo with a relaxed face and good light.";
const FAIL_BLINK = "Could not close the eyes naturally in this photo. Use a clear, front-facing photo with the eyes open.";
const FAIL_GAP = "Could not reach the target mouth openings on this photo. Use a clear, front-facing photo with a relaxed face.";

// ---------- image helpers ----------

function bitmapToRgba(bmp: ImageBitmap | HTMLCanvasElement, w: number, h: number): Rgba {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  ctx.drawImage(bmp, 0, 0, w, h);
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

async function rgbaToBitmap(img: Rgba): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = img.w;
  canvas.height = img.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  const data = ctx.createImageData(img.w, img.h);
  data.data.set(img.rgba);
  ctx.putImageData(data, 0, 0);
  return createImageBitmap(canvas);
}

async function rgbaToBlob(img: Rgba, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.w;
  canvas.height = img.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  const data = ctx.createImageData(img.w, img.h);
  data.data.set(img.rgba);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("Could not prepare the photo");
  return blob;
}

function maskToRgba(mask: Uint8Array, w: number, h: number): Rgba {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = mask[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, w, h };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

/** Crops to a 2:3 frame centred on the face, from the top of the head to the shoulders. Only crops; nothing is drawn. */
export async function cropToFaceFrame(bitmap: ImageBitmap, pts: Pt[]): Promise<Rgba> {
  const W = bitmap.width;
  const H = bitmap.height;
  const fh = faceHeight(pts);
  const cx = (pts[234].x + pts[454].x) / 2;
  let frameH = Math.min(H, Math.round(fh * 3.6));
  let frameW = Math.round((frameH * 2) / 3);
  if (frameW > W) {
    frameW = W;
    frameH = Math.min(H, Math.round((W * 3) / 2));
  }
  const x0 = Math.min(Math.max(Math.round(cx - frameW / 2), 0), W - frameW);
  const y0 = Math.min(Math.max(Math.round(pts[10].y - 0.9 * fh), 0), H - frameH);
  const scale = Math.min(1, MAX_FRAME_HEIGHT / frameH);
  const outW = Math.round(frameW * scale);
  const outH = Math.round(frameH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  ctx.drawImage(bitmap, x0, y0, frameW, frameH, 0, 0, outW, outH);
  return { rgba: ctx.getImageData(0, 0, outW, outH).data, w: outW, h: outH };
}

// ---------- Flux (through the server, which holds the key) ----------

async function fluxFill(imageB64: string, maskB64: string, prompt: string, seed: number, w: number, h: number): Promise<Rgba> {
  const { data, error } = await supabase.functions.invoke("flux-fill", {
    body: { image: imageB64, mask: maskB64, prompt, seed },
  });
  if (error) throw new Error(error.message || "Image service failed");
  if (!data?.png) throw new Error("Image service returned no image");
  const blob = base64ToBlob(data.png, "image/png");
  const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
  return bitmapToRgba(bmp, w, h);
}

// ---------- the pipeline ----------

type Candidate = { rgba: Uint8ClampedArray; pts: Pt[]; metrics: MouthMetrics; teeth: number };

/** Builds the four Option 2 images from one photo. Throws a plain-language error when a step cannot succeed. */
export async function buildMouthSet(file: File, onProgress: (message: string) => void = () => {}): Promise<MouthSet> {
  try {
    onProgress("Finding your face…");
    const original = await createImageBitmap(file);
    const originalPts = await landmarksOf(original);
    const cropped = await cropToFaceFrame(original, originalPts);
    const { w, h } = cropped;
    const base = cropped.rgba;
    const basePts = await landmarksOf(await rgbaToBitmap(cropped));

    const openMask = mouthMask(w, h, basePts);
    const eyes = eyeMask(w, h, basePts);
    const baseB64 = await blobToBase64(await rgbaToBlob(cropped, "image/png"));
    const openMaskB64 = await blobToBase64(await rgbaToBlob(maskToRgba(openMask, w, h), "image/png"));
    const eyeMaskB64 = await blobToBase64(await rgbaToBlob(maskToRgba(eyes, w, h), "image/png"));

    // 1. Open-mouth candidates. The best one by measurement becomes the source for the morph.
    const pool: Candidate[] = [];
    let source = -1;
    let openRounds = 0;
    for (let round = 1; round <= OPEN_ROUNDS && source < 0; round++) {
      openRounds = round;
      onProgress(`Making open-mouth shapes (round ${round} of ${OPEN_ROUNDS})…`);
      const seeds = Array.from({ length: OPEN_CANDIDATES }, (_, k) => 1000 * round + k + 1);
      const results = await Promise.allSettled(seeds.map((seed) => fluxFill(baseB64, openMaskB64, OPEN_PROMPT, seed, w, h)));
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const gen = composite(base, r.value.rgba, openMask, w, h);
        try {
          const pts = await landmarksOf(await rgbaToBitmap({ rgba: gen, w, h }));
          pool.push({ rgba: gen, pts, metrics: mouthMetrics(pts, basePts), teeth: teethShare(gen, w, h, pts) });
        } catch {
          // A candidate without a readable face is simply not used.
        }
      }
      source = pickSource(pool);
      if (source < 0 && results.every((r) => r.status === "rejected")) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
        throw new Error(first.reason instanceof Error ? first.reason.message : FAIL_OPEN);
      }
    }
    if (source < 0) throw new Error(FAIL_OPEN);
    const src = pool[source];

    // 2. Blink: keep the candidate whose eyes close the most, if it closes enough.
    let blink: { rgba: Uint8ClampedArray; ratio: number } | null = null;
    let blinkRounds = 0;
    for (let round = 1; round <= BLINK_ROUNDS && !blink; round++) {
      blinkRounds = round;
      onProgress(`Closing the eyes (round ${round} of ${BLINK_ROUNDS})…`);
      const seeds = Array.from({ length: BLINK_CANDIDATES }, (_, k) => 2000 * round + k + 1);
      const results = await Promise.allSettled(seeds.map((seed) => fluxFill(baseB64, eyeMaskB64, BLINK_PROMPT, seed, w, h)));
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const gen = composite(base, r.value.rgba, eyes, w, h);
        try {
          const ratio = blinkRatio(await landmarksOf(await rgbaToBitmap({ rgba: gen, w, h })), basePts);
          if (!blink || ratio < blink.ratio) blink = { rgba: gen, ratio };
        } catch {
          // Not usable.
        }
      }
      if (blink && blink.ratio > LIMITS.eyeRatio) blink = null;
    }
    if (!blink) throw new Error(FAIL_BLINK);

    // 3. Morph the closed photo toward the open source; solve the blend that gives each target gap.
    onProgress("Shaping the 'eh' and 'ah' mouths…");
    const field = denseField(basePts, src.pts, w, h);
    const gapAt = async (t: number) => {
      const img = morph(t, base, src.rgba, w, h, field);
      const pts = await landmarksOf(await rgbaToBitmap({ rgba: img, w, h }));
      return mouthMetrics(pts, basePts).gap;
    };
    const eh = await solveBlend(TARGET_GAP.eh, gapAt);
    const ah = await solveBlend(TARGET_GAP.ah, gapAt);
    if (eh.error > LIMITS.gapTolerance || ah.error > LIMITS.gapTolerance) throw new Error(FAIL_GAP);

    onProgress("Saving your mouth and eye shapes…");
    const ehRgba = morph(eh.t, base, src.rgba, w, h, field);
    const ahRgba = morph(ah.t, base, src.rgba, w, h, field);
    const closed = await rgbaToBlob({ rgba: base, w, h }, "image/jpeg", 0.92);
    const ehBlob = await rgbaToBlob({ rgba: ehRgba, w, h }, "image/jpeg", 0.92);
    const ahBlob = await rgbaToBlob({ rgba: ahRgba, w, h }, "image/jpeg", 0.92);
    const blinkBlob = await rgbaToBlob({ rgba: blink.rgba, w, h }, "image/jpeg", 0.92);

    return {
      closed,
      eh: ehBlob,
      ah: ahBlob,
      blink: blinkBlob,
      report: {
        openCandidates: pool.length,
        openRounds,
        sourceGap: src.metrics.gap,
        blinkRounds,
        blinkRatio: blink.ratio,
        eh: { t: eh.t, gap: eh.gap },
        ah: { t: ah.t, gap: ah.gap },
      },
    };
  } finally {
    void releaseFaceLandmarker();
  }
}
