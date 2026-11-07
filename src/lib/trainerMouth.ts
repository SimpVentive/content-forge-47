import type { FacePoint, TrainerFacePoints } from "@/lib/trainerFacePoints";

// One mouth and blink for the app narrator AND the SCORM card. Both call renderMouthFrame below, so they look the same.
// Drawing approach follows the team's lipsync-trainer (drawMouth): skin covers the painted lips, new lips are drawn
// with teeth inside, and the mouth follows a track computed from the narration (lib/mouthTrack.ts).
// Geometry is written in picture units of the 512×768 trainer picture (same 2:3 ratio as the 1024×1536 pictures).

export const MOUTH_SPEC = {
  zoom: 1.6,              // face zoom, so the card frames the face like the target video
  spriteSlightFrom: 0.02, // painted-image mode: "slight" image from this openness
  spriteOpenFrom: 0.5,    // painted-image mode: "open" image from this openness
};

/** One frame of the track: opening and spread 0..1, flag 0 voiced, 1 fricative, 2 silence. */
export type MouthFrame = { open: number; spread: number; flag: number };

/**
 * Painted mouth and blink images for a trainer: {id}-mouth-slight.png, {id}-mouth-open.png, {id}-blink.png,
 * each the same 1024×1536 size as the base picture. When all three exist they replace the drawn mouth.
 */
export type TrainerSprites = { slight: string; open: string; blink: string };

export function trainerSpriteUrls(trainerId: string, dir = "/trainers"): TrainerSprites {
  return {
    slight: `${dir}/${trainerId}-mouth-slight.png`,
    open: `${dir}/${trainerId}-mouth-open.png`,
    blink: `${dir}/${trainerId}-blink.png`,
  };
}

/** Position of the zoomed stage that holds the picture and the mouth overlay together (React style object). */
export function trainerStageBox(points: TrainerFacePoints): { left: string; top: string; width: string; height: string } {
  const z = MOUTH_SPEC.zoom;
  return {
    left: `${(50 - points.mouth.x * z).toFixed(2)}%`,
    top: `${(40 - points.mouth.y * z).toFixed(2)}%`,
    width: `${z * 100}%`,
    height: `${z * 100}%`,
  };
}

/** The same position as an inline CSS string, for the SCORM HTML. */
export function trainerStageStyle(points: TrainerFacePoints): string {
  const b = trainerStageBox(points);
  return `left:${b.left};top:${b.top};width:${b.width};height:${b.height}`;
}

/**
 * Draws one frame into the overlay container. Closed mouth draws nothing, so the painted lips show.
 * Painted-image mode (all three images present) swaps the images instead of drawing.
 * Idempotent: a frame that looks the same as the last one is skipped.
 * Self-contained on purpose: the SCORM package embeds this function's source, so it may only use its arguments.
 */
export function renderMouthFrame(
  container: Element | null,
  frame: MouthFrame,
  points: TrainerFacePoints,
  idPrefix: string,
  blink: boolean,
  sprites: TrainerSprites | null,
): void {
  if (!container) return;
  const op = Math.max(0, Math.min(1, frame.open));
  const sp = Math.max(0, Math.min(1, frame.spread));
  const flag = frame.flag;

  if (sprites) {
    const band = op >= 0.5 ? 2 : op >= 0.02 ? 1 : 0;
    if (container.getAttribute("data-mode") !== "sprites") {
      const img = (role: string, src: string) =>
        `<img data-role="${role}" src="${src}" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none"/>`;
      container.innerHTML = img("sprite-slight", sprites.slight) + img("sprite-open", sprites.open) + img("sprite-blink", sprites.blink);
      container.setAttribute("data-mode", "sprites");
    }
    const show = (role: string, on: boolean) => {
      const el = container.querySelector('[data-role="' + role + '"]') as HTMLElement | null;
      if (el) el.style.opacity = on ? "1" : "0";
    };
    show("sprite-slight", band === 1);
    show("sprite-open", band === 2);
    show("sprite-blink", blink);
    return;
  }

  const sig = [Math.round(op * 100), Math.round(sp * 100), flag, blink ? 1 : 0, points.mouth.x, points.mouth.y].join("|");
  if (container.getAttribute("data-sig") === sig) return;
  container.setAttribute("data-sig", sig);
  container.setAttribute("data-mode", "drawn");

  // picture units: the 512×768 picture
  const cx = points.mouth.x * 5.12;
  const yLine = points.mouth.y * 7.68;
  const lipW = points.lipWidth * 5.12;
  const skin = points.skin;
  const lip = points.lip;
  // darker shades of the painted lip colour for the lower lip and the outline (same mix as the team's reds)
  const mix = (hex: string, k: number) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
    return "#" + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
  };
  const loLipCol = mix(lip, 0.86), outline = mix(lip, 0.45);
  const cavity = "#4f0d0c", tongue = "#c4463b", teethCol = "#f7eee6";

  let inner = "";
  if (op >= 0.05 || flag === 1) {
    const opD = Math.max(op, flag === 1 ? 0.13 : 0);
    const y0 = yLine - opD * 1.3;
    const w = lipW * (0.72 + 0.28 * sp) + opD * lipW * 0.06;
    const hh = Math.max(0.9 + 10.5 * Math.pow(opD, 1.15), flag === 1 ? 3 : 0);
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const round = 1 - Math.min(1, sp * 2.2);
    const upT = 12 + round * 2, loT = 15 + round * 3;
    const cav = "M" + x0 + " " + y0 + "Q" + cx + " " + (y0 - 3.5) + " " + x1 + " " + y0 + "Q" + cx + " " + (y0 + 2 * hh) + " " + x0 + " " + y0 + "Z";
    const upLipP = "M" + (x0 - 1) + " " + y0 + "Q" + cx + " " + (y0 - upT) + " " + (x1 + 1) + " " + y0 + "Q" + cx + " " + (y0 - 3.5) + " " + (x0 - 1) + " " + y0 + "Z";
    const loLipP = "M" + (x0 - 1) + " " + y0 + "Q" + cx + " " + (y0 + 2 * hh) + " " + (x1 + 1) + " " + y0 + "Q" + cx + " " + (y0 + 2 * hh + loT) + " " + (x0 - 1) + " " + y0 + "Z";
    const bottom = y0 + hh;
    const upTeeth = hh >= 2.2 ? Math.min(hh * 0.45, 4.2) : 0;
    const loTeeth = flag === 1 ? 1.8 : (hh > 7.5 ? Math.min((hh - 7) * 0.6, 2.2) : 0);
    const tw = w * (flag === 1 || sp > 0.65 ? 0.8 : 0.62);
    inner +=
      '<ellipse cx="' + cx + '" cy="' + (y0 + 4.2 + hh * 0.5) + '" rx="' + (w * 0.62) + '" ry="' + (14 + hh * 1.1) + '" fill="' + skin + '"/>' +
      '<path d="' + loLipP + '" fill="' + loLipCol + '"/>' +
      '<path d="' + cav + '" fill="' + cavity + '"/>' +
      '<clipPath id="' + idPrefix + '-mc"><path d="' + cav + '"/></clipPath><g clip-path="url(#' + idPrefix + '-mc)">' +
      (hh > 4.5 ? '<ellipse cx="' + cx + '" cy="' + (bottom + 0.3) + '" rx="' + (w * 0.33) + '" ry="' + (hh * 0.58) + '" fill="' + tongue + '"/>' : "") +
      (loTeeth ? '<path d="M' + (cx - tw * 0.42) + " " + (bottom + 4) + "L" + (cx + tw * 0.42) + " " + (bottom + 4) + "L" + (cx + tw * 0.42) + " " + (bottom - loTeeth * 0.5) + "Q" + cx + " " + (bottom - loTeeth * 1.6) + " " + (cx - tw * 0.42) + " " + (bottom - loTeeth * 0.5) + 'Z" fill="' + teethCol + '"/>' : "") +
      (upTeeth ? '<path d="M' + (cx - tw / 2) + " " + (y0 - 4) + "L" + (cx + tw / 2) + " " + (y0 - 4) + "L" + (cx + tw / 2) + " " + (y0 + upTeeth * 0.55) + "Q" + cx + " " + (y0 + upTeeth * 1.5) + " " + (cx - tw / 2) + " " + (y0 + upTeeth * 0.55) + 'Z" fill="' + teethCol + '"/>' : "") +
      "</g>" +
      '<path d="' + upLipP + '" fill="' + lip + '"/>' +
      '<path d="M' + (x0 + 2) + " " + (y0 - 1.6) + "Q" + cx + " " + (y0 - 5.2) + " " + (x1 - 2) + " " + (y0 - 1.6) + '" fill="none" stroke="#e0584a" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>' +
      '<path d="' + cav + '" fill="none" stroke="' + outline + '" stroke-width="0.9" stroke-linejoin="round"/>' +
      '<circle cx="' + x0 + '" cy="' + y0 + '" r="1.5" fill="' + outline + '"/><circle cx="' + x1 + '" cy="' + y0 + '" r="1.5" fill="' + outline + '"/>';
  }

  // blink: skin-coloured eyelids with a lash line, shown only while blinking
  if (blink) {
    const eye = (e: FacePoint) => {
      const ex = e.x * 5.12, ey = e.y * 7.68;
      return '<ellipse cx="' + ex + '" cy="' + ey + '" rx="19" ry="8.5" fill="' + skin + '"/>' +
        '<path d="M' + (ex - 18) + " " + (ey - 2) + "Q" + ex + " " + (ey + 6) + " " + (ex + 18) + " " + (ey - 2) + '" fill="none" stroke="#080303" stroke-width="3" stroke-linecap="round"/>';
    };
    inner += eye(points.eyeLeft) + eye(points.eyeRight);
  }

  container.innerHTML = '<svg viewBox="0 0 512 768" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible">' + inner + "</svg>";
}

/** The mouth frame for a time in the track: opening and spread are interpolated, the flag is the nearest frame. */
export function mouthFrameAt(track: string, t: number): MouthFrame {
  const n = Math.floor(track.length / 3);
  if (n === 0) return { open: 0, spread: 0.5, flag: 2 };
  const pos = Math.max(0, t) * 50;
  const k = Math.floor(pos);
  const a = pos - k;
  const at = (m: number) => {
    const j = Math.max(0, Math.min(n - 1, m));
    return [track.charCodeAt(3 * j) - 48, track.charCodeAt(3 * j + 1) - 48, track.charCodeAt(3 * j + 2) - 48];
  };
  const A = at(k), B = at(k + 1);
  return { open: (A[0] + (B[0] - A[0]) * a) / 9, spread: (A[1] + (B[1] - A[1]) * a) / 9, flag: a < 0.5 ? A[2] : B[2] };
}
