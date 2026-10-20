/**
 * Shared rules for learner-facing infographics: how they are generated,
 * how weak ones are detected, and how they are explained. Used by the
 * generation pipeline and the learner preview so quality is one rule.
 */

export const EXPLAINER_INFOGRAPHIC_SYSTEM_PROMPT = [
  "You design TEACHING diagrams for workplace eLearning. The learner must understand the concept from the picture alone.",
  "Output one self-contained SVG with viewBox=\"0 0 1200 800\". No external fonts or images; font-family='system-ui, sans-serif'.",
  "Colours only: #0f172a, #123d78, #355fa8, #4f46e5, #7c3aed, #10b981, #f59e0b, #e8eef9, #f8fafc, #ffffff.",
  "Required structure:",
  "1) Top: a headline that states the key takeaway as a plain sentence (font-size >= 38).",
  "2) Middle: 3-5 labelled parts (boxes, steps or components) connected by arrows that show how they relate. Each part has a bold label (font-size >= 26) and a one-line meaning (font-size >= 20, max 8 words).",
  "3) If the topic contains a formula, calculation or rule: show each term as its own labelled block, explain what each term means, and include a WORKED EXAMPLE with real numbers and the result.",
  "4) Bottom: a 'Why it matters' or 'Example' strip linking the idea to a real job situation.",
  "Content must fill at least 80% of the canvas. Never draw a small widget, form, button or UI mock-up in the middle of empty space. No fake buttons like 'Calculate'. No tiny text.",
  "Return ONLY the SVG markup.",
].join(" ");

export function extractSvgLabels(svg: string): string[] {
  return Array.from((svg || "").matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Detects sparse / widget-like SVGs that do not teach anything. */
export function assessInfographicSvg(svg: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const source = svg || "";
  if (!/<svg[\s\S]*<\/svg>/i.test(source)) return { ok: false, reasons: ["no svg"] };
  const labels = extractSvgLabels(source);
  if (labels.length < 6) reasons.push("too few labels");
  const shapes = (source.match(/<(rect|circle|ellipse|path|polygon|line|polyline)\b/gi) || []).length;
  if (shapes < 6) reasons.push("too few shapes");
  const words = labels.join(" ").split(/\s+/).filter(Boolean).length;
  if (words < 15) reasons.push("too little explanatory text");
  if (/\b(calculate|submit|click here)\b/i.test(labels.join(" "))) reasons.push("fake UI control");
  return { ok: reasons.length === 0, reasons };
}

export function buildInfographicUserPrompt(input: { moduleTitle: string; topicTitle?: string; points?: string[]; content?: string }): string {
  const content = (input.content || "").replace(/\s+/g, " ").trim().slice(0, 1500);
  return [
    `Module: ${input.moduleTitle}.`,
    input.topicTitle ? `Topic: ${input.topicTitle}.` : "",
    input.points?.length ? `Key points: ${input.points.join("; ")}.` : "",
    content ? `Lesson text to explain visually: ${content}` : "",
    "Build the teaching diagram for this exact content.",
  ].filter(Boolean).join("\n");
}

export const INFOGRAPHIC_EXPLAIN_SYSTEM_PROMPT = [
  "You are a trainer walking a learner through a diagram on screen.",
  "Refer to the diagram's actual labels by name. Explain what each part means in plain words and how the parts connect.",
  "If there is a formula or calculation, explain every term and work through one example with real numbers, step by step, ending with the result.",
  "Finish with one line on how to use this at work.",
  "Plain text, 4-7 short lines, each starting with '• '. Max 20 words per line. No markdown headings, no generic phrases like 'follow the visual flow'.",
].join(" ");

export function buildInfographicExplainPrompt(input: { moduleTitle: string; topicTitle?: string; labels: string[]; content?: string }): string {
  return [
    `Module: ${input.moduleTitle}`,
    input.topicTitle ? `Topic: ${input.topicTitle}` : "",
    `Diagram labels (in order): ${input.labels.join(" | ") || "none"}`,
    input.content ? `Lesson text: ${input.content.replace(/\s+/g, " ").slice(0, 1500)}` : "",
  ].filter(Boolean).join("\n");
}
