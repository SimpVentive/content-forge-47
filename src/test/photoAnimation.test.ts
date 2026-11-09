import { describe, expect, it } from "vitest";
import { renderMouthFrame } from "@/lib/trainerMouth";
import { DEFAULT_FACE } from "@/lib/trainerFacePoints";

describe("Option 2 photo animation", () => {
  const sprites = { slight: "eh.jpg", open: "ah.jpg", blink: "blink.jpg" };

  it("fits the mouth and blink photos exactly like the base photo", () => {
    const container = document.createElement("div");
    renderMouthFrame(container, { open: 0.5, spread: 0.5, flag: 0 }, DEFAULT_FACE, "t", false, sprites);
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(3);
    for (const img of images) expect(img.getAttribute("style")).toContain("object-fit: cover");
  });

  it("shows the open photo for a wide mouth and the slight photo for a small one", () => {
    const container = document.createElement("div");
    renderMouthFrame(container, { open: 0.8, spread: 0.5, flag: 0 }, DEFAULT_FACE, "t", false, sprites);
    expect(container.querySelector('[data-role="sprite-open"]')?.getAttribute("style")).toContain("opacity: 1");
    renderMouthFrame(container, { open: 0.1, spread: 0.5, flag: 0 }, DEFAULT_FACE, "t", false, sprites);
    expect(container.querySelector('[data-role="sprite-slight"]')?.getAttribute("style")).toContain("opacity: 1");
  });
});
