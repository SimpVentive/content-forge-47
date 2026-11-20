import { describe, expect, it } from "vitest";
import { canSaveSwitch, unchangedHint } from "@/lib/switchOption";

const base = { busy: false, photosReady: true, newPhotoCount: 0 };

describe("canSaveSwitch", () => {
  it("is off until an option is chosen, and while saving", () => {
    expect(canSaveSwitch({ ...base, target: null, current: "video" })).toBe(false);
    expect(canSaveSwitch({ ...base, target: "photos", current: "video", busy: true })).toBe(false);
  });

  it("switches from video to photos only when the four required photos pass", () => {
    expect(canSaveSwitch({ ...base, target: "photos", current: "video" })).toBe(true);
    expect(canSaveSwitch({ ...base, target: "photos", current: "video", photosReady: false })).toBe(false);
  });

  it("switches from photos to video", () => {
    expect(canSaveSwitch({ ...base, target: "video", current: "photos" })).toBe(true);
  });

  it("does not save video again when video is already active", () => {
    expect(canSaveSwitch({ ...base, target: "video", current: "video" })).toBe(false);
  });

  it("lets photos be replaced while photos are active, once new photos are chosen and pass", () => {
    expect(canSaveSwitch({ ...base, target: "photos", current: "photos", newPhotoCount: 1 })).toBe(true);
    expect(canSaveSwitch({ ...base, target: "photos", current: "photos", newPhotoCount: 4, photosReady: false })).toBe(false);
  });

  it("does not save unchanged photos", () => {
    expect(canSaveSwitch({ ...base, target: "photos", current: "photos", newPhotoCount: 0 })).toBe(false);
  });
});

describe("unchangedHint", () => {
  it("explains what to do only when photos are active and nothing new is chosen", () => {
    expect(unchangedHint({ target: "photos", current: "photos", newPhotoCount: 0 })).toMatch(/Upload new photos/);
    expect(unchangedHint({ target: "photos", current: "photos", newPhotoCount: 2 })).toBeNull();
    expect(unchangedHint({ target: "photos", current: "video", newPhotoCount: 0 })).toBeNull();
    expect(unchangedHint({ target: null, current: "photos", newPhotoCount: 0 })).toBeNull();
  });
});
