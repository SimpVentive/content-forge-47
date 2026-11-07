// Trainer face points, in % of the 1024×1536 picture. This is the single place they are measured.
// AvatarNarrator (the app) and scormExport.ts (the SCORM package) both import from here.
export type FacePoint = { x: number; y: number };
// skin: colour of the skin just above the eyes, used for the eyelid during a blink.
// lip: painted lip colour (new lips are drawn in it). lipWidth: painted mouth width, % of picture width.
export type TrainerFacePoints = { eyeLeft: FacePoint; eyeRight: FacePoint; mouth: FacePoint; skin: string; lip: string; lipWidth: number };

export const TRAINER_FACE_POINTS: Record<string, TrainerFacePoints> = {
  priya:      { eyeLeft: { x: 56.64, y: 27.99 }, eyeRight: { x: 43.65, y: 27.99 }, mouth: { x: 49.32, y: 35.81 }, skin: "#c48453", lip: "#aa4a32", lipWidth: 10.5 },
  arjun:      { eyeLeft: { x: 54.98, y: 26.43 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 47.66, y: 34.64 }, skin: "#de9153", lip: "#ba6439", lipWidth: 10.5 },
  soumya:     { eyeLeft: { x: 55.66, y: 26.69 }, eyeRight: { x: 42.97, y: 26.89 }, mouth: { x: 48.63, y: 34.44 }, skin: "#e08b4e", lip: "#c23c23", lipWidth: 10.5 },
  vedprakash: { eyeLeft: { x: 54.30, y: 25.59 }, eyeRight: { x: 42.68, y: 25.59 }, mouth: { x: 48.34, y: 33.33 }, skin: "#d98e5a", lip: "#bc613e", lipWidth: 10.5 },
  atul:       { eyeLeft: { x: 53.71, y: 25.98 }, eyeRight: { x: 41.99, y: 25.98 }, mouth: { x: 47.36, y: 34.24 }, skin: "#d4844a", lip: "#cb753f", lipWidth: 10.5 },
  irina:      { eyeLeft: { x: 55.37, y: 26.69 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 48.63, y: 34.64 }, skin: "#eca97b", lip: "#d2674d", lipWidth: 10.5 },
  john:       { eyeLeft: { x: 53.32, y: 25.98 }, eyeRight: { x: 42.29, y: 25.98 }, mouth: { x: 47.9, y: 33.9 }, skin: "#eb9a6a", lip: "#a85a4c", lipWidth: 10.5 },
};

export const DEFAULT_FACE: TrainerFacePoints = { eyeLeft: { x: 55, y: 27 }, eyeRight: { x: 43, y: 27 }, mouth: { x: 48.5, y: 34.5 }, skin: "#d9a07a", lip: "#b5604f", lipWidth: 10.5 };
