import { describe, it, expect } from "vitest";
import { getCompletionBlockers, getFurthestReachableSlide } from "@/lib/learnerProgression";

const slides = [{ type: "title" }, { type: "content" }, { type: "content" }, { type: "assessment" }, { type: "summary" }];

describe("learner progression rule", () => {
  it("on the cover, only the next screen is reachable — the summary is locked", () => {
    expect(getFurthestReachableSlide(slides, new Set([0]), 0, new Set())).toBe(1);
  });

  it("stops at an unanswered knowledge check", () => {
    expect(getFurthestReachableSlide(slides, new Set([0, 1, 2, 3]), 3, new Set())).toBe(3);
    expect(getFurthestReachableSlide(slides, new Set([0, 1, 2, 3]), 3, new Set([3]))).toBe(4);
  });

  it("blocks completion until every screen is viewed and every check answered", () => {
    expect(getCompletionBlockers(slides, new Set([0]), 4, new Set())).toEqual({ unseen: [1, 2, 3], unanswered: [3] });
    expect(getCompletionBlockers(slides, new Set([0, 1, 2, 3]), 4, new Set([3]))).toEqual({ unseen: [], unanswered: [] });
  });
});
