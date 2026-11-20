import { describe, expect, it } from "vitest";
import { lessonKey, lessonsFromIssues, mergeLessons, rankLessons, lessonsPromptBlock, type QaLesson } from "@/lib/qaLessons";
import { excerptForReview } from "@/lib/qaService";

const lesson = (over: Partial<QaLesson>): QaLesson => ({
  lessonKey: "k",
  lesson: "Every lesson must end with a complete sentence.",
  category: "completeness",
  section: "script",
  timesSeen: 1,
  timesConfirmed: 0,
  timesDismissed: 0,
  lastSeenAt: "2026-11-20T00:00:00.000Z",
  ...over,
});

describe("quality-check lessons", () => {
  it("treats the same rule with different punctuation as one lesson", () => {
    expect(lessonKey("Every question MUST test the script!")).toBe(lessonKey("every question must test the script"));
  });

  it("learns only medium-or-worse findings that carry a general rule", () => {
    const found = lessonsFromIssues([
      { severity: "high", lesson: "Every assessment question must test a point taught in the script.", location: "Assessment" },
      { severity: "low", lesson: "Use slightly shorter headings across every module." },
      { severity: "critical", lesson: null },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].section).toBe("assessment");
  });

  it("does not use a single unconfirmed finding, but does once it is accepted or found again", () => {
    expect(rankLessons([lesson({ timesSeen: 1 })])).toHaveLength(0);
    expect(rankLessons([lesson({ timesSeen: 1, timesConfirmed: 1 })])).toHaveLength(1);
    expect(rankLessons([lesson({ timesSeen: 2 })])).toHaveLength(1);
  });

  it("drops a lesson the author skipped as often as it was found", () => {
    expect(rankLessons([lesson({ timesSeen: 2, timesDismissed: 1 })])).toHaveLength(0);
  });

  it("counts a finding again, then the author's acceptance, on the same lesson", () => {
    const found = lessonsFromIssues([{ severity: "high", lesson: "Every lesson must end with a complete sentence." }]);
    const afterSeen = mergeLessons([lesson({ lessonKey: found[0].lessonKey, timesSeen: 1 })], found, "seen");
    const afterApply = mergeLessons(afterSeen, found, "confirmed");
    expect(afterApply[0]).toMatchObject({ timesSeen: 2, timesConfirmed: 1, timesDismissed: 0 });
  });

  it("puts at most 8 lessons into the agents' instructions, strongest first", () => {
    const many = Array.from({ length: 12 }, (_, i) => lesson({ lessonKey: `k${i}`, lesson: `Rule number ${i} for every course.`, timesSeen: 2 + i }));
    const block = lessonsPromptBlock(many);
    expect(block.match(/^- /gm)).toHaveLength(8);
    expect(block.indexOf("Rule number 11")).toBeLessThan(block.indexOf("Rule number 10"));
  });
});

describe("quality-check review excerpts", () => {
  it("shows short sections in full", () => {
    expect(excerptForReview("A full short script.", 100, "(none)")).toBe("A full short script.");
  });

  it("marks a shortened section instead of cutting it silently mid-word", () => {
    const text = "First sentence here. ".repeat(50);
    const out = excerptForReview(text, 200, "(none)");
    expect(out).toContain("[REVIEW EXCERPT ENDS");
    expect(out.split("\n")[0].trimEnd().endsWith(".")).toBe(true);
  });
});
