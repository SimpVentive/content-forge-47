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
};

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

/** SVG overlay: eyelids (skin colour) and the mouth opening with its teeth strip. Numbers only, no user text. */
export function trainerOverlayMarkup(points: TrainerFacePoints, idPrefix: string): string {
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
 * Sets the mouth from openness (0 closed, 1 fully open).
 * Self-contained on purpose: the SCORM template embeds this function's source, so it may only use
 * MOUTH_SPEC and its arguments.
 */
export function applyMouthOpenness(root: ParentNode | null, openness: number): void {
  if (!root) return;
  const group = root.querySelector('[data-role="mouth"]');
  const opening = root.querySelector('[data-role="opening"]');
  const clip = root.querySelector('[data-role="clip"]');
  const teeth = root.querySelector('[data-role="teeth"]');
  if (!group || !opening || !clip || !teeth) return;
  const o = Math.max(0, Math.min(1, openness));
  const cy = parseFloat(group.getAttribute("data-cy") || "0");
  const ry = o > 0.02 ? MOUTH_SPEC.ryMin + MOUTH_SPEC.ryRange * o : 0;
  group.setAttribute("opacity", ry > 0 ? "1" : "0");
  opening.setAttribute("ry", ry.toFixed(2));
  clip.setAttribute("ry", Math.max(ry, 0.01).toFixed(2));
  teeth.setAttribute("y", (cy - ry).toFixed(2));
  teeth.setAttribute("height", Math.max(MOUTH_SPEC.teethMin, ry * MOUTH_SPEC.teethShare).toFixed(2));
  teeth.setAttribute("opacity", o >= MOUTH_SPEC.teethShowFrom ? "1" : "0");
}

/** Closes the eyelids (skin colour) for a blink, or opens them. Same self-contained rule as above. */
export function setTrainerBlink(root: ParentNode | null, closed: boolean): void {
  if (!root) return;
  const lids = root.querySelectorAll('[data-role="lid"]');
  for (let i = 0; i < lids.length; i++) {
    lids[i].setAttribute("ry", closed ? String(MOUTH_SPEC.blinkRy) : "0");
  }
}
