import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { RawAgentOutputs } from "@/types/agents";

/* ── helpers ── */
function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { return null; } }
    return null;
  }
}

function escapeXml(s: unknown): string {
  const str = typeof s === "string" ? s : JSON.stringify(s) || "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeHtml(s: unknown): string {
  const str = typeof s === "string" ? s : JSON.stringify(s) || "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(s: unknown): string {
  return escapeXml(s).replace(/'/g, "&#39;");
}

function escapeJsString(s: unknown): string {
  return JSON.stringify(typeof s === "string" ? s : JSON.stringify(s) || "");
}

interface Module { title: string; topics: string[]; }

interface ModuleSection {
  heading: string;
  bodyMarkdown: string;
  bodyHtml: string;
  moduleContent: string;
  keyTakeaway: string;
  visualImageDataUrl?: string;
  visualSvg?: string;
  visualPlacement?: string;
  visualAltText?: string;
  screenTemplate?: "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel";
}

function normalizeTextKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTopicLabel(topic: unknown): string {
  if (typeof topic === "string") {
    const trimmed = topic.trim();
    const parsed = tryParseJSON(trimmed);
    if (parsed && parsed !== trimmed) {
      return parseTopicLabel(parsed);
    }
    return stripMarkdown(trimmed).replace(/^"|"$/g, "").trim();
  }

  if (Array.isArray(topic)) {
    return parseTopicLabel(topic[0] || "");
  }

  if (topic && typeof topic === "object") {
    const candidate = [
      (topic as Record<string, unknown>).topic_name,
      (topic as Record<string, unknown>).topic_title,
      (topic as Record<string, unknown>).title,
      (topic as Record<string, unknown>).topic,
      (topic as Record<string, unknown>).name,
      (topic as Record<string, unknown>).label,
      (topic as Record<string, unknown>).text,
    ].find((value) => typeof value === "string" && value.trim().length > 0);

    return candidate ? parseTopicLabel(candidate) : stripMarkdown(JSON.stringify(topic));
  }

  return "";
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function getFirstSentences(text: string, count: number): string {
  const sentences = splitIntoSentences(text);
  return sentences.slice(0, count).join(" ").trim();
}

function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized.split("\n");
  const htmlParts: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    htmlParts.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    htmlParts.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushParagraph();
      flushList();
      htmlParts.push(`<h3>${renderInlineMarkdown(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }

    if (/^##\s+/.test(line)) {
      flushParagraph();
      flushList();
      htmlParts.push(`<h2>${renderInlineMarkdown(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }

    if (/^#\s+/.test(line)) {
      flushParagraph();
      flushList();
      htmlParts.push(`<h1>${renderInlineMarkdown(line.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^[-*+]\s+/, ""));
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return htmlParts.join("\n        ");
}

function normalizeSvgMarkup(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const hasPreserveAspectRatio = /preserveAspectRatio=/i.test(attrs);
    const cleanedAttrs = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");

    return `<svg${cleanedAttrs} width="100%" height="100%" style="display:block;width:100%;height:100%;"${hasPreserveAspectRatio ? "" : ' preserveAspectRatio="xMidYMid meet"'}>`;
  });
}

function extractTakeaway(markdown: string): { cleanedMarkdown: string; takeaway: string } {
  const normalized = markdown.replace(/\r\n/g, "\n");

  // Pattern 1: explicit "Key Takeaway:" / "Takeaway:" / "Remember:" / "Tip:" prefix on a line
  const explicitMarker = /(?:^|\n)\s*(?:Key Takeaway|Takeaway|Remember|Tip)\s*:\s*([^\n]+)/i;
  const explicitMatch = normalized.match(explicitMarker);
  if (explicitMatch) {
    const takeaway = stripMarkdown(explicitMatch[1]).trim();
    const cleanedMarkdown = normalized
      .replace(explicitMarker, "")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
    return { cleanedMarkdown, takeaway };
  }

  // Pattern 2: short final paragraph treated as takeaway (matches LearnerPreview parseContentParts)
  const paragraphs = normalized.trim().split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1];
    const lastPlain = stripMarkdown(last).trim();
    if (lastPlain.length > 0 && lastPlain.length < 120) {
      const cleanedMarkdown = paragraphs.slice(0, -1).join("\n\n").trim();
      return { cleanedMarkdown, takeaway: lastPlain };
    }
  }

  return { cleanedMarkdown: normalized.trim(), takeaway: "" };
}

function parseModules(archRaw: string): Module[] {
  const data = tryParseJSON(archRaw);
  if (data?.modules) {
    return data.modules.map((m: any) => ({
      title: String(m.title || m.module_title || ""),
      topics: (m.topics || m.sections || []).map((t: any) => parseTopicLabel(t)).filter(Boolean),
    }));
  }
  const modules: Module[] = [];
  const lines = archRaw.split("\n");
  let cur: Module | null = null;
  for (const line of lines) {
    const mm = line.match(/^#+\s*(?:Module\s*\d+[:.]\s*)?(.+)/i) || line.match(/^\*\*(?:Module\s*\d+[:.]\s*)?(.+?)\*\*/i);
    if (mm) { if (cur) modules.push(cur); cur = { title: mm[1].trim(), topics: [] }; }
    else if (cur && line.match(/^[-*]\s+(.+)/)) { cur.topics.push(parseTopicLabel(line.replace(/^[-*]\s+/, "").trim())); }
  }
  if (cur) modules.push(cur);
  return modules;
}

function parseVisualSections(visualRaw: string): Map<string, Map<string, { imageDataUrl?: string; svg?: string; placement: string; altText: string; screenTemplate?: "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel" }>> {
  const visualData = tryParseJSON(visualRaw);
  const modules = visualData?.modules || visualData?.course_visual_plan?.modules || visualData?.module_visuals || [];
  const visualMap = new Map<string, Map<string, { imageDataUrl?: string; svg?: string; placement: string; altText: string; screenTemplate?: "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel" }>>();

  modules.forEach((moduleVisual: any) => {
    const moduleTitle = String(moduleVisual?.module_title || moduleVisual?.title || moduleVisual?.name || "").trim();
    if (!moduleTitle) return;

    const topicMap = new Map<string, { imageDataUrl?: string; svg?: string; placement: string; altText: string; screenTemplate?: "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel" }>();
    const topicVisuals = Array.isArray(moduleVisual?.topic_visuals) ? moduleVisual.topic_visuals : [];
    topicVisuals.forEach((topicVisual: any) => {
      const topicTitle = String(topicVisual?.topic_title || topicVisual?.title || topicVisual?.name || "").trim();
      const generatedImageDataUrl = String(topicVisual?.generated_image_data_url || "").trim();
      const generatedSceneSvg = String(topicVisual?.generated_scene_svg || "").trim();
      const screenTemplate = topicVisual?.screen_template === "dashboard" || topicVisual?.screen_template === "guided-notes" || topicVisual?.screen_template === "scenario" || topicVisual?.screen_template === "media-quiz" || topicVisual?.screen_template === "summary-panel"
        ? topicVisual.screen_template
        : undefined;
      if (!topicTitle || (!generatedImageDataUrl && !generatedSceneSvg && !screenTemplate)) return;
      topicMap.set(normalizeTextKey(topicTitle), {
        imageDataUrl: generatedImageDataUrl || undefined,
        svg: generatedSceneSvg ? normalizeSvgMarkup(generatedSceneSvg) : undefined,
        placement: String(topicVisual?.placement || "hero"),
        altText: String(topicVisual?.alt_text || `AI-generated visual for ${topicTitle}`),
        screenTemplate,
      });
    });

    visualMap.set(normalizeTextKey(moduleTitle), topicMap);
  });

  return visualMap;
}

function parseScript(writerRaw: string, modules: Module[], visualRaw?: string): Map<string, ModuleSection[]> {
  if (!writerRaw) return new Map<string, ModuleSection[]>();

  const typedMap = new Map<string, ModuleSection[]>();
  const sectionMap = new Map<string, string>();
  const visualMap = parseVisualSections(visualRaw || "");
  const chunks = writerRaw.split(/^##\s+/m).map((chunk) => chunk.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const [headingLine, ...bodyLines] = chunk.split("\n");
    const heading = headingLine?.trim();
    if (!heading) continue;
    sectionMap.set(normalizeTextKey(heading), bodyLines.join("\n").trim());
  }

  modules.forEach((mod) => {
    const moduleVisuals = visualMap.get(normalizeTextKey(mod.title)) || new Map();
    const moduleSections: ModuleSection[] = (mod.topics.length > 0 ? mod.topics : [mod.title]).map((topic) => {
      const heading = parseTopicLabel(topic) || mod.title;
      const rawMarkdown = sectionMap.get(normalizeTextKey(heading)) || `Content for ${heading}`;
      const { cleanedMarkdown, takeaway } = extractTakeaway(rawMarkdown);
      const bodyMarkdown = cleanedMarkdown || rawMarkdown;
      const plainText = stripMarkdown(bodyMarkdown);
      const visual = moduleVisuals.get(normalizeTextKey(heading));
      return {
        heading,
        bodyMarkdown,
        bodyHtml: markdownToHtml(bodyMarkdown),
        moduleContent: getFirstSentences(plainText, 3) || plainText || `Key point: ${heading}`,
        keyTakeaway: takeaway,
        visualImageDataUrl: visual?.imageDataUrl,
        visualSvg: visual?.svg,
        visualPlacement: visual?.placement,
        visualAltText: visual?.altText,
        screenTemplate: visual?.screenTemplate,
      };
    });

    typedMap.set(mod.title, moduleSections);
  });

  return typedMap;
}

function parseAssessment(assessRaw: string): { question: string; options: string[]; correct: number }[] {
  const data = tryParseJSON(assessRaw);
  if (data?.mcq) {
    return data.mcq.map((q: any) => ({
      question: q.question || q.stem || "",
      options: q.options || q.choices || [],
      correct: typeof q.correct_answer === "number" ? q.correct_answer : 0,
    }));
  }
  return [];
}

interface NarrationSection {
  title: string;
  narration_text: string;
  word_count: number;
}

function parseVoiceSections(voiceRaw: string): NarrationSection[] {
  if (!voiceRaw) return [];
  const data = tryParseJSON(voiceRaw);
  return data?.sections || [];
}

/* ── TTS Generation ── */
async function generateTTSAudio(text: string, voiceId: string): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/elevenlabs-tts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ text: text.slice(0, 5000), voiceId }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || `TTS failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const audioBase64: string | undefined = payload?.audioBase64 || payload?.audio_base64;
    if (!audioBase64) {
      throw new Error("TTS response did not include audio payload");
    }
    return audioBase64;
  }

  const audioBuffer = await response.arrayBuffer();
  return arrayBufferToBase64(audioBuffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ── SCORM 1.2 XSD schema stubs ── */
const IMSCP_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  elementFormDefault="qualified" version="IMS CP 1.1.2">
  <xs:element name="manifest"/>
</xs:schema>`;

const ADLCP_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  elementFormDefault="qualified" version="ADL SCORM 1.2">
  <xs:attribute name="scormtype" type="xs:string"/>
</xs:schema>`;

const IMSMD_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1"
  xmlns="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1"
  elementFormDefault="qualified" version="IMS MD 1.2.2">
</xs:schema>`;

/* ── SCORM imsmanifest.xml ── */
function buildManifest(courseTitle: string, modules: Module[]): string {
  const orgItems = modules.map((m, i) =>
    `      <item identifier="ITEM_M${i + 1}" identifierref="RES_M${i + 1}">
        <title>${escapeXml(m.title)}</title>
      </item>`
  ).join("\n");

  const resources = modules.map((m, i) =>
    `    <resource identifier="RES_M${i + 1}" type="webcontent" adlcp:scormType="sco" href="module_${i + 1}.html">
      <file href="module_${i + 1}.html"/>
    </resource>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST_001" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG_001">
    <organization identifier="ORG_001">
      <title>${escapeXml(courseTitle)}</title>
${orgItems}
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
}

/* ── SCORM API wrapper (lightweight) ── */
const SCORM_API_JS = `// SCORM 1.2 API wrapper
var API = null;
function findAPI(win) {
  var tries = 0;
  while ((!win.API) && (win.parent) && (win.parent != win)) {
    tries++;
    if (tries > 7) return null;
    win = win.parent;
  }
  return win.API || null;
}
function getAPI() {
  if (API) return API;
  API = findAPI(window);
  if (!API && window.opener) API = findAPI(window.opener);
  return API;
}
function scormInit() {
  var api = getAPI();
  if (api) api.LMSInitialize("");
}
function scormFinish() {
  var api = getAPI();
  if (api) api.LMSFinish("");
}
function scormSetComplete() {
  var api = getAPI();
  if (api) {
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    api.LMSCommit("");
  }
}
function scormSetScore(score) {
  var api = getAPI();
  if (api) {
    api.LMSSetValue("cmi.core.score.raw", String(score));
    api.LMSSetValue("cmi.core.score.min", "0");
    api.LMSSetValue("cmi.core.score.max", "100");
    api.LMSCommit("");
  }
}
`;

/* ── Module HTML page builder ── */
function buildModuleHtml(
  courseTitle: string,
  mod: Module,
  moduleIndex: number,
  totalModules: number,
  sections: ModuleSection[],
  quizzes: { question: string; options: string[]; correct: number }[],
  audioBase64: string | null,
  narrationText: string
): string {
  // Split narration into sentences for highlighting
  const sentences = narrationText
    ? narrationText.match(/[^.!?]+[.!?]+[\s]*/g) || [narrationText]
    : [];
  const hasSentences = sentences.length > 0 && audioBase64;

  const moduleTopics = sections.map((section) => ({
    heading: section.heading,
    moduleContent: section.moduleContent,
  }));

  const renderDashboardSection = (section: ModuleSection, sectionIndex: number) => {
    const objectives = moduleTopics.slice(Math.max(0, sectionIndex - 1), Math.max(0, sectionIndex - 1) + 3);
    return `
      <section class="lesson-section lesson-template-dashboard" id="section-${sectionIndex + 1}">
        <div class="dashboard-grid">
          <div class="dashboard-main-card">
            <p class="dashboard-eyebrow">Lesson ${sectionIndex + 1}</p>
            <h2>${escapeHtml(section.heading)}</h2>
            <p class="dashboard-summary">${escapeHtml(section.moduleContent)}</p>
            ${section.visualImageDataUrl || section.visualSvg ? `
            <div class="dashboard-hero-card" aria-label="${escapeAttribute(section.visualAltText || section.heading)}">
              <div class="dashboard-hero-frame">
                ${section.visualImageDataUrl
                  ? `<img src="${escapeAttribute(section.visualImageDataUrl)}" alt="${escapeAttribute(section.visualAltText || section.heading)}" class="section-visual-image"/>`
                  : section.visualSvg || ""}
              </div>
            </div>` : ""}
            <div class="dashboard-copy-card">
              ${section.bodyHtml}
            </div>
          </div>
          <div class="dashboard-side-column">
            <div class="dashboard-info-card">
              <div class="dashboard-card-label">Learning objectives</div>
              <div class="dashboard-objectives">
                ${objectives.map((topic) => `<div class="dashboard-objective"><span class="dashboard-dot"></span><span>${escapeHtml(topic.heading)}</span></div>`).join("")}
              </div>
            </div>
            <div class="dashboard-info-card">
              <div class="dashboard-card-label">Guided takeaway</div>
              <p>${renderInlineMarkdown(section.keyTakeaway || section.moduleContent)}</p>
            </div>
            <div class="dashboard-info-card dashboard-info-card-warm">
              <div class="dashboard-card-label">Did you know?</div>
              <p>${escapeHtml(section.keyTakeaway || getFirstSentences(stripMarkdown(section.bodyMarkdown), 1) || section.moduleContent)}</p>
            </div>
          </div>
        </div>
      </section>`;
  };

  const renderScenarioSection = (section: ModuleSection, sectionIndex: number) => {
    const supportingText = getFirstSentences(stripMarkdown(section.bodyMarkdown), 2) || section.moduleContent;
    return `
      <section class="lesson-section lesson-template-scenario" id="section-${sectionIndex + 1}">
        <div class="scenario-grid">
          <div class="scenario-main-card">
            <div class="dashboard-card-label">Scenario</div>
            <h2>${escapeHtml(section.heading)}</h2>
            <p class="dashboard-summary">${escapeHtml(section.moduleContent)}</p>
            <div class="scenario-callout">
              <div class="dashboard-card-label">What is happening?</div>
              <p>${escapeHtml(supportingText)}</p>
            </div>
            <div class="dashboard-copy-card">
              ${section.bodyHtml}
            </div>
          </div>
          <div class="scenario-side-column">
            <div class="dashboard-info-card">
              <div class="dashboard-card-label">Visual context</div>
              <div class="dashboard-hero-frame">
                ${section.visualImageDataUrl
                  ? `<img src="${escapeAttribute(section.visualImageDataUrl)}" alt="${escapeAttribute(section.visualAltText || section.heading)}" class="section-visual-image"/>`
                  : section.visualSvg || `<div class="scenario-empty-visual">Scenario visual placeholder</div>`}
              </div>
            </div>
            <div class="dashboard-info-card dashboard-info-card-warm">
              <div class="dashboard-card-label">Better move</div>
              <p>${renderInlineMarkdown(section.keyTakeaway || section.moduleContent)}</p>
            </div>
          </div>
        </div>
      </section>`;
  };

  const renderMediaQuizSection = (section: ModuleSection, sectionIndex: number) => {
    const quizPreview = quizzes[sectionIndex] || quizzes[0];
    return `
      <section class="lesson-section lesson-template-media-quiz" id="section-${sectionIndex + 1}">
        <div class="media-quiz-grid">
          <div class="media-quiz-main-card">
            <div class="dashboard-card-label">Media Focus</div>
            <h2>${escapeHtml(section.heading)}</h2>
            <p class="dashboard-summary">${escapeHtml(section.moduleContent)}</p>
            <div class="dashboard-hero-card">
              <div class="dashboard-hero-frame">
                ${section.visualImageDataUrl
                  ? `<img src="${escapeAttribute(section.visualImageDataUrl)}" alt="${escapeAttribute(section.visualAltText || section.heading)}" class="section-visual-image"/>`
                  : section.visualSvg || `<div class="scenario-empty-visual">Media placeholder</div>`}
              </div>
            </div>
            <div class="dashboard-copy-card">
              ${section.bodyHtml}
            </div>
          </div>
          <div class="dashboard-side-column">
            <div class="dashboard-info-card">
              <div class="dashboard-card-label">Quick check</div>
              ${quizPreview ? `
              <p class="media-quiz-question">${escapeHtml(quizPreview.question)}</p>
              <div class="media-quiz-options">
                ${quizPreview.options.slice(0, 3).map((option, index) => `<div class="media-quiz-option"><strong>${String.fromCharCode(65 + index)}.</strong> ${escapeHtml(option)}</div>`).join("")}
              </div>` : `<p>No quiz preview available for this screen.</p>`}
            </div>
            <div class="dashboard-info-card dashboard-info-card-warm">
              <div class="dashboard-card-label">Takeaway</div>
              <p>${renderInlineMarkdown(section.keyTakeaway || section.moduleContent)}</p>
            </div>
          </div>
        </div>
      </section>`;
  };

  const renderSummaryPanelSection = (section: ModuleSection, sectionIndex: number) => {
    const bulletSentences = splitIntoSentences(stripMarkdown(section.bodyMarkdown)).slice(0, 3);
    return `
      <section class="lesson-section lesson-template-summary-panel" id="section-${sectionIndex + 1}">
        <div class="summary-panel-header">
          <div>
            <div class="dashboard-card-label">Summary panel</div>
            <h2>${escapeHtml(section.heading)}</h2>
          </div>
        </div>
        <div class="summary-panel-grid">
          <div class="summary-panel-card">
            <div class="dashboard-card-label">Key takeaway</div>
            <p>${renderInlineMarkdown(section.keyTakeaway || section.moduleContent)}</p>
          </div>
          <div class="summary-panel-card">
            <div class="dashboard-card-label">Signals to remember</div>
            ${bulletSentences.map((sentence) => `<div class="dashboard-objective"><span class="dashboard-dot"></span><span>${escapeHtml(sentence)}</span></div>`).join("")}
          </div>
          <div class="summary-panel-card summary-panel-card-warm">
            <div class="dashboard-card-label">Apply next</div>
            <p>${escapeHtml(getFirstSentences(stripMarkdown(section.bodyMarkdown), 1) || section.moduleContent)}</p>
          </div>
        </div>
      </section>`;
  };

  const sectionsHtml = sections.map((section, sectionIndex) => section.screenTemplate === "dashboard" ? renderDashboardSection(section, sectionIndex) : section.screenTemplate === "scenario" ? renderScenarioSection(section, sectionIndex) : section.screenTemplate === "media-quiz" ? renderMediaQuizSection(section, sectionIndex) : section.screenTemplate === "summary-panel" ? renderSummaryPanelSection(section, sectionIndex) : `
      <section class="lesson-section" id="section-${sectionIndex + 1}">
        <div
          class="avatar-narrator"
          data-topic="${escapeAttribute(section.heading)}"
          data-module-content="${escapeAttribute(section.moduleContent)}"
          data-system-hint="${escapeAttribute("Focus on the practical benefit to an office worker.")}"
        >
          <div class="topic-pill-row">
            ${moduleTopics.map((topic) => `
              <button
                type="button"
                class="topic-pill${normalizeTextKey(topic.heading) === normalizeTextKey(section.heading) ? " active" : ""}"
                data-topic="${escapeAttribute(topic.heading)}"
                data-module-content="${escapeAttribute(topic.moduleContent)}"
              >${escapeHtml(topic.heading)}</button>`).join("")}
          </div>
          <div class="avatar-head">
            <div class="avatar-circle">SC</div>
            <div>
              <p class="avatar-name">Sarah</p>
              <p class="avatar-role">Your learning guide</p>
            </div>
          </div>
          <div class="speech-bubble">
            <span data-role="speech-text"></span>
            <span class="avatar-cursor" aria-hidden="true"></span>
          </div>
          <div class="avatar-actions">
            <button type="button" class="avatar-btn explain-btn" data-action="explain">Explain this</button>
            <button type="button" class="avatar-btn stop-btn" data-action="stop" hidden>Stop</button>
            <button type="button" class="avatar-btn example-btn" data-action="example" hidden>Give me an example</button>
          </div>
        </div>
        <div class="section-layout ${section.visualImageDataUrl || section.visualSvg ? `layout-${escapeAttribute(section.visualPlacement || "hero")}` : "layout-text-only"}">
          ${section.visualImageDataUrl || section.visualSvg ? `
          <div class="section-visual-card" aria-label="${escapeAttribute(section.visualAltText || section.heading)}">
            <div class="section-visual-frame">
              ${section.visualImageDataUrl
                ? `<img src="${escapeAttribute(section.visualImageDataUrl)}" alt="${escapeAttribute(section.visualAltText || section.heading)}" class="section-visual-image"/>`
                : section.visualSvg || ""}
            </div>
          </div>` : ""}
          <div class="section-body">
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.bodyHtml}
          </div>
        </div>
        ${section.keyTakeaway ? `
        <aside class="key-takeaway-card">
          <div class="key-takeaway-label">Key takeaway</div>
          <p>${renderInlineMarkdown(section.keyTakeaway)}</p>
        </aside>` : ""}
      </section>`).join("\n");

  const audioHtml = audioBase64 ? `
      <div class="audio-section">
        <div class="audio-header">
          <h2>🎧 Listen to Narration</h2>
          <div class="palette-bar">
            <span class="palette-label">Highlight:</span>
            <button class="palette-btn active" data-palette="yellow" onclick="setPalette('yellow')" title="Yellow">
              <span class="palette-dot" style="background:var(--hl-yellow-bg, #fef9c3);border-color:var(--hl-yellow-border, #fde047)"></span>
            </button>
            <button class="palette-btn" data-palette="mint" onclick="setPalette('mint')" title="Mint">
              <span class="palette-dot" style="background:var(--hl-mint-bg, #d1fae5);border-color:var(--hl-mint-border, #6ee7b7)"></span>
            </button>
            <button class="palette-btn" data-palette="sky" onclick="setPalette('sky')" title="Sky">
              <span class="palette-dot" style="background:var(--hl-sky-bg, #dbeafe);border-color:var(--hl-sky-border, #93c5fd)"></span>
            </button>
            <button class="hl-toggle active" id="hlToggle" onclick="toggleHighlight()">On</button>
          </div>
        </div>
        <audio controls class="audio-player" id="moduleAudio" preload="auto">
          <source src="data:audio/mpeg;base64,${audioBase64}" type="audio/mpeg"/>
          Your browser does not support the audio element.
        </audio>
        <p class="audio-hint">Click play — text highlights sentence by sentence as you listen</p>
      </div>` : "";

  const quizHtml = quizzes.length > 0 ? `
      <div class="quiz-section">
        <h2>Knowledge Check</h2>
        ${quizzes.map((q, qi) => `
        <div class="quiz-item" id="q${qi}">
          <p class="quiz-q"><strong>Q${qi + 1}.</strong> ${escapeHtml(q.question)}</p>
          ${q.options.map((opt, oi) => `
          <label class="quiz-opt" data-option-index="${oi}">
            <input type="radio" name="q${qi}" value="${oi}" onchange="checkAnswer(${qi},${oi},${q.correct})"/>
            <span>${escapeHtml(typeof opt === "string" ? opt : String(opt))}</span>
          </label>`).join("")}
          <p class="quiz-fb" id="fb${qi}"></p>
        </div>`).join("")}
      </div>` : "";

  const navPrev = moduleIndex > 0
    ? `<a href="module_${moduleIndex}.html" class="nav-btn">&larr; Previous</a>`
    : `<span></span>`;
  const navNext = moduleIndex < totalModules - 1
    ? `<a href="module_${moduleIndex + 2}.html" class="nav-btn">Next &rarr;</a>`
    : `<button class="nav-btn complete-btn" onclick="completeCourse()">Complete Course ✓</button>`;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(mod.title)} - ${escapeHtml(courseTitle)}</title>
  <script>${SCORM_API_JS}<\/script>
  <style>
    :root {
      --primary: #4f46e5;
      --primary-strong: #7c3aed;
      --primary-rgb: 79, 70, 229;
      --bg: #f8f9fc;
      --card: #fff;
      --text: #1e1b4b;
      --muted: #64748b;
      --border: #e2e8f0;
      --text-inverse: #fff;
      --header-start: #4f46e5;
      --header-end: #7c3aed;
      --progress-track: rgba(255,255,255,0.25);
      --progress-fill: #fbbf24;
      --shadow-elevated: rgba(var(--primary-rgb), 0.06);
      --topic-pill-border: #c7c3f3;
      --topic-pill-bg: #f6f4ff;
      --topic-pill-active-bg: #eeedfe;
      --topic-pill-active-border: #afa9ec;
      --topic-pill-text: #3c3489;
      --avatar-surface: #EEEDFE;
      --avatar-accent: #3C3489;
      --bubble-border: #AFA9EC;
      --bubble-text: #26215C;
      --key-takeaway-bg: #EAF3DE;
      --key-takeaway-border: #639922;
      --key-takeaway-text: #4b641b;
      --code-bg: #f3f4f6;
      --hl-yellow-bg: #fef9c3;
      --hl-yellow-border: #fde047;
      --hl-mint-bg: #d1fae5;
      --hl-mint-border: #6ee7b7;
      --hl-sky-bg: #dbeafe;
      --hl-sky-border: #93c5fd;
      --audio-bg-start: #eef2ff;
      --audio-bg-end: #e0e7ff;
      --audio-border: #c7d2fe;
      --quiz-hover: #f1f0ff;
      --quiz-correct: #d1fae5;
      --quiz-correct-text: #065f46;
      --quiz-incorrect: #fee2e2;
      --quiz-incorrect-text: #991b1b;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f1224;
        --card: #171b31;
        --text: #eef2ff;
        --muted: #a5b4d4;
        --border: #2d355e;
        --text-inverse: #ffffff;
        --header-start: #4338ca;
        --header-end: #6d28d9;
        --progress-track: rgba(255,255,255,0.16);
        --shadow-elevated: rgba(0, 0, 0, 0.28);
        --topic-pill-border: #4d4b8f;
        --topic-pill-bg: #26254c;
        --topic-pill-active-bg: #323169;
        --topic-pill-active-border: #7b77d9;
        --topic-pill-text: #e9e7ff;
        --avatar-surface: #2d2b58;
        --avatar-accent: #f1efff;
        --bubble-border: #6f69b9;
        --bubble-text: #f2f0ff;
        --key-takeaway-bg: #243017;
        --key-takeaway-border: #86b840;
        --key-takeaway-text: #d6f0ae;
        --code-bg: #232947;
        --hl-yellow-bg: #584400;
        --hl-yellow-border: #facc15;
        --hl-mint-bg: #123d2f;
        --hl-mint-border: #34d399;
        --hl-sky-bg: #1d3557;
        --hl-sky-border: #60a5fa;
        --audio-bg-start: #202855;
        --audio-bg-end: #1c2347;
        --audio-border: #4653a8;
        --quiz-hover: #26295a;
        --quiz-correct: #143628;
        --quiz-correct-text: #9be8bf;
        --quiz-incorrect: #4a1d24;
        --quiz-incorrect-text: #ffb4b4;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; color-scheme: light dark; }
    button, input, select, textarea, audio { font: inherit; color-scheme: light dark; }
    .header { position: relative; background: linear-gradient(135deg, var(--header-start, #4f46e5), var(--header-end, #7c3aed)); color: var(--text-inverse, #fff); padding: 32px 40px 27px; }
    .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
    .header .meta { font-size: 13px; opacity: 0.85; }
    .progress-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--progress-track, rgba(255,255,255,0.25)); }
    .progress-fill { height: 100%; background: var(--progress-fill, #fbbf24); transition: width 0.3s; }
    .container { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
    .lesson-section { margin-bottom: 32px; padding: 24px; border-radius: 24px; background: var(--card); border: 1px solid var(--border); box-shadow: 0 12px 30px var(--shadow-elevated, rgba(79, 70, 229, 0.06)); }
    .lesson-template-dashboard { padding: 26px; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98)); }
    .dashboard-grid { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr) 260px; align-items: start; }
    .dashboard-main-card, .dashboard-info-card { border-radius: 20px; border: 1px solid var(--border); background: rgba(255,255,255,0.92); box-shadow: 0 12px 28px var(--shadow-elevated, rgba(79, 70, 229, 0.06)); }
    .dashboard-main-card { padding: 20px; }
    .dashboard-side-column { display: grid; gap: 16px; }
    .scenario-grid, .media-quiz-grid { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; }
    .scenario-main-card, .media-quiz-main-card { border-radius: 20px; border: 1px solid var(--border); background: rgba(255,255,255,0.92); box-shadow: 0 12px 28px var(--shadow-elevated, rgba(79, 70, 229, 0.06)); padding: 20px; }
    .scenario-side-column { display: grid; gap: 16px; }
    .scenario-callout { margin-top: 16px; border-radius: 18px; border: 1px solid var(--border); background: linear-gradient(180deg, #f8fbff, #eef4fa); padding: 16px; }
    .scenario-empty-visual { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 220px; color: var(--muted); font-size: 14px; text-align: center; padding: 18px; background: linear-gradient(180deg, #f7fafc, #edf2f7); }
    .media-quiz-question { font-size: 15px; font-weight: 800; color: var(--text); margin-bottom: 12px; }
    .media-quiz-options { display: grid; gap: 8px; }
    .media-quiz-option { border-radius: 12px; border: 1px solid var(--border); background: #fbfdff; padding: 10px 12px; font-size: 13px; color: var(--text); }
    .summary-panel-header { margin-bottom: 18px; }
    .summary-panel-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .summary-panel-card { border-radius: 20px; border: 1px solid var(--border); background: rgba(255,255,255,0.96); box-shadow: 0 12px 28px var(--shadow-elevated, rgba(79, 70, 229, 0.06)); padding: 18px; }
    .summary-panel-card-warm { background: #fff7df; }
    .dashboard-eyebrow { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #5f7b9e; margin-bottom: 10px; }
    .dashboard-summary { margin-top: 10px; font-size: 15px; color: var(--muted); }
    .dashboard-hero-card { margin-top: 18px; overflow: hidden; border-radius: 18px; border: 1px solid var(--border); background: linear-gradient(180deg, #eef3f8, #f8fafc); }
    .dashboard-hero-frame { aspect-ratio: 16 / 10; width: 100%; }
    .dashboard-hero-frame svg { display: block; width: 100%; height: 100%; }
    .dashboard-copy-card { margin-top: 18px; border-radius: 18px; border: 1px solid var(--border); background: #fff; padding: 18px; }
    .dashboard-info-card { padding: 16px; }
    .dashboard-info-card-warm { background: #fff7df; }
    .dashboard-card-label { margin-bottom: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #5f7b9e; }
    .dashboard-objectives { display: grid; gap: 10px; }
    .dashboard-objective { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; color: var(--text); }
    .dashboard-dot { width: 10px; height: 10px; border-radius: 999px; background: #f59e0b; margin-top: 4px; flex: 0 0 auto; }
    .topic-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .topic-pill { border: 1px solid var(--topic-pill-border, #c7c3f3); background: var(--topic-pill-bg, #f6f4ff); color: var(--topic-pill-text, #3c3489); font-size: 12px; font-weight: 700; padding: 7px 12px; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; }
    .topic-pill.active, .topic-pill:hover { background: var(--topic-pill-active-bg, #eeedfe); border-color: var(--topic-pill-active-border, #afa9ec); }
    .avatar-narrator { margin-bottom: 24px; }
    .avatar-head { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .avatar-circle { width: 64px; height: 64px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; background: var(--avatar-surface, #EEEDFE); color: var(--avatar-accent, #3C3489); }
    .avatar-name { font-size: 16px; font-weight: 700; color: var(--text); }
    .avatar-role { font-size: 14px; color: var(--muted); }
    .speech-bubble { min-height: 144px; border-radius: 24px; padding: 18px 20px; background: var(--avatar-surface, #EEEDFE); border: 1px solid var(--bubble-border, #AFA9EC); color: var(--bubble-text, #26215C); font-size: 14px; line-height: 1.9; }
    .avatar-cursor { display: inline-block; width: 2px; height: 18px; margin-left: 2px; transform: translateY(3px); background: var(--bubble-text, #26215C); opacity: 0; }
    .avatar-narrator.is-streaming .avatar-cursor { opacity: 1; animation: blink 1s step-end infinite; }
    .avatar-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .avatar-btn { border-radius: 999px; padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
    .explain-btn { border: 1px solid var(--avatar-accent, #3C3489); background: var(--avatar-accent, #3C3489); color: var(--text-inverse, #fff); }
    .stop-btn, .example-btn { border: 1px solid var(--bubble-border, #AFA9EC); background: var(--card, #fff); color: var(--bubble-text, #26215C); }
    .avatar-btn:hover { transform: translateY(-1px); }
    .avatar-btn[disabled] { opacity: 0.6; cursor: not-allowed; transform: none; }
    .section-layout { display: grid; gap: 18px; }
    .layout-side-panel { grid-template-columns: minmax(0, 1fr) 280px; align-items: start; }
    .layout-inline-card { grid-template-columns: minmax(0, 1fr); }
    .layout-hero { grid-template-columns: minmax(0, 1fr); }
    .layout-text-only { grid-template-columns: minmax(0, 1fr); }
    .section-visual-card { overflow: hidden; border-radius: 18px; border: 1px solid var(--border); background: linear-gradient(180deg, #eef3f8, #f8fafc); box-shadow: 0 12px 24px var(--shadow-elevated, rgba(79, 70, 229, 0.06)); }
    .section-visual-image { display: block; width: 100%; height: 100%; object-fit: cover; }
    .section-visual-frame { aspect-ratio: 8 / 5; width: 100%; }
    .section-visual-frame svg { display: block; width: 100%; height: 100%; }
    .section-body { font-size: 15px; line-height: 1.8; }
    .section-body h2, .section-body h3 { color: var(--text); margin-bottom: 12px; }
    .section-body h2 { font-size: 22px; }
    .section-body h3 { font-size: 18px; margin-top: 22px; }
    .section-body p, .section-body ul { margin-bottom: 16px; }
    .section-body ul { padding-left: 22px; }
    .section-body li { margin-bottom: 8px; }
    .section-body strong { font-weight: 800; }
    .section-body code { background: var(--code-bg, #f3f4f6); padding: 1px 6px; border-radius: 6px; font-size: 0.95em; }
    .section-body a { color: var(--primary); }
    .key-takeaway-card { margin-top: 18px; padding: 16px 18px; border-left: 3px solid var(--key-takeaway-border, #639922); background: var(--key-takeaway-bg, #EAF3DE); border-radius: 14px; }
    .key-takeaway-label { margin-bottom: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--key-takeaway-text, #4b641b); }
    #narration-text { font-size: 16px; line-height: 2; }
    .hl-sentence { padding: 2px 4px; border-radius: 6px; transition: background 0.3s ease, box-shadow 0.3s ease; }
    .hl-sentence.active-yellow { background: var(--hl-yellow-bg, #fef9c3); box-shadow: inset 4px 0 0 var(--hl-yellow-border, #fde047); }
    .hl-sentence.active-mint { background: var(--hl-mint-bg, #d1fae5); box-shadow: inset 4px 0 0 var(--hl-mint-border, #6ee7b7); }
    .hl-sentence.active-sky { background: var(--hl-sky-bg, #dbeafe); box-shadow: inset 4px 0 0 var(--hl-sky-border, #93c5fd); }
    .audio-section { background: linear-gradient(135deg, var(--audio-bg-start, #eef2ff), var(--audio-bg-end, #e0e7ff)); border: 1px solid var(--audio-border, #c7d2fe); border-radius: 16px; padding: 24px; margin-bottom: 28px; }
    .audio-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .audio-section h2 { font-size: 18px; color: var(--primary); margin: 0; }
    .audio-player { width: 100%; height: 48px; border-radius: 12px; accent-color: var(--primary); background: var(--card); color-scheme: light dark; }
    .audio-player::-webkit-media-controls-panel { background: var(--card); color: var(--text); }
    .audio-player::-webkit-media-controls-current-time-display,
    .audio-player::-webkit-media-controls-time-remaining-display { color: var(--text); }
    .audio-hint { font-size: 12px; color: var(--muted); margin-top: 8px; }
    .palette-bar { display: flex; align-items: center; gap: 6px; }
    .palette-label { font-size: 12px; font-weight: 600; color: var(--muted); }
    .palette-btn { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.2s; }
    .palette-btn.active { border-color: var(--primary); }
    .palette-dot { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid; }
    .hl-toggle { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; border: 1.5px solid var(--primary); background: none; color: var(--primary); cursor: pointer; transition: all 0.2s; }
    .hl-toggle.active { background: var(--primary); color: var(--text-inverse, #fff); }
    .quiz-section { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-top: 32px; }
    .quiz-section h2 { font-size: 18px; margin-bottom: 16px; color: var(--primary); }
    .quiz-item { margin-bottom: 20px; }
    .quiz-q { margin-bottom: 8px; font-size: 14px; }
    .quiz-opt { display: flex; width: 100%; padding: 0; margin: 8px 0; border-radius: 12px; cursor: pointer; font-size: 14px; border: 1px solid var(--border); background: var(--card); transition: background 0.2s, border-color 0.2s, transform 0.2s; overflow: hidden; }
    .quiz-opt:hover { background: var(--quiz-hover, #f1f0ff); }
    .quiz-opt input { position: absolute; opacity: 0; pointer-events: none; }
    .quiz-opt span { display: block; width: 100%; padding: 12px 14px; }
    .quiz-opt.correct { background: var(--quiz-correct, #d1fae5); border-color: var(--quiz-correct, #d1fae5); color: var(--quiz-correct-text, #065f46); }
    .quiz-opt.incorrect { background: var(--quiz-incorrect, #fee2e2); border-color: var(--quiz-incorrect, #fee2e2); color: var(--quiz-incorrect-text, #991b1b); }
    .quiz-fb { margin-top: 8px; font-size: 13px; font-weight: 600; min-height: 20px; }
    .quiz-fb.correct { color: var(--quiz-correct-text, #065f46); }
    .quiz-fb.incorrect { color: var(--quiz-incorrect-text, #991b1b); }
    .nav { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); }
    .nav-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; color: var(--primary); border: 2px solid var(--primary); background: transparent; cursor: pointer; transition: all 0.2s; }
    .nav-btn:hover { background: var(--primary); color: var(--text-inverse, #fff); }
    .complete-btn { background: var(--primary); color: var(--text-inverse, #fff); border-color: var(--primary); }
    @media (max-width: 480px) {
      .header { padding: 24px 20px 19px; }
      .container { padding: 24px 16px; }
      .lesson-section { padding: 18px; }
      .dashboard-grid { grid-template-columns: 1fr; }
      .scenario-grid, .media-quiz-grid { grid-template-columns: 1fr; }
      .summary-panel-grid { grid-template-columns: 1fr; }
      .layout-side-panel { grid-template-columns: 1fr; }
      .avatar-head { flex-direction: column; align-items: flex-start; gap: 10px; }
      .avatar-actions { flex-direction: column; }
      .avatar-btn { width: 100%; }
      .speech-bubble { min-height: 120px; }
    }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
</head>
<body onload="scormInit()">
  <div class="header">
    <div class="meta">${escapeHtml(courseTitle)}</div>
    <h1>Module ${moduleIndex + 1}: ${escapeHtml(mod.title)}</h1>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(((moduleIndex + 1) / totalModules) * 100)}%"></div></div>
  </div>
  <div class="container">
    ${audioHtml}
    ${sectionsHtml}
    ${quizHtml}
    <div class="nav">
      ${navPrev}
      ${navNext}
    </div>
  </div>
  <script>
    var score = 0, total = ${quizzes.length}, answered = 0;
    var hlEnabled = true, hlPalette = 'yellow';
    var totalSentences = ${hasSentences ? sentences.length : 0};
    var animId = 0;
    var avatarSupabaseUrl = ${escapeJsString(supabaseUrl)};
    var avatarSupabaseKey = ${escapeJsString(supabaseKey)};
    var avatarExampleHint = ${escapeJsString("Give one vivid real-world workplace example in 2 sentences.")};

    function checkAnswer(qi, selected, correct) {
      var item = document.getElementById('q' + qi);
      var fb = document.getElementById('fb' + qi);
      if (item.getAttribute('data-answered') === 'true') {
        return;
      }
      item.setAttribute('data-answered', 'true');

      var labels = item.querySelectorAll('.quiz-opt');
      for (var labelIndex = 0; labelIndex < labels.length; labelIndex++) {
        labels[labelIndex].classList.remove('correct');
        labels[labelIndex].classList.remove('incorrect');
      }

      var selectedLabel = item.querySelector('.quiz-opt[data-option-index="' + selected + '"]');
      var correctLabel = item.querySelector('.quiz-opt[data-option-index="' + correct + '"]');
      if (selected === correct) {
        fb.textContent = '✓ Correct!';
        fb.className = 'quiz-fb correct';
        if (selectedLabel) selectedLabel.classList.add('correct');
        score++;
      } else {
        fb.textContent = '✗ Incorrect';
        fb.className = 'quiz-fb incorrect';
        if (selectedLabel) selectedLabel.classList.add('incorrect');
        if (correctLabel) correctLabel.classList.add('correct');
      }
      answered++;
      if (answered === total && total > 0) {
        scormSetScore(Math.round((score / total) * 100));
      }
    }

    function completeCourse() {
      scormSetComplete();
      scormFinish();
      alert('Congratulations! You have completed the course.');
    }

    function clearHighlights() {
      var spans = document.querySelectorAll('.hl-sentence');
      for (var i = 0; i < spans.length; i++) {
        spans[i].className = 'hl-sentence';
      }
    }

    function highlightSentence(idx) {
      clearHighlights();
      if (!hlEnabled || idx < 0 || idx >= totalSentences) return;
      var el = document.querySelector('.hl-sentence[data-idx="' + idx + '"]');
      if (el) {
        el.className = 'hl-sentence active-' + hlPalette;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function setPalette(p) {
      hlPalette = p;
      var btns = document.querySelectorAll('.palette-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].getAttribute('data-palette') === p ? 'palette-btn active' : 'palette-btn';
      }
      // Re-apply current highlight
      var active = document.querySelector('.hl-sentence[class*="active-"]');
      if (active) {
        var idx = active.getAttribute('data-idx');
        highlightSentence(parseInt(idx));
      }
    }

    function toggleHighlight() {
      hlEnabled = !hlEnabled;
      var btn = document.getElementById('hlToggle');
      btn.textContent = hlEnabled ? 'On' : 'Off';
      btn.className = hlEnabled ? 'hl-toggle active' : 'hl-toggle';
      if (!hlEnabled) clearHighlights();
    }

    // Sync highlight with audio playback
    var audio = document.getElementById('moduleAudio');
    if (audio && totalSentences > 0) {
      audio.addEventListener('play', function() {
        function tick() {
          if (audio.paused || audio.ended) return;
          var progress = audio.currentTime / (audio.duration || 1);
          var sentIdx = Math.min(Math.floor(progress * totalSentences), totalSentences - 1);
          highlightSentence(sentIdx);
          animId = requestAnimationFrame(tick);
        }
        tick();
      });
      audio.addEventListener('pause', function() { cancelAnimationFrame(animId); });
      audio.addEventListener('ended', function() { cancelAnimationFrame(animId); clearHighlights(); });
      audio.addEventListener('seeked', function() {
        var progress = audio.currentTime / (audio.duration || 1);
        var sentIdx = Math.min(Math.floor(progress * totalSentences), totalSentences - 1);
        highlightSentence(sentIdx);
      });
    }

    function initAvatarNarrator(root) {
      var speechText = root.querySelector('[data-role="speech-text"]');
      var explainButton = root.querySelector('[data-action="explain"]');
      var stopButton = root.querySelector('[data-action="stop"]');
      var exampleButton = root.querySelector('[data-action="example"]');
      var pillButtons = root.querySelectorAll('.topic-pill');
      var abortController = null;
      var flushTimer = null;
      var queue = [];
      var requestToken = 0;
      var pendingMode = null;
      var hasCompletedInitial = false;

      function stopFlushLoop() {
        if (flushTimer !== null) {
          window.clearInterval(flushTimer);
          flushTimer = null;
        }
      }

      function setStreamingState(active) {
        if (active) {
          root.classList.add('is-streaming');
          root.scrollIntoView({ behavior: 'smooth', block: 'center' });
          stopButton.hidden = false;
          explainButton.disabled = true;
          exampleButton.disabled = true;
          return;
        }
        root.classList.remove('is-streaming');
        stopButton.hidden = true;
        explainButton.disabled = false;
        exampleButton.disabled = false;
      }

      function finalizeStream() {
        stopFlushLoop();
        setStreamingState(false);
        if (pendingMode === 'initial') {
          hasCompletedInitial = true;
          exampleButton.hidden = false;
        }
        pendingMode = null;
      }

      function startFlushLoop() {
        stopFlushLoop();
        flushTimer = window.setInterval(function() {
          var nextCharacter = queue.shift();
          if (typeof nextCharacter === 'string') {
            speechText.textContent += nextCharacter;
            return;
          }
          if (pendingMode) {
            finalizeStream();
          }
        }, 18);
      }

      function handleFailure(mode) {
        queue = [];
        pendingMode = null;
        stopFlushLoop();
        speechText.textContent = 'Here is the key point: ' + (root.getAttribute('data-module-content') || '');
        setStreamingState(false);
        if (mode === 'initial') {
          hasCompletedInitial = true;
          exampleButton.hidden = false;
        }
      }

      function selectTopic(button) {
        for (var i = 0; i < pillButtons.length; i++) {
          pillButtons[i].classList.remove('active');
        }
        button.classList.add('active');
        root.setAttribute('data-topic', button.getAttribute('data-topic') || '');
        root.setAttribute('data-module-content', button.getAttribute('data-module-content') || '');
        if (!root.classList.contains('is-streaming')) {
          speechText.textContent = '';
        }
      }

      async function runNarration(mode) {
        if (!avatarSupabaseUrl || !avatarSupabaseKey || root.classList.contains('is-streaming')) {
          if (!avatarSupabaseUrl || !avatarSupabaseKey) {
            handleFailure(mode);
          }
          return;
        }

        if (abortController) {
          abortController.abort();
        }

        abortController = new AbortController();
        requestToken += 1;
        var currentToken = requestToken;
        queue = [];
        pendingMode = null;
        speechText.textContent = '';
        setStreamingState(true);
        startFlushLoop();

        try {
          var response = await fetch(avatarSupabaseUrl + '/functions/v1/claude-avatar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: avatarSupabaseKey,
              Authorization: 'Bearer ' + avatarSupabaseKey,
            },
            body: JSON.stringify({
              topic: root.getAttribute('data-topic') || '',
              moduleContent: root.getAttribute('data-module-content') || '',
              systemHint: mode === 'initial' ? (root.getAttribute('data-system-hint') || '') : avatarExampleHint,
            }),
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error('Avatar narration failed with status ' + response.status);
          }

          var reader = response.body.getReader();
          var decoder = new TextDecoder();

          while (true) {
            var result = await reader.read();
            if (result.done) {
              if (currentToken === requestToken) {
                pendingMode = mode;
                if (queue.length === 0) {
                  finalizeStream();
                }
              }
              break;
            }

            if (currentToken !== requestToken) {
              reader.cancel();
              break;
            }

            var chunk = decoder.decode(result.value, { stream: true });
            if (chunk) {
              for (var index = 0; index < chunk.length; index++) {
                queue.push(chunk.charAt(index));
              }
            }
          }
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return;
          }
          if (currentToken === requestToken) {
            handleFailure(mode);
          }
        } finally {
          if (abortController && currentToken === requestToken) {
            abortController = null;
          }
        }
      }

      explainButton.addEventListener('click', function() { runNarration('initial'); });
      exampleButton.addEventListener('click', function() { runNarration('example'); });
      stopButton.addEventListener('click', function() {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        queue = [];
        pendingMode = null;
        stopFlushLoop();
        setStreamingState(false);
      });

      for (var i = 0; i < pillButtons.length; i++) {
        pillButtons[i].addEventListener('click', function(event) {
          selectTopic(event.currentTarget);
        });
      }

      if (pillButtons.length > 0) {
        selectTopic(root.querySelector('.topic-pill.active') || pillButtons[0]);
      } else if (!hasCompletedInitial) {
        exampleButton.hidden = true;
      }
    }

    var avatarNarrators = document.querySelectorAll('.avatar-narrator');
    for (var avatarIndex = 0; avatarIndex < avatarNarrators.length; avatarIndex++) {
      initAvatarNarrator(avatarNarrators[avatarIndex]);
    }
  <\/script>
</body>
</html>`;
}

/* ── Main export function ── */
export async function exportScormPackage(
  courseTitle: string,
  rawOutputs: RawAgentOutputs,
  options?: {
    includeVoice?: boolean;
    voiceId?: string;
    onProgress?: (message: string) => void;
  }
): Promise<void> {
  const zip = new JSZip();
  const includeVoice = options?.includeVoice ?? true;
  const voiceId = options?.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
  const onProgress = options?.onProgress || (() => {});

  // Parse course data
  const modules = parseModules(rawOutputs.architect);
  if (modules.length === 0) {
    throw new Error("No modules found in the course outline. Please generate the course first.");
  }

  const scriptMap = parseScript(rawOutputs.writer, modules, rawOutputs.visual);
  const allQuizzes = parseAssessment(rawOutputs.assessment);
  const voiceSections = parseVoiceSections(rawOutputs.voice);

  // Distribute quizzes across modules
  const quizzesPerModule = Math.max(1, Math.floor(allQuizzes.length / modules.length));

  // Generate TTS audio for each module if voice data exists
  const audioBase64Map = new Map<number, string>();

  if (includeVoice && voiceSections.length > 0) {
    onProgress("Generating voice narration...");
    for (let i = 0; i < modules.length; i++) {
      const section = voiceSections[i];
      if (!section?.narration_text) continue;

      onProgress(`Generating audio for Module ${i + 1}/${modules.length}: ${modules[i].title}`);
      try {
        const base64 = await generateTTSAudio(section.narration_text, voiceId);
        audioBase64Map.set(i, base64);
      } catch (err) {
        console.warn(`TTS failed for module ${i + 1}:`, err);
        onProgress(`⚠ Audio skipped for Module ${i + 1} (${(err as Error).message})`);
      }
    }
    onProgress(`Audio generated for ${audioBase64Map.size} of ${modules.length} modules`);
  }

  // Add SCORM manifest and required XSD schema files
  zip.file("imsmanifest.xml", buildManifest(courseTitle, modules));
  zip.file("imscp_rootv1p1p2.xsd", IMSCP_XSD);
  zip.file("adlcp_rootv1p2.xsd", ADLCP_XSD);
  zip.file("imsmd_rootv1p2p1.xsd", IMSMD_XSD);

  // Add module HTML pages
  modules.forEach((mod, i) => {
    const sections = scriptMap.get(mod.title) || [{
      heading: mod.topics[0] || mod.title,
      bodyMarkdown: `Content for ${mod.title}`,
      bodyHtml: `<p>${escapeHtml(`Content for ${mod.title}`)}</p>`,
      moduleContent: `Content for ${mod.title}`,
      keyTakeaway: "",
    }];
    const startQ = i * quizzesPerModule;
    const modQuizzes = allQuizzes.slice(startQ, startQ + quizzesPerModule);
    const audioBase64 = audioBase64Map.get(i) || null;
    const narrationText = voiceSections[i]?.narration_text || "";
    const html = buildModuleHtml(courseTitle, mod, i, modules.length, sections, modQuizzes, audioBase64, narrationText);
    zip.file(`module_${i + 1}.html`, html);
  });

  onProgress("Packaging SCORM ZIP...");

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = courseTitle.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  saveAs(blob, `${safeName}_SCORM.zip`);
}

export const __scormTestUtils = {
  parseModules,
  parseScript,
  buildModuleHtml,
};
