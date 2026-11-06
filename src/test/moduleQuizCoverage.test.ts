import { describe, expect, it } from "vitest";

import { collectAssessmentItems } from "@/lib/assessmentAnswer";
import { allocateQuestionsPerModule, buildSlides, getTargetCourseQuestionCount } from "@/lib/slideBuilder";

/**
 * A course whose Setup asked for MCQ + Match the Following + Fill in the Blanks.
 * The Assessment Agent spreads items across all four modules, but most of them
 * come back as match-the-following / fill-in-the-blank.
 */
const bank = {
  mcq: [
    { module_title: "Camera Selection", topic_title: "Bullet Cameras", question: "Q1", options: ["a", "b", "c", "d"], correct_answer: "a" },
  ],
  match_the_following: [
    { module_title: "Camera Selection", topic_title: "Bullet Cameras", column_a: ["Bullet"], column_b: ["Deterrent"], correct_pairings: [{ a: "Bullet", b: "Deterrent" }] },
    { module_title: "Storage Choice", topic_title: "DVR vs NVR", column_a: ["DVR"], column_b: ["Coax"], correct_pairings: [{ a: "DVR", b: "Coax" }] },
    { module_title: "Cabling", topic_title: "Coaxial", column_a: ["RG59"], column_b: ["Coax"], correct_pairings: [{ a: "RG59", b: "Coax" }] },
    { module_title: "Handover", topic_title: "Docs", column_a: ["Punch list"], column_b: ["Sign-off"], correct_pairings: [{ a: "Punch list", b: "Sign-off" }] },
  ],
  fill_blanks: [
    { module_title: "Storage Choice", topic_title: "DVR vs NVR", passage: "A ___ records on the network.", correct_answer: "NVR" },
    { module_title: "Cabling", topic_title: "Coaxial", passage: "RG59 is a ___ cable.", correct_answer: "coaxial" },
  ],
  scenarios: [
    { module_title: "Handover", topic_title: "Docs", situation: "Client wants it live today.", options: ["Ship", "Document", "Wing it"], best_response: "Document" },
  ],
  true_false: [
    { module_title: "Camera Selection", topic_title: "Dome Cameras", question: "Domes hide aim?", correct_answer: "True." },
  ],
  reflection: { prompt: "What will you change tomorrow?" },
};

const rawOutputs = {
  architect: JSON.stringify({
    modules: [
      { module_title: "Camera Selection", topics: ["Bullet Cameras", "Dome Cameras"] },
      { module_title: "Storage Choice", topics: ["DVR vs NVR"] },
      { module_title: "Cabling", topics: ["Coaxial"] },
      { module_title: "Handover", topics: ["Docs"] },
    ],
  }),
  writer: [
    "## Module 1: Camera Selection",
    "### Bullet Cameras",
    "Bullet cameras are a visible deterrent. Their long barrel makes aim obvious to anyone walking the perimeter.",
    "### Dome Cameras",
    "Dome cameras hide the direction of aim, so visitors cannot tell which way the lens is pointing.",
    "## Module 2: Storage Choice",
    "### DVR vs NVR",
    "A DVR encodes at the box and needs coaxial cable. An NVR encodes at the camera and can run on network cable.",
    "## Module 3: Cabling",
    "### Coaxial",
    "RG59 is the usual coaxial cable for analogue runs. Keep each run within its rated distance or the picture softens.",
    "## Module 4: Handover",
    "### Docs",
    "Handover is complete when the client signs the punch list and the camera map matches the installed positions.",
  ].join("\n\n"),
  assessment: JSON.stringify(bank),
  visual: "{}",
  diagrams: "{}",
} as any;

function quizCountPerModule(slides: any[]) {
  const counts: Record<number, number> = {};
  for (const slide of slides) {
    if (slide.type === "assessment") counts[slide.moduleIndex] = (counts[slide.moduleIndex] || 0) + 1;
  }
  return counts;
}

describe("every module keeps a quiz", () => {
  it("counts every authored item type, not only MCQ-shaped ones", () => {
    const items = collectAssessmentItems(bank);
    // 1 MCQ + 4 match + 2 fill + 1 scenario + 1 true/false = 9 authored items.
    expect(items.length).toBe(9);
  });

  it("keeps a true/false key written with trailing punctuation", () => {
    const items = collectAssessmentItems(bank);
    const trueFalse = items.find((item: any) => item.question === "Domes hide aim?");
    expect(trueFalse?.correct_answer).toBe("True");
  });

  it("gives each of the four modules at least one quiz", () => {
    const { slides } = buildSlides(rawOutputs, [], "30 min", 10, "standard");
    const counts = quizCountPerModule(slides);
    expect([0, 1, 2, 3].every((moduleIndex) => (counts[moduleIndex] || 0) >= 1)).toBe(true);
  });

  it("does not cap the bank below one question per module", () => {
    const modules = [
      { title: "A", topics: ["t1"] },
      { title: "B", topics: ["t2"] },
      { title: "C", topics: ["t3"] },
    ];
    // A bank of exactly three usable items must still reach all three modules.
    expect(allocateQuestionsPerModule(modules, 3)).toEqual([1, 1, 1]);
    // The target for a short course is never below the module count it must cover.
    expect(getTargetCourseQuestionCount(5, "light")).toBeGreaterThanOrEqual(3);
  });
});
