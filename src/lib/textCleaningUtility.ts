/**
 * Shared text cleaning and normalization utilities
 * Used consistently across both preview and export to ensure content matches
 */

function stripStageDirections(text: string): string {
  return text
    .replace(/\[\*_]?\s*[\(\[]\s*Visual\s*:[^)\]\.\n]*(?:[\)\]]|(?=[\.\n])|$)\s*[\*_]?/gi, "")
    .replace(/\[\*_]?\s*[\(\[]\s*Audio\s*:[^)\]\.\n]*(?:[\)\]]|(?=[\.\n])|$)\s*[\*_]?/gi, "")
    .replace(/\[\*_]?\s*[\(\[]\s*Caption\s*:[^)\]\.\n]*(?:[\)\]]|(?=[\.\n])|$)\s*[\*_]?/gi, "")
    .replace(/\[\*_]?\s*[\(\[]\s*Interaction\s*:[^)\]\.\n]*(?:[\)\]]|(?=[\.\n])|$)\s*[\*_]?/gi, "")
    .replace(/(^|[\!\?\s])(?:Narration|Visual|Audio|Caption|On[- ]?screen)\s*:\s*/gi, "$1")
    .replace(/^\s*Topic\s+\d+\s*:\s*/i, "");
}

export function stripNarratorMarkdown(text: string): string {
  return stripStageDirections(text)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlaceholderToken(text: string): boolean {
  const normalized = stripNarratorMarkdown(text).toLowerCase();
  if (!normalized) return true;
  if (/^[#*\-_.:;|/\\\[\](){}]+$/.test(normalized)) return true;
  if (normalized === "n/a" || normalized === "na" || normalized === "null" || normalized === "undefined") return true;
  return false;
}

const AI_PLACEHOLDER_SOURCE =
  "[ \\t]*(?:\\.{3}|…)?[ \\t]*(?:" +
  "\\[[^\\]\\n]*(?:rest of|remaining|unchanged|original script|continues|truncated|same as above|omitted for brevity)[^\\]\\n]*\\]" +
  "|\\(\\s*(?:rest of|remaining (?:content|script|sections?|topics?)|unchanged|content continues|truncated)[^)\\n]*\\)" +
  ")[ \\t]*(?:\\.{3}|…)?";
const AI_PLACEHOLDER = new RegExp(AI_PLACEHOLDER_SOURCE, "gi");

/** True when an AI rewrite contains "[rest of original script follows]"-style abbreviation notes. */
export function hasAiPlaceholder(text: string): boolean {
  return new RegExp(AI_PLACEHOLDER_SOURCE, "i").test(String(text || ""));
}

/** Removes AI abbreviation notes while keeping line breaks / markdown structure intact. */
export function stripAiPlaceholders(text: string): string {
  return String(text || "").replace(AI_PLACEHOLDER, "").replace(/[ \t]+\n/g, "\n");
}

/**
 * Single gate for every pipeline step that replaces the course script (reviewer, runtime
 * calibration, Final QA). A rewrite is only accepted when it is complete — no abbreviation
 * notes and not drastically shorter than the script it replaces.
 */
export function acceptScriptRewrite(
  original: string,
  revised: unknown,
  opts: { minRatio?: number } = {},
): { accepted: boolean; reason?: "empty" | "abbreviated" | "incomplete" } {
  if (typeof revised !== "string" || !revised.trim()) return { accepted: false, reason: "empty" };
  if (hasAiPlaceholder(revised)) return { accepted: false, reason: "abbreviated" };
  const words = (s: string) => (s.trim().match(/\S+/g) || []).length;
  const minRatio = opts.minRatio ?? 0.6;
  if (original && words(revised) < words(original) * minRatio) return { accepted: false, reason: "incomplete" };
  return { accepted: true };
}

export function safeLearnerText(text: string, fallback = ""): string {
  if (isPlaceholderToken(text)) return fallback;
  const cleaned = stripNarratorMarkdown(stripAiPlaceholders(text)).replace(AI_PLACEHOLDER, "").trim();
  return cleaned && !isPlaceholderToken(cleaned) ? cleaned : fallback;
}

export function stripOptionPrefix(opt: string): string {
  return String(opt ?? "").replace(/^\s*\(?[A-Da-d]\)?\s*[\.\):\-]\s*/, "");
}

/** Single source of truth for quiz narration: question followed by every option.
 *  Used by the learner preview AND the exported package so audio always matches the screen. */
export function buildAssessmentNarration(q: { question?: unknown; options?: unknown } | undefined | null): string {
  if (!q) return "";
  const questionText = String(q.question || "").replace(/Correct Answer:.*$/gi, "").replace(/Options:.*$/gi, "").trim();
  const optionLines = Array.isArray(q.options)
    ? q.options.map((opt: unknown, i: number) => `Option ${String.fromCharCode(65 + i)}. ${stripOptionPrefix(String(opt ?? ""))}`)
    : [];
  return [questionText, ...optionLines].filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 2500);
}
