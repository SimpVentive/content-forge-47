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

export function safeLearnerText(text: string, fallback = ""): string {
  return isPlaceholderToken(text) ? fallback : stripNarratorMarkdown(text);
}

export function stripOptionPrefix(opt: string): string {
  return String(opt ?? "").replace(/^\s*\(?[A-Da-d]\)?\s*[\.\):\-]\s*/, "");
}
