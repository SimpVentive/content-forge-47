import { stripNarratorMarkdown, stripOptionPrefix } from "@/lib/textCleaningUtility";

type AnswerQuestion = {
  options?: unknown;
  correct_answer?: unknown;
  correctAnswer?: unknown;
  best_response?: unknown;
  answer?: unknown;
};

function comparable(value: string): string {
  return stripNarratorMarkdown(stripOptionPrefix(value)).normalize("NFKC")
    .replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim().toLowerCase();
}

/** Resolve against the authored order, BEFORE any shuffle. Never guess from substrings. */
export function resolveAssessmentAnswer(q: AnswerQuestion): number | undefined {
  if (!Array.isArray(q.options)) return undefined;
  const options = q.options.map(value => String(value ?? ""));
  const key = q.correct_answer ?? q.correctAnswer ?? q.best_response ?? q.answer;
  if (typeof key !== "string" && typeof key !== "number") return undefined;
  const raw = stripNarratorMarkdown(String(key)).trim()
    .replace(/^(?:correct\s+answer|answer)\s*:\s*/i, "");
  if (!raw) return undefined;
  const matches = options.map((option, index) => comparable(option) === comparable(raw) ? index : -1)
    .filter(index => index >= 0);
  if (matches.length === 1) return matches[0];
  const label = raw.match(/^(?:option\s+)?\(?([a-z])\)?[.):\-]?$/i);
  if (label) {
    const index = label[1].toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < options.length ? index : undefined;
  }
  // Numeric answer labels are one-based; an explicit zero is the first option.
  if (/^(?:option\s+)?\d+[.):]?$/i.test(raw)) {
    const number = Number(raw.replace(/\D/g, ""));
    const index = number === 0 ? 0 : number - 1;
    return index >= 0 && index < options.length ? index : undefined;
  }
  return undefined;
}

/** Canonical answer is the full option text, so reordering cannot change its meaning. */
export function normalizeAssessmentAnswer<T extends AnswerQuestion>(q: T): T & { correct_answer: string } {
  const index = resolveAssessmentAnswer(q);
  const options = Array.isArray(q.options) ? q.options : [];
  return { ...q, correct_answer: index === undefined ? "" : String(options[index]) };
}

/**
 * Every authored assessment item that can render as a multiple-choice slide: MCQ, scenario and true/false.
 * Match-the-following and fill-in-the-blank items have no renderer yet, so they are not included.
 */
export function collectAssessmentItems(assessData: any): any[] {
  const mcq = Array.isArray(assessData?.mcq) ? assessData.mcq : [];
  const scenarios = Array.isArray(assessData?.scenarios)
    ? assessData.scenarios.map((s: any) => ({ ...s, question: s.question || "Choose the best response to this situation." }))
    : [];
  const trueFalse = Array.isArray(assessData?.true_false)
    ? assessData.true_false.map((t: any) => {
        const isTrue = t.correct_answer === true || /^t(rue)?$/i.test(String(t.correct_answer ?? "").trim());
        return { ...t, options: ["True", "False"], correct_answer: isTrue ? "True" : "False" };
      })
    : [];
  return [...mcq, ...scenarios, ...trueFalse].map((item) => normalizeAssessmentAnswer(item));
}
