import { normalizeAssessmentAnswer, resolveAssessmentAnswer } from "@/lib/assessmentAnswer";

/**
 * Answer-key auditing for generated assessments.
 *
 * The assessment agent occasionally marks the wrong option as correct
 * (e.g. a plausible distractor instead of the SOP-correct response).
 * Rendering can only trust the authored key, so a wrong key means every
 * learner answer is judged against the wrong option. This module applies
 * auditor corrections defensively: a correction is accepted only when it
 * resolves to exactly one option of that question; anything else is kept
 * as authored.
 */

export type AnswerCorrection = {
  /** Index into the flattened verifiable question list (mcq, then scenarios, then true/false). */
  index: number;
  /** The corrected answer: full option text preferred, letter/numeric labels accepted. */
  correct_answer: unknown;
};

type VerifiableQuestion = {
  options?: unknown;
  correct_answer?: unknown;
  best_response?: unknown;
  question?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Flatten every question whose answer key can be verified against options, in a stable order. */
export function collectVerifiableQuestions(assessData: unknown): VerifiableQuestion[] {
  if (!isRecord(assessData)) return [];
  const mcq = Array.isArray(assessData.mcq) ? assessData.mcq : [];
  const scenarios = Array.isArray(assessData.scenarios) ? assessData.scenarios : [];
  const trueFalse = Array.isArray(assessData.true_false) ? assessData.true_false : [];
  return [...mcq, ...scenarios, ...trueFalse].filter(isRecord) as VerifiableQuestion[];
}

/**
 * Apply auditor corrections to parsed assessment data.
 * Returns the corrected data and how many corrections were accepted.
 * A correction is accepted only when the new key resolves to exactly one
 * option of that question — an unresolvable correction is never applied,
 * because a guess is worse than the authored key.
 */
export function applyAnswerCorrections(
  assessData: unknown,
  corrections: AnswerCorrection[],
): { data: unknown; applied: number } {
  if (!isRecord(assessData) || !Array.isArray(corrections) || corrections.length === 0) {
    return { data: assessData, applied: 0 };
  }
  const groups: VerifiableQuestion[][] = [
    Array.isArray(assessData.mcq) ? (assessData.mcq as VerifiableQuestion[]) : [],
    Array.isArray(assessData.scenarios) ? (assessData.scenarios as VerifiableQuestion[]) : [],
    Array.isArray(assessData.true_false) ? (assessData.true_false as VerifiableQuestion[]) : [],
  ];
  const flat = groups.flat();
  let applied = 0;
  for (const correction of corrections) {
    if (!isRecord(correction)) continue;
    const index = typeof correction.index === "number" ? correction.index : NaN;
    if (!Number.isInteger(index) || index < 0 || index >= flat.length) continue;
    const question = flat[index];
    if (!isRecord(question)) continue;
    const candidate = { ...question, correct_answer: correction.correct_answer };
    // Only accept when the corrected key resolves to exactly one option.
    if (resolveAssessmentAnswer(candidate) === undefined) continue;
    question.correct_answer = correction.correct_answer;
    if ("best_response" in question) question.best_response = correction.correct_answer;
    Object.assign(question, normalizeAssessmentAnswer(question));
    applied++;
  }
  return { data: assessData, applied };
}

/** System prompt for the answer-key auditor pass. */
export const ANSWER_AUDIT_SYSTEM_PROMPT = `You are an Assessment Answer Auditor for corporate eLearning. You are given a course script and the assessment questions generated from it. For EACH question, decide whether the marked correct answer is truly the best answer according to the script and sound domain practice. Distractors are written to be plausible, so check carefully — a marked answer that contradicts the script or standard practice must be corrected. Return JSON in this exact shape: { "corrections": [{ "index": <question number starting at 0, in the order given>, "correct_answer": "<the FULL TEXT of the correct option, copied exactly from that question's options>" }] }. Include ONLY questions whose marked answer is wrong or clearly weaker than another option. If every marked answer is correct, return { "corrections": [] }. Do not rewrite questions or options. Do not add commentary.`;

/** Build the auditor user message: numbered questions with their options and marked answers. */
export function buildAnswerAuditUserMessage(assessData: unknown, script: string): string {
  const questions = collectVerifiableQuestions(assessData);
  const listing = questions
    .map((q, index) => {
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      const marked = q.correct_answer ?? q.best_response ?? "";
      return [
        `Question ${index}: ${String(q.question ?? "").trim()}`,
        ...options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`),
        `  Marked correct: ${String(marked)}`,
      ].join("\n");
    })
    .join("\n\n");
  const scriptExcerpt = script.length > 24000 ? `${script.slice(0, 24000)}\n[script truncated for audit]` : script;
  return `Course Script:\n${scriptExcerpt}\n\n---\n\nAssessment Questions (audit the marked answers):\n${listing}`;
}
