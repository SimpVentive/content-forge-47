import { describe, expect, it } from "vitest";
import { safeLearnerText, stripNarratorMarkdown } from "@/lib/textCleaningUtility";

describe("video production cues never reach learners", () => {
  it.each([
    "[ACTION: Avatar stands centered, gesturing toward the screens.]",
    "[VIDEO CUE: Close-up on the whiteboard]",
    "[PAUSE 2s]",
    "[WHITEBOARD: diagram needed? yes]",
    "[DIAGRAM TYPE: flowchart]",
  ])("removes %s", (cue) => {
    expect(stripNarratorMarkdown(cue)).toBe("");
    expect(safeLearnerText(cue)).toBe("");
  });

  it("keeps the learner sentence that follows a cue", () => {
    expect(safeLearnerText("[ACTION: Avatar nods.] Think about the last time a meeting turned into a pressure cooker.")).toBe(
      "Think about the last time a meeting turned into a pressure cooker.",
    );
  });

  it("does not strip square brackets that are ordinary text", () => {
    expect(safeLearnerText("Use the [Safety] checklist before work.")).toBe("Use the [Safety] checklist before work.");
  });
});
