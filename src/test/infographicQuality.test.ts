import { describe, it, expect } from "vitest";
import { assessInfographicSvg } from "@/lib/infographicQuality";

describe("infographic quality rule", () => {
  it("rejects a sparse formula widget like the bitrate calculator", () => {
    const svg = `<svg viewBox="0 0 1200 800"><rect/><line/><text>BITRATE x 10.8 x CAMERAS x DAYS</text><text>H.265 COMPRESSION = 50% SAVINGS</text><rect/><text>CALCULATE</text></svg>`;
    expect(assessInfographicSvg(svg).ok).toBe(false);
  });
  it("accepts a labelled teaching diagram", () => {
    const t = ["Storage needed grows with every camera", "Bitrate", "data per second per camera", "10.8", "converts Mbps to GB per day", "Cameras", "number of cameras recording", "Days", "how long footage is kept", "Example: 4 Mbps x 10.8 x 8 x 30 = 10,368 GB"];
    const svg = `<svg viewBox="0 0 1200 800">${"<rect/>".repeat(6)}${t.map((x) => `<text>${x}</text>`).join("")}</svg>`;
    expect(assessInfographicSvg(svg).ok).toBe(true);
  });
});
