/**
 * Teaching diagrams. Two kinds, both shown on the learner screen only once the trainer reaches the
 * narration sentence that refers to them, and carried onto later screens in the same module:
 *
 * 1. Matrix: a 2×2 grid drawn from a marker line the writer (or the detection step) adds, for example
 *    [MATRIX2X2 | title: The Four Domains | columns: You; Others | rows: Recognizing emotions; Managing them | cells: Self-Awareness; Social Awareness; Self-Management; Relationship Management]
 *    The marker must not contain "diagram" or "visual": those words are author-directive keywords that the
 *    script cleanup removes before this parser runs.
 * 2. SVG: any other diagram, image or chart a screen refers to. The detection step asks the model to draw it,
 *    the drawing must pass the shared infographic quality check, and it is stored with the course.
 */

import { assessInfographicSvg } from "@/lib/infographicQuality";

export type MatrixSpec = {
  type: "matrix2x2";
  title: string;
  columns: [string, string];
  rows: [string, string];
  /** Row-major: top-left, top-right, bottom-left, bottom-right. */
  cells: [string, string, string, string];
};

export type SvgSpec = {
  type: "svg";
  title: string;
  svg: string;
};

export type DiagramSpec = MatrixSpec | SvgSpec;

const MAX_FIELD_LENGTH = 80;
const MARKER_LINE = /^[ \t]*\[MATRIX2X2[^\]\n]*\][ \t]*(?:\n|$)/gim;
const MATRIX_MENTION = /\b(two[- ]by[- ]two|2\s*[x×]\s*2|2\s+by\s+2|quadrants?|grid|matrix)\b/i;
// Any reference to a visual on the screen: diagrams, images, pictures, charts, grids, and so on.
const VISUAL_MENTION = /\b(diagrams?|images?|pictures?|figures?|charts?|graphs?|flowcharts?|infographics?|illustrations?|grids?|matrix|quadrants?|two[- ]by[- ]two|2\s*[x×]\s*2)\b/i;

function parseFields(inner: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of inner.split("|").slice(1)) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    fields[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim();
  }
  return fields;
}

function cleanList(value: string | undefined, expected: number): string[] | null {
  if (!value) return null;
  const items = value.split(";").map((item) => item.trim());
  if (items.length !== expected || items.some((item) => !item || item.length > MAX_FIELD_LENGTH)) return null;
  return items;
}

function parseMatrix(fields: Record<string, string>): MatrixSpec | null {
  const title = (fields.title || "").trim();
  const columns = cleanList(fields.columns, 2);
  const rows = cleanList(fields.rows, 2);
  const cells = cleanList(fields.cells, 4);
  if (!title || title.length > MAX_FIELD_LENGTH || !columns || !rows || !cells) return null;
  return {
    type: "matrix2x2",
    title,
    columns: [columns[0], columns[1]],
    rows: [rows[0], rows[1]],
    cells: [cells[0], cells[1], cells[2], cells[3]],
  };
}

/**
 * Pulls every matrix marker out of a screen's text. Valid markers become specs; every marker line is
 * removed so raw production syntax never reaches the learner, even when the spec is incomplete.
 */
export function extractDiagramSpecs(text: string): { text: string; diagrams: DiagramSpec[] } {
  const diagrams: DiagramSpec[] = [];
  const cleaned = (text || "").replace(MARKER_LINE, (line) => {
    const inner = line.trim().slice(1, -1);
    const spec = parseMatrix(parseFields(inner));
    if (spec) diagrams.push(spec);
    return "";
  });
  return { text: cleaned.replace(/\n{3,}/g, "\n\n").trim(), diagrams };
}

/** True when a sentence or line refers to any diagram, image, chart or grid. */
export function mentionsDiagram(text: string): boolean {
  return VISUAL_MENTION.test(text);
}

/** Index of the first narration sentence that refers to the diagram, or -1 when none does. */
export function findDiagramRevealIndex(sentences: string[], spec: DiagramSpec): number {
  return sentences.findIndex((sentence) => mentionsDiagram(sentence));
}

/** Removes scripts, event handlers, foreign content and javascript links from a model-drawn SVG. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

/** Accepts only a complete, self-contained SVG that passes the shared quality rule for teaching diagrams. */
export function isUsableSvg(svg: string): boolean {
  if (!/^<svg[\s\S]*<\/svg>$/i.test(svg.trim())) return false;
  if (!/viewBox\s*=/i.test(svg)) return false;
  if (/<script|<foreignObject|javascript:/i.test(svg)) return false;
  return assessInfographicSvg(svg).ok;
}

const DIAGRAM_REQUEST_SYSTEM = [
  "You prepare the visual for a learning screen that refers to a diagram, image, chart or grid.",
  "Reply with exactly one of these and nothing else:",
  "(1) If the passage describes a 2×2 grid, one line in this form:",
  "[MATRIX2X2 | title: <short title> | columns: <left label>; <right label> | rows: <top label>; <bottom label> | cells: <top-left>; <top-right>; <bottom-left>; <bottom-right>]",
  "(2) Otherwise, one complete SVG that draws the visual the passage refers to. Use viewBox=\"0 0 1200 800\", font-family='system-ui, sans-serif', labelled parts that fill the canvas, and colours only from #0f172a, #123d78, #355fa8, #4f46e5, #10b981, #f59e0b, #e8eef9, #f8fafc, #ffffff. No scripts, no external images, no fake buttons.",
  "(3) If the passage refers to no visual at all, the word NONE.",
].join(" ");

/** Topics whose text refers to a visual, capped so one course cannot make unbounded calls. */
export const MAX_DIAGRAM_REQUESTS = 12;

function topicOfSection(section: string): string {
  const heading = section.match(/^## (.+)$/m);
  return heading ? heading[1].trim() : "";
}

/**
 * Finds topics whose body text refers to a diagram, image, chart or grid, and asks the model for the visual.
 * A 2×2 grid gets a matrix marker inserted after the sentence that mentions it. Any other visual is drawn as
 * an SVG and returned keyed by topic title, so it can be stored with the course. Topics the model cannot
 * turn into a usable visual are left as written.
 */
export async function addMissingDiagramMarkers(
  script: string,
  askModel: (systemPrompt: string, userMessage: string) => Promise<string>,
): Promise<{ script: string; added: number; diagrams: Record<string, SvgSpec> }> {
  const sections = (script || "").split(/(?=^## )/m);
  const diagrams: Record<string, SvgSpec> = {};
  let added = 0;
  let requests = 0;
  const updated: string[] = [];
  for (const section of sections) {
    const lines = section.split("\n");
    // Only body text counts: a heading such as "The Grid" should not trigger a diagram on its own.
    const mentionLine = lines.findIndex((line) => !/^## /.test(line) && mentionsDiagram(line));
    const hasMarker = /\[MATRIX2X2\b/i.test(section);
    if (mentionLine < 0 || hasMarker || requests >= MAX_DIAGRAM_REQUESTS) {
      updated.push(section);
      continue;
    }
    requests += 1;
    let reply = "";
    try {
      reply = await askModel(DIAGRAM_REQUEST_SYSTEM, section);
    } catch {
      reply = "";
    }
    const trimmed = reply.trim();
    const markerLine = trimmed.split("\n").map((line) => line.trim()).find((line) => /^\[MATRIX2X2\b/i.test(line));
    const spec = markerLine ? extractDiagramSpecs(markerLine).diagrams[0] : undefined;
    if (spec && markerLine) {
      lines.splice(mentionLine + 1, 0, markerLine);
      updated.push(lines.join("\n"));
      added += 1;
      continue;
    }
    const svgMatch = trimmed.match(/<svg[\s\S]*<\/svg>/i);
    const topic = topicOfSection(section);
    if (svgMatch && topic && isUsableSvg(svgMatch[0])) {
      diagrams[topic] = { type: "svg", title: topic, svg: sanitizeSvg(svgMatch[0]) };
      added += 1;
    }
    updated.push(section);
  }
  return { script: updated.join(""), added, diagrams };
}

/**
 * A diagram introduced on one screen is shown from the start of every later screen in the same module
 * that refers to it, so the learner never meets "this grid" without the grid. Screens in other modules
 * are left alone, because "the grid" there may mean a different diagram.
 */
export function carryDiagramsForward<T extends { moduleIndex: number; content?: string; diagram?: DiagramSpec; diagramImmediate?: boolean }>(slides: T[]): T[] {
  const introduced = new Map<number, DiagramSpec>();
  return slides.map((slide) => {
    if (slide.diagram) {
      if (!slide.diagramImmediate) introduced.set(slide.moduleIndex, slide.diagram);
      return slide;
    }
    const carried = introduced.get(slide.moduleIndex);
    if (carried && slide.content && mentionsDiagram(slide.content)) {
      return { ...slide, diagram: carried, diagramImmediate: true };
    }
    return slide;
  });
}

/**
 * Decides whether the diagram is on screen. It appears when the trainer reaches the mentioning sentence,
 * and stays after that. If there is no narration to wait for, or no sentence mentions it, it shows at once.
 */
export function isDiagramRevealed(input: { revealIndex: number; highlightIndex: number; narrationOff: boolean }): boolean {
  return input.narrationOff || input.revealIndex < 0 || input.highlightIndex >= input.revealIndex;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(lines: string[], x: number, centreY: number, size: number, weight: number, fill: string): string {
  const lineHeight = Math.round(size * 1.25);
  const startY = centreY - ((lines.length - 1) * lineHeight) / 2;
  return lines
    .map((line, index) => `<text x="${x}" y="${startY + index * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join("");
}

/** Draws a diagram for the screen. Matrices are drawn from their fields; SVGs are sanitised and shown as drawn. */
export function renderDiagramSvg(spec: DiagramSpec): string {
  if (spec.type === "svg") {
    return sanitizeSvg(spec.svg).replace(/<svg\b/i, `<svg role="img" aria-label="${escapeXml(spec.title)}"`);
  }
  const colX = [320, 760];
  const colW = 420;
  const rowY = [210, 490];
  const rowH = 260;
  const parts: string[] = [];

  parts.push(textBlock(wrapLines(spec.title, 34), 600, 60, 38, 700, "#0f172a"));
  colX.forEach((x, c) => {
    parts.push(textBlock(wrapLines(spec.columns[c], 22), x + colW / 2, 160, 28, 700, "#123d78"));
  });
  rowY.forEach((y, r) => {
    parts.push(textBlock(wrapLines(spec.rows[r], 16), 180, y + rowH / 2, 28, 700, "#123d78"));
  });
  spec.cells.forEach((label, index) => {
    const r = Math.floor(index / 2);
    const c = index % 2;
    const x = colX[c];
    const y = rowY[r];
    parts.push(`<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="18" fill="#e8eef9" stroke="#355fa8" stroke-width="3"/>`);
    parts.push(textBlock(wrapLines(label, 20), x + colW / 2, y + rowH / 2, 32, 700, "#0f172a"));
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" font-family="system-ui, sans-serif" role="img" aria-label="${escapeXml(spec.title)}">${parts.join("")}</svg>`;
}
