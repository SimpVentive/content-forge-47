import { describe, expect, it } from "vitest";
import {
  applyAnswerCorrections,
  buildAnswerAuditUserMessage,
  collectVerifiableQuestions,
} from "@/lib/assessmentVerification";
import { resolveAssessmentAnswer } from "@/lib/assessmentAnswer";

const sopQuestion = {
  module_title: "Foundations of the Change Protocol",
  question:
    "An engineer proposes a 'minor sensitivity adjustment' to a validated sensor to improve efficiency, arguing it doesn't stop the line. How should this be classified according to the SOP?",
  options: [
    "As a Standard Action, because it does not result in equipment downtime.",
    "As Routine Maintenance, provided the engineer uses a certified tool.",
    "As a formal Change Request, because it modifies a validated state.",
    "As a Process Optimization, which is exempt from the Change Management SOP.",
  ],
  // The assessment agent marked the distractor; the SOP-correct answer is option C.
  correct_answer: "As a Standard Action, because it does not result in equipment downtime.",
};

describe("assessment answer-key auditing", () => {
  it("collects mcq, scenario and true/false questions in a stable order", () => {
    const data = {
      mcq: [sopQuestion],
      scenarios: [{ question: "s", options: ["x", "y"], best_response: "x" }],
      true_false: [{ question: "t", correct_answer: true }],
      match_the_following: [{ column_a: [], column_b: [] }],
    };
    const questions = collectVerifiableQuestions(data);
    expect(questions).toHaveLength(3);
    expect(questions[0].question).toBe(sopQuestion.question);
  });

  it("applies a valid correction so the right option scores correct", () => {
    const data = { mcq: [structuredClone(sopQuestion)] };
    const { data: corrected, applied } = applyAnswerCorrections(data, [
      { index: 0, correct_answer: "As a formal Change Request, because it modifies a validated state." },
    ]);
    expect(applied).toBe(1);
    const question = (corrected as typeof data).mcq[0];
    expect(resolveAssessmentAnswer(question)).toBe(2);
  });

  it("accepts a letter-form correction when it resolves to one option", () => {
    const data = { mcq: [structuredClone(sopQuestion)] };
    const { applied, data: corrected } = applyAnswerCorrections(data, [{ index: 0, correct_answer: "C" }]);
    expect(applied).toBe(1);
    expect(resolveAssessmentAnswer((corrected as typeof data).mcq[0])).toBe(2);
  });

  it("rejects corrections that do not resolve to exactly one option", () => {
    const data = { mcq: [structuredClone(sopQuestion)] };
    const { applied, data: unchanged } = applyAnswerCorrections(data, [
      { index: 0, correct_answer: "Some text that is not an option" },
      { index: 7, correct_answer: "C" },
      { index: -1, correct_answer: "C" },
    ]);
    expect(applied).toBe(0);
    expect((unchanged as typeof data).mcq[0].correct_answer).toBe(sopQuestion.correct_answer);
  });

  it("leaves data untouched when the auditor finds nothing wrong", () => {
    const data = { mcq: [structuredClone(sopQuestion)] };
    const { applied, data: same } = applyAnswerCorrections(data, []);
    expect(applied).toBe(0);
    expect(same).toBe(data);
  });

  it("builds an audit message listing every question with its marked answer", () => {
    const message = buildAnswerAuditUserMessage({ mcq: [sopQuestion] }, "The SOP script says validated states need a Change Request.");
    expect(message).toContain("Question 0:");
    expect(message).toContain("C. As a formal Change Request");
    expect(message).toContain("Marked correct: As a Standard Action");
    expect(message).toContain("The SOP script");
  });
});
