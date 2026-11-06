import { describe, expect, it } from "vitest";

import {
  assessmentKindOf,
  collectAssessmentItems,
  fillBlankAnswers,
  resolveMatchPairings,
  resolveTrueFalseAnswer,
} from "@/lib/assessmentAnswer";
import {
  allocateQuestionsPerModule,
  buildSlides,
  resolveCourseQuestionBudget,
} from "@/lib/slideBuilder";

const matchItem = (moduleTitle: string, topicTitle: string) => ({
  module_title: moduleTitle,
  topic_title: topicTitle,
  column_a: ["Bullet camera", "Dome camera"],
  column_b: ["Visible deterrent", "Hides direction of aim"],
  correct_pairings: [
    { a: "Bullet camera", b: "Visible deterrent" },
    { a: "Dome camera", b: "Hides direction of aim" },
  ],
});

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
    matchItem("Camera Selection", "Bullet Cameras"),
    matchItem("Storage Choice", "DVR vs NVR"),
    matchItem("Cabling", "Coaxial"),
    matchItem("Handover", "Docs"),
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
    // 1 MCQ + 4 match + 2 fill + 1 scenario + 1 true/false = 9 authored items.
    expect(collectAssessmentItems(bank, () => {}).length).toBe(9);
  });

  it("reports the items it cannot score instead of dropping them silently", () => {
    const reasons: string[] = [];
    collectAssessmentItems({
      mcq: [{ question: "Q", options: ["a", "b"], correct_answer: "neither" }],
      true_false: [{ question: "TF", correct_answer: "maybe" }],
    }, (reason) => reasons.push(reason));
    expect(reasons.length).toBe(2);
    expect(reasons.join(" ")).toContain("answer key that matches none of its options");
    expect(reasons.join(" ")).toContain("no True/False key");
  });

  it("keeps a true/false key written with trailing punctuation", () => {
    const trueFalse = collectAssessmentItems(bank, () => {})
      .find((item: any) => item.question === "Domes hide aim?");
    expect(trueFalse?.correct_answer).toBe("True");
  });

  it("gives each of the four modules at least one quiz", () => {
    const { slides } = buildSlides(rawOutputs, [], "30 min", 10, "standard");
    const counts = quizCountPerModule(slides);
    expect([0, 1, 2, 3].every((moduleIndex) => (counts[moduleIndex] || 0) >= 1)).toBe(true);
  });

  it("never budgets fewer quiz items than there are modules", () => {
    const modules = [
      { title: "A", topics: ["t1"] },
      { title: "B", topics: ["t2"] },
      { title: "C", topics: ["t3"] },
    ];
    // A bank of exactly three usable items must still reach all three modules,
    // even at light intensity on a five-minute course.
    expect(resolveCourseQuestionBudget(3, modules, 5, "light")).toBe(3);
    expect(allocateQuestionsPerModule(modules, 3)).toEqual([1, 1, 1]);
    // A bank smaller than the module count cannot cover every module; the
    // budget stops at what exists rather than inventing questions.
    expect(resolveCourseQuestionBudget(2, modules, 30, "deep")).toBe(2);
  });
});

describe("authored answer keys for the newer assessment types", () => {
  it("reads pairings written as objects, arrays and a keyed map", () => {
    expect(resolveMatchPairings({
      column_a: ["Bullet", "Dome"], column_b: ["Deterrent", "Aim hidden"],
      correct_pairings: [{ a: "Bullet", b: "Deterrent" }, { a: "Dome", b: "Aim hidden" }],
    })).toEqual({ 0: 0, 1: 1 });

    expect(resolveMatchPairings({
      column_a: ["Bullet", "Dome"], column_b: ["Deterrent", "Aim hidden"],
      correct_pairings: [["Bullet", "Deterrent"], ["Dome", "Aim hidden"]],
    })).toEqual({ 0: 0, 1: 1 });

    expect(resolveMatchPairings({
      column_a: ["Bullet", "Dome"], column_b: ["Deterrent", "Aim hidden"],
      correct_pairings: { Bullet: "Deterrent", Dome: "Aim hidden" },
    })).toEqual({ 0: 0, 1: 1 });
  });

  it("pairs by text, so a shuffled column still points at the right partner", () => {
    const pairs = resolveMatchPairings({
      column_a: ["Bullet camera", "Dome camera"],
      column_b: ["Hides direction of aim", "Visible deterrent"],
      correct_pairings: [{ a: "1. Bullet camera", b: "Visible deterrent." }],
    });
    expect(pairs[0]).toBe(1);
  });

  it("returns nothing when the authored pairing names an item that is not on the board", () => {
    expect(resolveMatchPairings({
      column_a: ["Bullet"], column_b: ["Deterrent"],
      correct_pairings: [{ a: "PTZ", b: "Deterrent" }],
    })).toEqual({});
  });

  it("reads one answer per blank, however the key is written", () => {
    expect(fillBlankAnswers({ passage: "A ___ and a ___.", correct_answer: ["NVR", "DVR"] })).toEqual(["NVR", "DVR"]);
    expect(fillBlankAnswers({ passage: "A ___ and a ___.", correct_answer: "NVR | DVR" })).toEqual(["NVR", "DVR"]);
    expect(fillBlankAnswers({ passage: "A ___.", correct_answer: "NVR" })).toEqual(["NVR"]);
  });

  it("tells the learner screen each item needs", () => {
    expect(assessmentKindOf({ question: "Q", options: ["a", "b"] })).toBe("mcq");
    expect(assessmentKindOf({ column_a: ["a"], column_b: ["b"] })).toBe("match");
    expect(assessmentKindOf({ passage: "A ___.", correct_answer: "NVR" })).toBe("fill");
  });

  it("accepts a true/false key written any normal way", () => {
    expect(resolveTrueFalseAnswer("True.")).toBe("True");
    expect(resolveTrueFalseAnswer(true)).toBe("True");
    expect(resolveTrueFalseAnswer("yes")).toBe("True");
    expect(resolveTrueFalseAnswer("FALSE")).toBe("False");
    expect(resolveTrueFalseAnswer("0")).toBe("False");
    expect(resolveTrueFalseAnswer("maybe")).toBeUndefined();
  });
});
