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

/** Learner typing is compared without case, quotes or trailing punctuation. */
export function normalizeBlankAnswer(value: string): string {
  return String(value ?? "").normalize("NFKC").toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
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
  // Keys often repeat the option letter ("B. Routine maintenance", "Option B: Routine maintenance").
  // Options are compared without their letters too, so the key is compared the same way.
  const unlabelled = raw.replace(/^(?:option\s+)?\(?[a-z0-9]{1,2}\)?\s*[.):\-]\s+/i, "").trim();
  for (const candidate of unlabelled && unlabelled !== raw ? [raw, unlabelled] : [raw]) {
    const matches = options.map((option, index) => comparable(option) === comparable(candidate) ? index : -1)
      .filter(index => index >= 0);
    if (matches.length === 1) return matches[0];
  }
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

export type AssessmentKind = "mcq" | "match" | "fill";

/** Which learner screen an authored item needs. */
export function assessmentKindOf(item: any): AssessmentKind {
  if (!item || typeof item !== "object") return "mcq";
  if (item.assessment_kind === "match" || Array.isArray(item.column_a)) return "match";
  if (item.assessment_kind === "fill" || (typeof item.passage === "string" && !Array.isArray(item.options))) return "fill";
  return "mcq";
}

const blankPattern = /_{2,}|\.{3,}|\[[\s_]{1,}\]|\{\s*\}/g;

/** How many blanks the authored passage actually asks the learner to fill. */
export function countPassageBlanks(passage: string): number {
  return String(passage || "").match(blankPattern)?.length || 0;
}

/** The authored answer for each blank, in passage order. */
export function fillBlankAnswers(item: any): string[] {
  const raw = item?.correct_answer ?? item?.answers ?? item?.correct_answers ?? item?.answer;
  if (Array.isArray(raw)) return raw.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    const parts = raw.split(/\s*[|;]\s*/).map((part) => part.trim()).filter(Boolean);
    return parts.length ? parts : [raw.trim()].filter(Boolean);
  }
  return [];
}

/**
 * Column A index -> Column B index, taken from the authored pairings.
 * Text is compared exactly (letters and punctuation ignored) so a pairing can
 * never silently point at the wrong partner.
 */
export function resolveMatchPairings(item: any): Record<number, number> {
  const columnA: string[] = Array.isArray(item?.column_a) ? item.column_a.map(String) : [];
  const columnB: string[] = Array.isArray(item?.column_b) ? item.column_b.map(String) : [];
  const pairings = item?.correct_pairings ?? item?.pairings ?? item?.matches;
  const pairs: Record<number, number> = {};
  if (!columnA.length || !columnB.length || !pairings) return pairs;

  const key = (value: string) => stripNarratorMarkdown(stripOptionPrefix(value)).normalize("NFKC")
    .replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim().toLowerCase();
  const bByText = new Map<string, number>();
  columnB.forEach((value, index) => bByText.set(key(value), index));
  const aByText = new Map<string, number>();
  columnA.forEach((value, index) => aByText.set(key(value), index));

  const indexOf = (value: unknown, textToIndex: Map<string, number>, length: number) => {
    const raw = String(value ?? "").trim();
    if (!raw) return -1;
    const byText = textToIndex.get(key(raw));
    if (byText !== undefined) return byText;
    const asNumber = Number(raw.replace(/[.):]+$/, "").trim());
    return Number.isInteger(asNumber) && asNumber >= 0 && asNumber < length ? asNumber : -1;
  };

  const addPair = (left: unknown, right: unknown) => {
    const aIndex = indexOf(left, aByText, columnA.length);
    const bIndex = indexOf(right, bByText, columnB.length);
    if (aIndex >= 0 && bIndex >= 0 && pairs[aIndex] === undefined) pairs[aIndex] = bIndex;
  };

  if (Array.isArray(pairings)) {
    pairings.forEach((pair: any) => {
      if (Array.isArray(pair)) { addPair(pair[0], pair[1]); return; }
      if (pair && typeof pair === "object") {
        const left = pair.a ?? pair.column_a ?? pair.left ?? pair.item ?? pair.term;
        const right = pair.b ?? pair.column_b ?? pair.right ?? pair.match ?? pair.definition;
        if (left !== undefined && right !== undefined) addPair(left, right);
        return;
      }
      if (typeof pair === "string" && pair.includes("->")) {
        const [left, right] = pair.split("->");
        addPair(left, right);
      }
    });
  } else if (pairings && typeof pairings === "object") {
    Object.entries(pairings).forEach(([left, right]) => addPair(left, right));
  }

  return pairs;
}

const TRUE_WORDS = /^(t(rue)?|y(es)?|1|correct|true)$/i;
const FALSE_WORDS = /^(f(alse)?|n(o)?|0|incorrect|false|wrong)$/i;

/** A true/false key written as "True.", "yes", "1" or `true` all mean True. */
export function resolveTrueFalseAnswer(value: unknown): string | undefined {
  const cleaned = stripNarratorMarkdown(String(value ?? "")).trim().replace(/[.\s!]+$/, "");
  if (!cleaned) return undefined;
  if (TRUE_WORDS.test(cleaned)) return "True";
  if (FALSE_WORDS.test(cleaned)) return "False";
  return undefined;
}

/**
 * Every authored assessment item the learner can actually answer: MCQ, scenario,
 * true/false, match-the-following and fill-in-the-blank. Items whose answer key
 * cannot be resolved are reported instead of vanishing, because a silent drop is
 * what left whole modules without a quiz.
 */
export function collectAssessmentItems(assessData: any, onUnscorable?: (reason: string) => void): any[] {
  const report = onUnscorable || ((reason: string) => console.warn(`[Assessment] Unscorable item skipped: ${reason}`));
  const mcq = Array.isArray(assessData?.mcq) ? assessData.mcq : [];
  const scenarios = Array.isArray(assessData?.scenarios)
    ? assessData.scenarios.map((s: any) => ({ ...s, question: s.question || "Choose the best response to this situation." }))
    : [];
  const trueFalse: any[] = [];
  if (Array.isArray(assessData?.true_false)) {
    assessData.true_false.forEach((t: any) => {
      const answer = resolveTrueFalseAnswer(t.correct_answer ?? t.answer ?? t.correct);
      if (!answer) { report(`true/false "${t.question || "untitled"}" has no True/False key`); return; }
      trueFalse.push({ ...t, options: ["True", "False"], correct_answer: answer });
    });
  }

  const matches: any[] = [];
  if (Array.isArray(assessData?.match_the_following)) {
    assessData.match_the_following.forEach((m: any) => {
      const pairs = resolveMatchPairings(m);
      const columnCount = Array.isArray(m?.column_a) ? m.column_a.length : 0;
      if (Object.keys(pairs).length < 2 || columnCount < 2) {
        report(`match exercise "${m.question || m.module_title || "untitled"}" needs at least two paired columns`);
        return;
      }
      matches.push({
        ...m,
        assessment_kind: "match",
        question: m.question || m.prompt || "Match each item on the left with its partner on the right.",
      });
    });
  }

  const fills: any[] = [];
  if (Array.isArray(assessData?.fill_blanks)) {
    assessData.fill_blanks.forEach((f: any) => {
      const blanks = countPassageBlanks(f.passage);
      const answers = fillBlankAnswers(f);
      if (blanks < 1 || answers.length < 1) {
        report(`fill-in-the-blank "${f.question || f.module_title || "untitled"}" has no blank or no answer`);
        return;
      }
      fills.push({
        ...f,
        assessment_kind: "fill",
        question: f.question || f.prompt || "Complete the sentence with the correct word.",
      });
    });
  }

  // A question whose key matches no option cannot be scored. Leave it out rather than show a dead end.
  const choiceItems = [...mcq, ...scenarios, ...trueFalse].map((item) => normalizeAssessmentAnswer(item));
  const scorableChoiceItems = choiceItems.filter((item) => {
    const keep = item.correct_answer !== "";
    if (!keep) report(`question "${item.question || "untitled"}" has an answer key that matches none of its options`);
    return keep;
  });

  return [...scorableChoiceItems, ...matches, ...fills];
}
