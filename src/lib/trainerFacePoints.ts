// Trainer face points, in % of the 1024×1536 picture. This is the single place they are measured.
// AvatarNarrator (the app) and scormExport.ts (the SCORM package) both import from here.
export type FacePoint = { x: number; y: number };
// skin: colour of the skin just above the eyes, used for the eyelid during a blink.
// lip: painted lip colour (new lips are drawn in it). lipWidth: painted mouth width, % of picture width.
// lipPx: painted lips measured by hand on the 1024×1536 picture: left corner, right corner and mouth line (pixels).
// mouth and lipWidth are derived from lipPx.
export type TrainerFacePoints = { eyeLeft: FacePoint; eyeRight: FacePoint; mouth: FacePoint; skin: string; lip: string; lipWidth: number; lipPx: { left: number; right: number; line: number }; mouthSkin: string };
// mouthSkin: skin just beside the painted mouth corners; the cover over the painted lips uses it.

export const TRAINER_FACE_POINTS: Record<string, TrainerFacePoints> = {
  priya:      { eyeLeft: { x: 56.64, y: 27.99 }, eyeRight: { x: 43.65, y: 27.99 }, mouth: { x: 49.9, y: 35.61 }, skin: "#c48453", lip: "#aa4a32", lipWidth: 10.55, lipPx: { left: 457, right: 565, line: 547 }, mouthSkin: "#d7915b" },
  arjun:      { eyeLeft: { x: 54.98, y: 26.43 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 48.83, y: 34.38 }, skin: "#de9153", lip: "#ba6439", lipWidth: 10.16, lipPx: { left: 448, right: 552, line: 528 }, mouthSkin: "#dc8f52" },
  soumya:     { eyeLeft: { x: 55.66, y: 26.69 }, eyeRight: { x: 42.97, y: 26.89 }, mouth: { x: 49.22, y: 33.98 }, skin: "#e08b4e", lip: "#c23c23", lipWidth: 9.57, lipPx: { left: 455, right: 553, line: 522 }, mouthSkin: "#de8a4d" },
  vedprakash: { eyeLeft: { x: 54.30, y: 25.59 }, eyeRight: { x: 42.68, y: 25.59 }, mouth: { x: 48.39, y: 33.07 }, skin: "#d98e5a", lip: "#bc613e", lipWidth: 10.25, lipPx: { left: 443, right: 548, line: 508 }, mouthSkin: "#d68a55" },
  atul:       { eyeLeft: { x: 53.71, y: 25.98 }, eyeRight: { x: 41.99, y: 25.98 }, mouth: { x: 48.14, y: 33.53 }, skin: "#d4844a", lip: "#cb753f", lipWidth: 10.94, lipPx: { left: 437, right: 549, line: 515 }, mouthSkin: "#c6723a" },
  irina:      { eyeLeft: { x: 55.37, y: 26.69 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 49.02, y: 33.92 }, skin: "#eca97b", lip: "#d2674d", lipWidth: 9.77, lipPx: { left: 452, right: 552, line: 521 }, mouthSkin: "#eca87b" },
  john:       { eyeLeft: { x: 53.32, y: 25.98 }, eyeRight: { x: 42.29, y: 25.98 }, mouth: { x: 48.0, y: 33.33 }, skin: "#eb9a6a", lip: "#a85a4c", lipWidth: 10.45, lipPx: { left: 438, right: 545, line: 512 }, mouthSkin: "#da8658" },
};

export const DEFAULT_FACE: TrainerFacePoints = { eyeLeft: { x: 55, y: 27 }, eyeRight: { x: 43, y: 27 }, mouth: { x: 48.5, y: 34.5 }, skin: "#d9a07a", lip: "#b5604f", lipWidth: 10.5, lipPx: { left: 450, right: 550, line: 530 }, mouthSkin: "#d9a07a" };
