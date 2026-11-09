import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/edgeFunctions", () => ({ callEdgeFunction: vi.fn() }));

import {
  HEYGEN_ESTIMATE_USD_PER_MINUTE,
  SAMPLE_MAX_WORDS,
  estimateCostUsd,
  estimateSeconds,
  sampleSentence,
  wordsIn,
} from "@/lib/customTrainerVideo";

describe("talking video estimates", () => {
  it("counts words and converts them to seconds at narration pace", () => {
    expect(wordsIn("  one two   three ")).toBe(3);
    expect(wordsIn("   ")).toBe(0);
    // 150 words is one minute of narration
    const oneMinute = Array(150).fill("word").join(" ");
    expect(estimateSeconds([oneMinute])).toBe(60);
    expect(estimateSeconds([oneMinute, oneMinute])).toBe(120);
  });

  it("estimates cost from the per-minute rate and rounds to cents", () => {
    expect(estimateCostUsd(60)).toBe(HEYGEN_ESTIMATE_USD_PER_MINUTE);
    expect(estimateCostUsd(0)).toBe(0);
    expect(estimateCostUsd(10)).toBe(0.5);
  });

  it("takes the first sentence for the sample, cut to about 10 seconds", () => {
    expect(sampleSentence(["Hello there. This is the second sentence."])).toBe("Hello there.");
    const long = Array(40).fill("word").join(" ") + ".";
    expect(wordsIn(sampleSentence([long]))).toBe(SAMPLE_MAX_WORDS);
    expect(sampleSentence(["", "  Next one! "])).toBe("Next one!");
  });
});
