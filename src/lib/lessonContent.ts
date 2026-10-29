import { isPlaceholderToken, stripAiPlaceholders, stripNarratorMarkdown } from "@/lib/textCleaningUtility";

export interface LessonModule { title: string; topics: string[] }
interface Section { title: string; body: string; module?: string }
const key = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const clean = (text: string) => {
  const body = stripAiPlaceholders(text).replace(/^---+\s*$/gm, "").trim();
  return body && !isPlaceholderToken(body) ? body : "";
};
const bodyFields = ["content", "body", "text", "narrative", "narration", "narration_text", "script", "lesson_content", "on_screen_text", "screen_text", "description", "explanation"];

function objectBody(value: unknown): string {
  if (typeof value === "string") return clean(value);
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const field of bodyFields) {
    const candidate = record[field];
    const text = Array.isArray(candidate) ? candidate.map(objectBody).filter(Boolean).join("\n\n")
      : typeof candidate === "string" ? clean(candidate) : "";
    if (text) return text;
  }
  return "";
}

/** Recover authored lessons without ever treating assessment JSON or blueprint titles as teaching. */
export function resolveLessonContent(writer: string, modules: LessonModule[]): string[][] {
  const sections: Section[] = [];
  const text = writer.replace(/\r\n/g, "\n").replace(/^```(?:json|markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let structured = false;
  try {
    const parsed: unknown = JSON.parse(text);
    structured = true;
    const visit = (value: unknown, parent?: string) => {
      if (Array.isArray(value)) { value.forEach(item => visit(item, parent)); return; }
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const title = String(record.topic_title || record.topic_name || record.module_title || record.title || record.heading || record.name || "");
      const children = record.modules || record.course_modules || record.sections || record.lessons || record.slides || record.topics;
      if (Array.isArray(children)) {
        children.forEach(child => visit(child, record.module_title ? title : parent));
      } else if (record.course_structure) {
        visit(record.course_structure, parent);
      }
      const body = objectBody(record);
      if (body && !Array.isArray(record.content)) sections.push({ title, body, module: parent });
      else if (!children && Array.isArray(record.content)) visit(record.content, parent);
    };
    visit(parsed);
  } catch {
    // Malformed structured payloads must be regenerated, never displayed as raw JSON.
    structured = /^[{[]/.test(text);
  }
  if (!structured) {
    const headings = [...text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)];
    let parent: string | undefined;
    const prefix = clean(text.slice(0, headings[0]?.index ?? text.length));
    if (prefix) sections.push({ title: "", body: prefix });
    headings.forEach((heading, index) => {
      const title = stripNarratorMarkdown(heading[1]);
      const isModule = modules.some(module => key(module.title) === key(title)) || /^module\s*\d+\b/i.test(title);
      if (isModule) parent = title;
      const body = clean(text.slice((heading.index ?? 0) + heading[0].length, headings[index + 1]?.index ?? text.length));
      if (body) sections.push({ title, body, module: parent });
    });
  }

  const result = modules.map(module => module.topics.map(() => ""));
  const used = new Set<number>();
  // Resolve all named matches first; positional recovery must not steal another topic's body.
  modules.forEach((module, mi) => module.topics.forEach((topic, ti) => {
    const index = sections.findIndex((section, si) => !used.has(si) && key(section.title) === key(topic)
      && (!section.module || key(section.module) === key(module.title)));
    if (index >= 0) { result[mi][ti] = sections[index].body; used.add(index); }
  }));
  modules.forEach((module, mi) => module.topics.forEach((topic, ti) => {
    if (result[mi][ti]) return;
    const index = sections.findIndex((section, si) => !used.has(si)
      && (!section.module || key(section.module) === key(module.title)));
    if (index >= 0) { result[mi][ti] = sections[index].body; used.add(index); }
  }));
  // Preserve additional authored sections in their module instead of silently dropping them.
  sections.forEach((section, si) => {
    if (used.has(si)) return;
    const mi = section.module ? modules.findIndex(module => key(module.title) === key(section.module || "")) : 0;
    if (mi < 0 || !result[mi]?.length) return;
    const ti = result[mi].length - 1;
    result[mi][ti] = [result[mi][ti], section.body].filter(Boolean).join("\n\n");
  });
  return result;
}

export function requireLessonContent(writer: string, modules: LessonModule[]): void {
  const resolved = resolveLessonContent(writer, modules);
  const missing = modules.flatMap((module, mi) => module.topics.filter((_, ti) => !resolved[mi]?.[ti]));
  if (!modules.length || missing.length || !resolved.some(topics => topics.some(Boolean))) {
    throw new Error(`Lesson content is missing${missing.length ? ` for: ${missing.join(", ")}` : ""}. Course generation stopped before assessment and packaging; retry lesson generation.`);
  }
}

/** Keep all teaching/media before each module's questions; incomplete modules cannot expose a quiz. */
export function sequenceLessonSlides<T extends { type: string; moduleIndex: number }>(slides: T[]): T[] {
  return [...new Set(slides.map(slide => slide.moduleIndex))].flatMap(moduleIndex => {
    const moduleSlides = slides.filter(slide => slide.moduleIndex === moduleIndex);
    const hasLessons = moduleSlides.some(slide => ["content", "narrative-flipbook", "video"].includes(slide.type));
    return [
      ...moduleSlides.filter(slide => !["assessment", "summary"].includes(slide.type)),
      ...(hasLessons ? moduleSlides.filter(slide => slide.type === "assessment" || slide.type === "summary") : []),
    ];
  });
}