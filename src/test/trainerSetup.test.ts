import { describe, expect, it } from "vitest";
import {
  MAX_CLIP_BYTES,
  checkClipFile,
  checkVoiceSettings,
  clipPath,
  countClips,
  safeClipName,
} from "@/lib/trainerSetup";

describe("checkClipFile", () => {
  it("accepts an MP4 under the size limit", () => {
    expect(checkClipFile("harish.mp4", 5_000_000).ok).toBe(true);
    expect(checkClipFile("HARISH.MP4", 5_000_000).ok).toBe(true);
  });
  it("refuses other file types", () => {
    expect(checkClipFile("clip.mov", 1000).ok).toBe(false);
    expect(checkClipFile("clip.mp3", 1000).ok).toBe(false);
  });
  it("refuses empty and oversized files", () => {
    expect(checkClipFile("a.mp4", 0).ok).toBe(false);
    expect(checkClipFile("a.mp4", MAX_CLIP_BYTES + 1).ok).toBe(false);
    expect(checkClipFile("a.mp4", MAX_CLIP_BYTES).ok).toBe(true);
  });
});

describe("safeClipName and clipPath", () => {
  it("keeps letters, numbers, dashes and dots safe", () => {
    expect(safeClipName("Harish base (final) #2.mp4")).toBe("Harish-base-final-2.mp4");
  });
  it("uses a fallback when nothing safe is left", () => {
    expect(safeClipName("###.mp4")).toBe("clip.mp4");
  });
  it("puts the clip under the owner's trainer folder", () => {
    expect(clipPath("user-1", "trainer-9", "base.mp4")).toBe("user-1/trainer-9/clips/base.mp4");
  });
});

describe("countClips", () => {
  it("counts only MP4 names in a folder listing", () => {
    expect(countClips(["a.mp4", "b.MP4", "notes.txt", "c.mov"])).toBe(2);
    expect(countClips([])).toBe(0);
  });
});

describe("checkVoiceSettings", () => {
  it("accepts the defaults", () => {
    const r = checkVoiceSettings(0.5, 0.3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.settings).toEqual({ stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true });
  });
  it("accepts the edges of the approved ranges", () => {
    expect(checkVoiceSettings(0.35, 0.2).ok).toBe(true);
    expect(checkVoiceSettings(0.5, 0.4).ok).toBe(true);
  });
  it("refuses values outside the approved ranges", () => {
    expect(checkVoiceSettings(0.2, 0.3).ok).toBe(false);
    expect(checkVoiceSettings(0.6, 0.3).ok).toBe(false);
    expect(checkVoiceSettings(0.5, 0.5).ok).toBe(false);
    expect(checkVoiceSettings(Number.NaN, 0.3).ok).toBe(false);
  });
});
