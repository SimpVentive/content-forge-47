import type { FacePoint, TrainerFacePoints } from "@/lib/trainerFacePoints";

// One mouth and blink for the app narrator AND the SCORM card. Both import this file, so they look the same.
// Every size is in % of the trainer picture (1024×1536), so it scales with the card.
export const MOUTH_SPEC = {
  zoom: 1.6,            // face zoom, so the card frames the face like the target video
  openRx: 3.7,          // opening half-width: narrower than the painted lips
  ryMin: 0.2,           // opening half-height when just opening
  ryRange: 0.8,         // added at full openness (opening at most about 2% of the picture height)
  interior: "#6b3a2a",  // warm brown, softer than near-black
  interiorOpacity: 0.9,
  teethShowFrom: 0.5,   // openness at which the upper teeth appear
  teethMin: 0.6,        // teeth strip height, minimum (% of picture height)
  teethShare: 0.8,      // teeth strip height as a share of the opening height
  teeth: "#ffffff",
  eyeRx: 4.4,           // eyelid half-width (% of picture width)
  eyeRy: 1.1,           // eyelid half-height when the eye is open-size (% of picture height)
  blinkRy: 1.1,         // eyelid half-height while blinking
  spriteSlightFrom: 0.02, // painted-image mode: "slight" image from this openness
  spriteOpenFrom: 0.5,    // painted-image mode: "open" image from this openness
};

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
 * Overlay for the stage. With sprites it holds the three painted images (all hidden until used);
 * without them it holds the drawn mouth and skin-coloured eyelids. Numbers and trusted URLs only.
 */
export function trainerOverlayMarkup(points: TrainerFacePoints, idPrefix: string, sprites?: TrainerSprites): string {
  if (sprites) {
    const img = (role: string, src: string) =>
      `<img data-role="${role}" src="${src}" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none"/>`;
    return img("sprite-slight", sprites.slight) + img("sprite-open", sprites.open) + img("sprite-blink", sprites.blink);
  }
  const m = points.mouth;
  const lid = (e: FacePoint) => `<ellipse data-role="lid" cx="${e.x}" cy="${e.y}" rx="${MOUTH_SPEC.eyeRx}" ry="0" fill="${points.skin}"/>`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible">`
    + `<defs><clipPath id="${idPrefix}-mouth-clip"><ellipse data-role="clip" cx="${m.x}" cy="${m.y}" rx="${MOUTH_SPEC.openRx}" ry="0.3"/></clipPath></defs>`
    + lid(points.eyeLeft) + lid(points.eyeRight)
    + `<g data-role="mouth" data-cy="${m.y}" opacity="0">`
    + `<ellipse data-role="opening" cx="${m.x}" cy="${m.y}" rx="${MOUTH_SPEC.openRx}" ry="0.3" fill="${MOUTH_SPEC.interior}" fill-opacity="${MOUTH_SPEC.interiorOpacity}" stroke="#8a4a42" stroke-opacity="0.6" stroke-width="0.6" vector-effect="non-scaling-stroke"/>`
    + `<rect data-role="teeth" clip-path="url(#${idPrefix}-mouth-clip)" x="${(m.x - MOUTH_SPEC.openRx).toFixed(2)}" y="${m.y}" width="${(MOUTH_SPEC.openRx * 2).toFixed(2)}" height="${MOUTH_SPEC.teethMin}" fill="${MOUTH_SPEC.teeth}" opacity="0"/>`
    + `</g></svg>`;
}

/**
 * Sets the mouth from openness (0 closed, 1 fully open), in either mode.
 * Closed always shows the painted lips (nothing drawn on top).
 * Self-contained on purpose: the SCORM template embeds this function's source, so it may only use
 * MOUTH_SPEC and its arguments.
 */
export function applyMouthOpenness(root: ParentNode | null, openness: number): void {
  if (!root) return;
  const o = Math.max(0, Math.min(1, openness));
  const slight = root.querySelector('[data-role="sprite-slight"]');
  if (slight) {
    const open = root.querySelector('[data-role="sprite-open"]');
    if (!open) return;
    slight.setAttribute("style", slight.getAttribute("style").replace(/opacity:[^;]*/, "opacity:" + (o >= MOUTH_SPEC.spriteSlightFrom && o < MOUTH_SPEC.spriteOpenFrom ? "1" : "0")));
    open.setAttribute("style", open.getAttribute("style").replace(/opacity:[^;]*/, "opacity:" + (o >= MOUTH_SPEC.spriteOpenFrom ? "1" : "0")));
    return;
  }
  const group = root.querySelector('[data-role="mouth"]');
  const opening = root.querySelector('[data-role="opening"]');
  const clip = root.querySelector('[data-role="clip"]');
  const teeth = root.querySelector('[data-role="teeth"]');
  if (!group || !opening || !clip || !teeth) return;
  const cy = parseFloat(group.getAttribute("data-cy") || "0");
  const ry = o > 0.02 ? MOUTH_SPEC.ryMin + MOUTH_SPEC.ryRange * o : 0;
  group.setAttribute("opacity", ry > 0 ? "1" : "0");
  opening.setAttribute("ry", ry.toFixed(2));
  clip.setAttribute("ry", Math.max(ry, 0.01).toFixed(2));
  teeth.setAttribute("y", (cy - ry).toFixed(2));
  teeth.setAttribute("height", Math.max(MOUTH_SPEC.teethMin, ry * MOUTH_SPEC.teethShare).toFixed(2));
  teeth.setAttribute("opacity", o >= MOUTH_SPEC.teethShowFrom ? "1" : "0");
}

/** Blink: closes the eyelids (drawn: skin colour; painted: the blink image) or opens them. Same self-contained rule. */
export function setTrainerBlink(root: ParentNode | null, closed: boolean): void {
  if (!root) return;
  const blink = root.querySelector('[data-role="sprite-blink"]');
  if (blink) {
    blink.setAttribute("style", blink.getAttribute("style").replace(/opacity:[^;]*/, "opacity:" + (closed ? "1" : "0")));
    return;
  }
  const lids = root.querySelectorAll('[data-role="lid"]');
  for (let i = 0; i < lids.length; i++) {
    lids[i].setAttribute("ry", closed ? String(MOUTH_SPEC.blinkRy) : "0");
  }
}
