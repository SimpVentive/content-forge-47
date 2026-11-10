// Decides whether a model reply is complete. A reply that stops at the output limit is cut off, whatever the service says.
// If the service does not report the finish reason (older deployments), the text itself is checked: an unclosed SVG,
// an unclosed code fence, or JSON that is not closed.

const CUT_OFF_REASONS = ["length", "max_tokens"];
const COMPLETE_REASONS = ["stop", "end_turn"];

/** True when the reply is incomplete and should be continued. */
export function isCutOff(finishReason: string | null | undefined, text: string): boolean {
  if (finishReason && CUT_OFF_REASONS.includes(finishReason)) return true;
  if (finishReason && COMPLETE_REASONS.includes(finishReason)) return false;
  return looksUnfinished(text);
}

/** Text-only check for replies whose finish reason is unknown. */
export function looksUnfinished(text: string): boolean {
  const svgOpen = (text.match(/<svg[\s>]/gi) || []).length;
  const svgClose = (text.match(/<\/svg>/gi) || []).length;
  if (svgOpen > svgClose) return true;
  if ((text.match(/```/g) || []).length % 2 === 1) return true;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return jsonUnfinished(trimmed);
  return false;
}

/** Brackets and quotes balance, ignoring anything inside a string. */
function jsonUnfinished(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  return inString || depth > 0;
}
