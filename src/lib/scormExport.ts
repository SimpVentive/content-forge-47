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

interface Module { title: string; topics: string[]; }

function parseModules(archRaw: string): Module[] {
  const data = tryParseJSON(archRaw);
  if (data?.modules) return data.modules.map((m: any) => ({ title: String(m.title || m.module_title || ""), topics: (m.topics || m.sections || []).map((t: any) => typeof t === "string" ? t : t.title || t.topic || t.name || JSON.stringify(t)) }));
  const modules: Module[] = [];
  const lines = archRaw.split("\n");
  let cur: Module | null = null;
  for (const line of lines) {
    const mm = line.match(/^#+\s*(?:Module\s*\d+[:.]\s*)?(.+)/i) || line.match(/^\*\*(?:Module\s*\d+[:.]\s*)?(.+?)\*\*/i);
    if (mm) { if (cur) modules.push(cur); cur = { title: mm[1].trim(), topics: [] }; }
    else if (cur && line.match(/^[-*]\s+(.+)/)) { cur.topics.push(line.replace(/^[-*]\s+/, "").trim()); }
  }
  if (cur) modules.push(cur);
  return modules;
}

function parseScript(writerRaw: string, modules: Module[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!writerRaw) return map;
  const sections = writerRaw.split(/(?=(?:Module|Section|Topic)\s*\d)/i);
  modules.forEach((mod, i) => {
    const sec = sections[i + 1] || sections[i] || "";
    const paragraphs = sec.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    map.set(mod.title, paragraphs.length > 0 ? paragraphs : ["Content for " + mod.title]);
  });
  return map;
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

/* ── SCORM 1.2 XSD schema stubs (required by most LMS validators) ── */
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
    <resource identifier="RES_API" type="webcontent" adlcp:scormType="asset" href="scorm_api.js">
      <file href="scorm_api.js"/>
    </resource>
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
  paragraphs: string[],
  quizzes: { question: string; options: string[]; correct: number }[]
): string {
  const contentHtml = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join("\n        ");

  const quizHtml = quizzes.length > 0 ? `
      <div class="quiz-section">
        <h2>Knowledge Check</h2>
        ${quizzes.map((q, qi) => `
        <div class="quiz-item" id="q${qi}">
          <p class="quiz-q"><strong>Q${qi + 1}.</strong> ${escapeHtml(q.question)}</p>
          ${q.options.map((opt, oi) => `
          <label class="quiz-opt">
            <input type="radio" name="q${qi}" value="${oi}" onchange="checkAnswer(${qi},${oi},${q.correct})"/>
            ${escapeHtml(typeof opt === "string" ? opt : String(opt))}
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(mod.title)} - ${escapeHtml(courseTitle)}</title>
  <script src="scorm_api.js"><\/script>
  <style>
    :root { --primary: #4f46e5; --bg: #f8f9fc; --card: #fff; --text: #1e1b4b; --muted: #64748b; --border: #e2e8f0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 32px 40px; }
    .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
    .header .meta { font-size: 13px; opacity: 0.85; }
    .progress-bar { height: 4px; background: rgba(255,255,255,0.25); }
    .progress-fill { height: 100%; background: #fbbf24; transition: width 0.3s; }
    .container { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
    .topics { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 24px; }
    .topic-chip { background: var(--primary); color: #fff; font-size: 12px; font-weight: 600; padding: 4px 14px; border-radius: 999px; }
    .content p { margin-bottom: 16px; font-size: 15px; }
    .quiz-section { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-top: 32px; }
    .quiz-section h2 { font-size: 18px; margin-bottom: 16px; color: var(--primary); }
    .quiz-item { margin-bottom: 20px; }
    .quiz-q { margin-bottom: 8px; font-size: 14px; }
    .quiz-opt { display: block; padding: 8px 12px; margin: 4px 0; border-radius: 10px; cursor: pointer; font-size: 14px; border: 1px solid var(--border); transition: background 0.2s; }
    .quiz-opt:hover { background: #f1f0ff; }
    .quiz-fb { margin-top: 6px; font-size: 13px; font-weight: 600; min-height: 20px; }
    .quiz-fb.correct { color: #059669; }
    .quiz-fb.incorrect { color: #dc2626; }
    .nav { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); }
    .nav-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; color: var(--primary); border: 2px solid var(--primary); background: transparent; cursor: pointer; transition: all 0.2s; }
    .nav-btn:hover { background: var(--primary); color: #fff; }
    .complete-btn { background: var(--primary); color: #fff; border-color: var(--primary); }
  </style>
</head>
<body onload="scormInit()">
  <div class="header">
    <div class="meta">${escapeHtml(courseTitle)}</div>
    <h1>Module ${moduleIndex + 1}: ${escapeHtml(mod.title)}</h1>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(((moduleIndex + 1) / totalModules) * 100)}%"></div></div>
  </div>
  <div class="container">
    <div class="topics">
      ${mod.topics.map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join("\n      ")}
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    ${quizHtml}
    <div class="nav">
      ${navPrev}
      ${navNext}
    </div>
  </div>
  <script>
    var score = 0, total = ${quizzes.length}, answered = 0;
    function checkAnswer(qi, selected, correct) {
      var fb = document.getElementById('fb' + qi);
      if (selected === correct) {
        fb.textContent = '✓ Correct!';
        fb.className = 'quiz-fb correct';
        score++;
      } else {
        fb.textContent = '✗ Incorrect';
        fb.className = 'quiz-fb incorrect';
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
  <\/script>
</body>
</html>`;
}

/* ── Main export function ── */
export async function exportScormPackage(
  courseTitle: string,
  rawOutputs: RawAgentOutputs
): Promise<void> {
  const zip = new JSZip();

  // Parse course data
  const modules = parseModules(rawOutputs.architect);
  if (modules.length === 0) {
    throw new Error("No modules found in the course outline. Please generate the course first.");
  }

  const scriptMap = parseScript(rawOutputs.writer, modules);
  const allQuizzes = parseAssessment(rawOutputs.assessment);

  // Distribute quizzes across modules (roughly even)
  const quizzesPerModule = Math.max(1, Math.floor(allQuizzes.length / modules.length));

  // Add SCORM manifest
  zip.file("imsmanifest.xml", buildManifest(courseTitle, modules));

  // Add SCORM API
  zip.file("scorm_api.js", SCORM_API_JS);

  // Add module HTML pages
  modules.forEach((mod, i) => {
    const paragraphs = scriptMap.get(mod.title) || ["Content for " + mod.title];
    const startQ = i * quizzesPerModule;
    const modQuizzes = allQuizzes.slice(startQ, startQ + quizzesPerModule);
    const html = buildModuleHtml(courseTitle, mod, i, modules.length, paragraphs, modQuizzes);
    zip.file(`module_${i + 1}.html`, html);
  });

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = courseTitle.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  saveAs(blob, `${safeName}_SCORM.zip`);
}
