// Rules for the "Change how a trainer comes alive" dialog. Pure functions, no network.

export type SwitchTarget = "video" | "photos" | null;
export type ActiveOption = "video" | "photos";

/**
 * Whether Save may be used. Switching to the option that is already active is allowed only for photos, and only when
 * new photos were chosen in this dialog (so the photos can be replaced or added). The four required photos must pass.
 */
export function canSaveSwitch(args: {
  target: SwitchTarget;
  current: ActiveOption;
  photosReady: boolean;
  newPhotoCount: number;
  busy: boolean;
}): boolean {
  if (args.busy || !args.target) return false;
  if (args.target === "photos") {
    if (!args.photosReady) return false;
    return args.current !== "photos" || args.newPhotoCount > 0;
  }
  return args.current !== "video";
}

/** A short reason to show when Save is off only because nothing has changed. */
export function unchangedHint(args: { target: SwitchTarget; current: ActiveOption; newPhotoCount: number }): string | null {
  if (args.target === "photos" && args.current === "photos" && args.newPhotoCount === 0) {
    return "Upload new photos to save changes.";
  }
  return null;
}
