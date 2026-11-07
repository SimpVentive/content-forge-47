// Trainer face points, in % of the 1024×1536 picture. This is the single place they are measured.
// AvatarNarrator (the app) and scormExport.ts (the SCORM package) both import from here.
export type FacePoint = { x: number; y: number };
export type TrainerFacePoints = { eyeLeft: FacePoint; eyeRight: FacePoint; mouth: FacePoint };

export const TRAINER_FACE_POINTS: Record<string, TrainerFacePoints> = {
  priya:      { eyeLeft: { x: 56.64, y: 27.99 }, eyeRight: { x: 43.65, y: 27.99 }, mouth: { x: 49.32, y: 35.81 } },
  arjun:      { eyeLeft: { x: 54.98, y: 26.43 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 47.66, y: 34.64 } },
  soumya:     { eyeLeft: { x: 55.66, y: 26.69 }, eyeRight: { x: 42.97, y: 26.89 }, mouth: { x: 48.63, y: 34.44 } },
  vedprakash: { eyeLeft: { x: 54.30, y: 25.59 }, eyeRight: { x: 42.68, y: 25.59 }, mouth: { x: 48.34, y: 33.33 } },
  atul:       { eyeLeft: { x: 53.71, y: 25.98 }, eyeRight: { x: 41.99, y: 25.98 }, mouth: { x: 47.36, y: 34.24 } },
  irina:      { eyeLeft: { x: 55.37, y: 26.69 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 48.63, y: 34.64 } },
  john:       { eyeLeft: { x: 53.32, y: 25.98 }, eyeRight: { x: 42.29, y: 25.98 }, mouth: { x: 47.9, y: 33.9 } },
};

export const DEFAULT_FACE: TrainerFacePoints = { eyeLeft: { x: 55, y: 27 }, eyeRight: { x: 43, y: 27 }, mouth: { x: 48.5, y: 34.5 } };
