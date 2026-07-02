/**
 * Professional Flipbook Generator with StPageFlip
 * Generates high-quality interactive flipbooks with realistic 3D page-turn animations
 */

import type { TopicNarrative } from "@/lib/visualNarrativeService";

export interface FlipbookPage {
  title?: string;
  content: string;
  htmlContent?: string;
  images?: string[];
  speaker?: string;
  audioDataUrl?: string;
  pageNumber: number;
}

export function generateFlipbookHTML(
  narratives: TopicNarrative[],
  courseTitle: string,
  displayStyle: "page-flip" | "smooth-slide" | "step-reveal" = "page-flip",
  voiceoverEnabled: boolean = false,
  voiceoverPace?: "slow" | "normal" | "fast",
  assessmentRaw?: string,
  companyLogoDataUrl?: string | null,
  passThreshold: number = 70,
  courseLevel: string = "Intermediate",
  captionsEnabled: boolean = true
): string {
  // Parse assessment if provided
  let assessmentData: any = null;
  if (assessmentRaw) {
    try {
      assessmentData = JSON.parse(assessmentRaw);
    } catch (e) {
      // Try to extract JSON from code fences
      const match = assessmentRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          assessmentData = JSON.parse(match[1].trim());
        } catch (e2) {
          console.warn("Could not parse assessment data");
        }
      }
    }
  }

  // Pick the first available scene image to use as the cover hero image
  const firstSceneImage = narratives
    .flatMap((n) => n.scenes)
    .find((s) => !!s.imageDataUrl)?.imageDataUrl;

  // Add a title page at the beginning (with a relevant hero image)
  const pages: FlipbookPage[] = [
    {
      title: courseTitle,
      content: `Professional Learning Guide\nCourse Level: ${courseLevel}`,
      images: firstSceneImage ? [firstSceneImage] : [],
      speaker: "",
      pageNumber: 0,
    },
  ];

  // Add module overview page
  if (narratives.length > 0) {
    const topicsList = narratives
      .flatMap(n => [n.topicTitle, ...n.scenes.map(s => `  • ${s.title}`)])
      .join("\n");

    const totalScenes = narratives.reduce((sum, n) => sum + n.scenes.length, 0);
    const estimatedMinutes = Math.ceil(totalScenes * 1.5); // ~1.5 min per scene average

    // Build assessment details
    let assessmentDetails = "Assessment: This module includes";
    if (assessmentData) {
      const mcqCount = (assessmentData.mcq || []).length;
      const scenarioCount = (assessmentData.scenarios || []).length;
      const hasReflection = !!assessmentData.reflection;

      const assessmentParts = [];
      if (mcqCount > 0) assessmentParts.push(`${mcqCount} Multiple Choice Questions`);
      if (scenarioCount > 0) assessmentParts.push(`${scenarioCount} Scenario-based Questions`);
      if (hasReflection) assessmentParts.push("1 Reflection Exercise");

      if (assessmentParts.length > 0) {
        assessmentDetails += ` ${assessmentParts.join(", ")}`;
      } else {
        assessmentDetails += " comprehensive assessment questions";
      }
    } else {
      assessmentDetails += " comprehensive assessment questions";
    }

    const objectives = narratives
      .map(n => (n.topicObjective || "").trim())
      .filter(Boolean)
      .slice(0, 6);
    const topicTitles = narratives.map(n => n.topicTitle).filter(Boolean);

    const assessmentItems: string[] = [];
    if (assessmentData) {
      const mcqCount = (assessmentData.mcq || []).length;
      const scenarioCount = (assessmentData.scenarios || []).length;
      const hasReflection = !!assessmentData.reflection;
      if (mcqCount > 0) assessmentItems.push(`${mcqCount} Multiple Choice Question${mcqCount > 1 ? "s" : ""}`);
      if (scenarioCount > 0) assessmentItems.push(`${scenarioCount} Scenario-based Question${scenarioCount > 1 ? "s" : ""}`);
      if (hasReflection) assessmentItems.push(`1 Reflection Exercise`);
    }

    const overviewHtml = `
      <div class="overview-block">
        <div class="overview-row">
          <div class="overview-label">Course Objective:</div>
          <div class="overview-value">
            <div class="overview-lead">The following are the objectives of this course</div>
            <ul class="overview-list">
              ${(objectives.length ? objectives : ["Master key concepts"]).map(o => `<li>${escapeHtml(o)}</li>`).join("")}
            </ul>
          </div>
        </div>
        <div class="overview-row">
          <div class="overview-label">Course Content:</div>
          <div class="overview-value">
            <div class="overview-lead">The course will cover the following topics</div>
            <ul class="overview-list">
              ${topicTitles.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>
            <div class="overview-meta">Duration: Approximately ${estimatedMinutes} minutes</div>
          </div>
        </div>
        <div class="overview-row">
          <div class="overview-label">Assessment:</div>
          <div class="overview-value">
            <div class="overview-lead">Following are the assessments mapped to this course. You will have to successfully complete them to complete the course</div>
            ${assessmentItems.length ? `<ul class="overview-list">${assessmentItems.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : `<div class="overview-lead">${escapeHtml(assessmentDetails)}</div>`}
          </div>
        </div>
        ${voiceoverEnabled ? `
        <div class="overview-row">
          <div class="overview-label">Audio Narration:</div>
          <div class="overview-value">
            <div class="overview-lead">Choose whether narration audio plays automatically throughout the course. Your choice will apply to every slide.</div>
            <div class="audio-toggle-group" role="radiogroup" aria-label="Audio narration">
              <button type="button" class="audio-toggle-btn active" data-audio-toggle="on" onclick="window.__setAudioEnabled&&window.__setAudioEnabled(true)">🔊 Audio On</button>
              <button type="button" class="audio-toggle-btn" data-audio-toggle="off" onclick="window.__setAudioEnabled&&window.__setAudioEnabled(false)">🔇 Audio Off</button>
            </div>
          </div>
        </div>
        ` : ""}
      </div>
    `;

    pages.push({
      title: "Course Overview",
      content: "",
      htmlContent: overviewHtml,
      images: [],
      speaker: "",
      pageNumber: 1,
    });
  }

  // Convert narratives to flipbook pages with narration support
  let firstImageSkipped = false;
  const contentPages = narratives.flatMap((narrative, topicIdx) =>
    narrative.scenes.map((scene, sceneIdx) => {
      // Skip the very first scene's image because we already show it on the cover
      let images: string[] = scene.imageDataUrl ? [scene.imageDataUrl] : [];
      if (!firstImageSkipped && scene.imageDataUrl && scene.imageDataUrl === firstSceneImage) {
        images = [];
        firstImageSkipped = true;
      }
      return {
        title: scene.title,
        // Only include caption if captionsEnabled is true
        content: captionsEnabled ? (scene.caption || "") : "",
        images,
        speaker: voiceoverEnabled && scene.narration ? scene.narration : "",
        audioDataUrl: voiceoverEnabled && scene.audioDataUrl ? scene.audioDataUrl : undefined,
        pageNumber: (topicIdx + 1) * 10 + sceneIdx + 2,
      };
    })
  );

  pages.push(...contentPages);

  // Remove Page 3 (index 3 - the 4th page: title, overview, first content, second content to remove)
  if (pages.length > 3) {
    pages.splice(3, 1);
  }

  // Add assessment pages if available
  if (assessmentData) {
    let assessmentPageNum = Math.max(...pages.map(p => p.pageNumber || 0)) + 1;

    // Add MCQ questions
    if (Array.isArray(assessmentData.mcq)) {
      assessmentData.mcq.slice(0, 10).forEach((q: any, qIdx: number) => {
        const questionText = q.question || "";
        const correctRaw = String(q.correct_answer || "").trim();
        const stripPrefix = (s: string) => s.replace(/^\s*[A-Da-d][\.\)]\s*/, "").replace(/^\s*[-•]\s*/, "").trim();
        const correctClean = stripPrefix(correctRaw);
        const options: string[] = Array.isArray(q.options) ? q.options : [];
        const optionsHtml = options.map((opt, oi) => {
          const optClean = stripPrefix(String(opt));
          const letter = String.fromCharCode(65 + oi);
          const isCorrect = optClean === correctClean || String(opt) === correctRaw || letter === correctRaw || correctRaw.includes(optClean);
          return `<button type="button" class="mcq-option" data-correct="${isCorrect ? "1" : "0"}" onclick="window.__mcqAnswer&&window.__mcqAnswer(this)"><span class="mcq-letter">${letter}</span><span class="mcq-text">${escapeHtml(optClean)}</span><span class="mcq-icon"></span></button>`;
        }).join("");
        const html = `
          <div class="mcq-question">${escapeHtml(questionText)}</div>
          <div class="mcq-options">${optionsHtml}</div>
          <div class="mcq-feedback" data-correct-text="${escapeHtml(correctRaw)}"></div>
        `;
        pages.push({
          title: `Q${qIdx + 1}`,
          content: "",
          htmlContent: html,
          images: [],
          speaker: "",
          pageNumber: assessmentPageNum++,
        });
      });
    }

    // Add scenario questions
    if (Array.isArray(assessmentData.scenarios)) {
      assessmentData.scenarios.slice(0, 5).forEach((s: any, sIdx: number) => {
        const situation = s.situation || "";
        const correctRaw = String(s.best_response || "").trim();
        const stripPrefix = (str: string) => str.replace(/^\s*[A-Da-d][\.\)]\s*/, "").replace(/^\s*[-•]\s*/, "").trim();
        const correctClean = stripPrefix(correctRaw);
        const options: string[] = Array.isArray(s.options) ? s.options : [];
        const optionsHtml = options.map((opt, oi) => {
          const optClean = stripPrefix(String(opt));
          const letter = String.fromCharCode(65 + oi);
          const isCorrect = optClean === correctClean || String(opt) === correctRaw || letter === correctRaw || correctRaw.includes(optClean);
          return `<button type="button" class="mcq-option" data-correct="${isCorrect ? "1" : "0"}" onclick="window.__mcqAnswer&&window.__mcqAnswer(this)"><span class="mcq-letter">${letter}</span><span class="mcq-text">${escapeHtml(optClean)}</span><span class="mcq-icon"></span></button>`;
        }).join("");
        const html = `
          <div class="mcq-question">${escapeHtml(situation)}</div>
          <div class="mcq-options">${optionsHtml}</div>
          <div class="mcq-feedback" data-correct-text="${escapeHtml(correctRaw)}"></div>
        `;
        pages.push({
          title: `Scenario ${sIdx + 1}`,
          content: "",
          htmlContent: html,
          images: [],
          speaker: "",
          pageNumber: assessmentPageNum++,
        });
      });
    }

    // Add reflection exercise
    if (assessmentData.reflection) {
      const reflectionHtml = `
        <div class="reflection-prompt">
          ${escapeHtml(assessmentData.reflection.prompt || "")}
        </div>
        <textarea class="reflection-input" placeholder="Type your response here..."></textarea>
        ${assessmentData.reflection.guidance ? `
        <div class="reflection-guidance">
          <div class="reflection-guidance-label">Guidance:</div>
          <div class="reflection-guidance-text">${escapeHtml(assessmentData.reflection.guidance)}</div>
        </div>
        ` : ""}
      `;
      pages.push({
        title: "Reflection Exercise",
        content: "",
        htmlContent: reflectionHtml,
        images: [],
        speaker: "",
        pageNumber: assessmentPageNum++,
      });
    }

    // Add results page if there are MCQ questions
    if (Array.isArray(assessmentData.mcq) && assessmentData.mcq.length > 0) {
      const totalMCQ = Math.min(assessmentData.mcq.length, 10);
      const resultsHtml = `
        <div class="results-container">
          <div class="results-score">
            <div class="results-number" id="results-score-number">0</div>
            <div class="results-label">Correct Answers</div>
          </div>

          <div class="results-progress">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="results-progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">
              <span id="results-percentage">0</span>%
            </div>
          </div>

          <div class="results-message" id="results-message">
            <div class="results-status" id="results-status"></div>
            <p class="results-description" id="results-description"></p>
          </div>

          <div class="results-stats">
            <div class="stat-row">
              <span class="stat-label">Questions Answered:</span>
              <span class="stat-value">${totalMCQ}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Passing Score:</span>
              <span class="stat-value">${passThreshold}%</span>
            </div>
          </div>
        </div>
      `;

      pages.push({
        title: "Assessment Results",
        content: "",
        htmlContent: resultsHtml,
        images: [],
        speaker: "",
        pageNumber: assessmentPageNum++,
      });
    }
  }

  const pagesHTML = pages
    .map(
      (page, idx) => `
    <div class="page">
      <div class="page-inner">
        ${companyLogoDataUrl && idx === 0 ? `<img src="${companyLogoDataUrl}" alt="Company logo" class="logo-first-page" />` : ""}
        ${page.title ? `<h1 class="page-title">${escapeHtml(page.title)}</h1>` : ""}
        <div class="page-content">
          ${page.images ? page.images.map((img) => `<img src="${img}" alt="Page content" class="page-image" />`).join("") : ""}
          ${page.htmlContent ? `<div class="page-text page-text-html">${page.htmlContent}</div>` : (page.content ? `<div class="page-text">${escapeHtml(page.content)}</div>` : "")}
        </div>
        ${voiceoverEnabled && page.speaker ? `
        <div class="page-narration-section">
          <div class="narration-label">Narrator:</div>
          <div class="narration-text">${escapeHtml(page.speaker)}</div>
          ${page.audioDataUrl ? `
            <div class="audio-player-container">
              <audio class="audio-player" controls preload="metadata">
                <source src="${page.audioDataUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
              </audio>
            </div>
          ` : ""}
        </div>
        ` : ""}
        ${companyLogoDataUrl && idx > 0 ? `<div style="margin-top: 10px;"><img src="${companyLogoDataUrl}" alt="Company logo" class="logo-footer" /></div>` : ""}
      </div>
    </div>
  `
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(courseTitle)} - Professional Flipbook</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .flipbook-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
    }

    .flipbook-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      text-align: center;
      z-index: 100;
    }

    .flipbook-header h1 {
      font-size: 22px;
      margin: 0;
    }

    .flipbook-canvas {
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1;
      background: #f5f5f5;
      overflow: hidden;
      padding: 20px;
      position: relative;
    }

    #flipbook {
      width: 100%;
      height: 100%;
      max-width: 1200px;
      max-height: 800px;
      background: white;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      border-radius: 8px;
    }

    .page {
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .page-inner {
      padding: 40px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 8px;
      overflow-y: auto;
    }

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      text-align: center;
      margin: 0;
      flex-shrink: 0;
    }

    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0px;
      width: 100%;
    }

    .page-image {
      width: 100%;
      height: auto;
      max-height: 70%;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      flex-shrink: 0;
    }

    .page-text {
      font-size: 16px;
      line-height: 1.6;
      color: #333;
      text-align: center;
      flex-shrink: 0;
      margin-top: 0px;
      margin-bottom: 0px;
      padding-top: 0px;
      border-top: none;
      width: 100%;
      font-weight: 500;
      white-space: pre-line;
    }

    .page:first-child .page-text {
      font-size: 16px;
      line-height: 1.3;
      margin-top: 4px;
      gap: 0;
    }

    .page:first-child .page-text::before {
      content: '';
      display: block;
      height: 0;
    }

    .logo-first-page {
      width: 180px;
      height: 180px;
      object-fit: contain;
      margin: 0 auto 20px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .logo-footer {
      width: 60px;
      height: 60px;
      object-fit: contain;
      border-radius: 4px;
      opacity: 0.8;
      flex-shrink: 0;
    }

    .page-narration-section {
      margin-top: 4px;
      margin-bottom: 0px;
      padding: 12px;
      background: #f0f4ff;
      border-left: 4px solid #667eea;
      border-radius: 4px;
      flex-shrink: 0;
      width: 100%;
    }

    .audio-player-container {
      margin-bottom: 10px;
      width: 100%;
    }

    .audio-player {
      width: 100%;
      height: 32px;
      border-radius: 4px;
      background: white;
    }

    .narration-label {
      font-size: 12px;
      font-weight: 700;
      color: #667eea;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      margin-top: 8px;
    }

    .narration-text {
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      font-style: italic;
    }

    .audio-toggle-group {
      display: inline-flex;
      gap: 10px;
      margin-top: 10px;
    }
    .audio-toggle-btn {
      padding: 10px 20px;
      border: 2px solid #cbd5e1;
      background: #fff;
      color: #334155;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .audio-toggle-btn:hover { border-color: #667eea; color: #667eea; }
    .audio-toggle-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);

    .flipbook-controls {
      background: white;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      border-top: 1px solid #eee;
      flex-wrap: wrap;
      z-index: 100;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
      border: 2px solid #ddd;
    }

    .btn-secondary:hover {
      background: #e8e8e8;
      border-color: #667eea;
    }

    .page-info {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      min-width: 120px;
      text-align: center;
    }

    @media (max-width: 768px) {
      #flipbook {
        max-width: 95%;
        max-height: 95%;
      }

      .page-inner {
        padding: 30px;
      }

      .page-title {
        font-size: 20px;
      }

      .page-text {
        font-size: 14px;
      }

      .flipbook-controls {
        flex-direction: column;
        gap: 10px;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }

      .page-info {
        width: 100%;
      }
    }

    @media print {
      .flipbook-header,
      .flipbook-controls {
        display: none;
      }

      .flipbook-canvas {
        background: white;
      }

      #flipbook {
        box-shadow: none;
      }

      .page {
        page-break-after: always;
      }
    }
    .page-text-html { text-align: left !important; }
    .overview-block { display: flex; flex-direction: column; gap: 28px; padding: 8px 12px; }
    .overview-row { display: grid; grid-template-columns: 180px 1fr; gap: 24px; align-items: start; }
    .overview-label { font-size: 15px; font-weight: 700; color: #0f172a; padding-top: 2px; }
    .overview-value { font-size: 15px; color: #1f2937; line-height: 1.55; }
    .overview-lead { margin-bottom: 8px; }
    .overview-list { list-style: disc; padding-left: 22px; margin: 6px 0 0; }
    .overview-list li { margin: 4px 0; }
    .overview-meta { margin-top: 10px; font-style: italic; color: #475569; }
    @media (max-width: 640px) {
      .overview-row { grid-template-columns: 1fr; gap: 6px; }
    }
    .mcq-question {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 4px 0 16px;
      line-height: 1.5;
      text-align: left;
    }
    .mcq-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }
    .mcq-option {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      background: #fff;
      border-radius: 10px;
      font-size: 15px;
      color: #0f172a;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .mcq-option:hover:not(.answered) { border-color: #94a3b8; background: #f8fafc; }
    .mcq-letter {
      flex-shrink: 0;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #475569;
      display: inline-flex;
      align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
    }
    .mcq-text { flex: 1; }
    .mcq-icon { flex-shrink: 0; font-weight: 700; font-size: 18px; }
    .mcq-option.correct { border-color: #10b981; background: #ecfdf5; color: #065f46; }
    .mcq-option.correct .mcq-letter { background: #10b981; color: #fff; }
    .mcq-option.correct .mcq-icon::before { content: "✓"; color: #10b981; }
    .mcq-option.incorrect { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
    .mcq-option.incorrect .mcq-letter { background: #ef4444; color: #fff; }
    .mcq-option.incorrect .mcq-icon::before { content: "✕"; color: #ef4444; }
    .mcq-option.answered { cursor: default; }
    .mcq-option.answered:not(.correct):not(.incorrect) { opacity: 0.55; }
    .mcq-feedback { margin-top: 14px; font-size: 14px; font-weight: 600; }
    .mcq-feedback.correct { color: #065f46; }
    .mcq-feedback.incorrect { color: #991b1b; }

    .reflection-prompt {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 20px;
      line-height: 1.6;
      text-align: left !important;
    }

    .reflection-input {
      width: 100%;
      min-height: 160px;
      padding: 14px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      color: #0f172a;
      line-height: 1.5;
      box-sizing: border-box;
      margin-bottom: 20px;
      text-align: left;
    }

    .reflection-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .reflection-guidance {
      padding: 14px;
      background: #f8fafc;
      border-left: 4px solid #94a3b8;
      border-radius: 4px;
      margin-top: 16px;
      text-align: left;
    }

    .reflection-guidance-label {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      text-align: left;
    }

    .reflection-guidance-text {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      text-align: left !important;
    }

    .mcq-score-badge {
      display: inline-block;
      padding: 6px 12px;
      background: #3b82f6;
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      min-width: 60px;
      text-align: center;
    }

    .mcq-score-badge.perfect {
      background: #10b981;
    }

    .mcq-score-badge.partial {
      background: #f59e0b;
    }

    .results-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 24px;
      text-align: center;
    }

    .results-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .results-number {
      font-size: 64px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .results-label {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .results-progress {
      width: 100%;
      max-width: 400px;
    }

    .progress-bar-bg {
      width: 100%;
      height: 12px;
      background: #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #667eea 100%);
      border-radius: 6px;
      transition: width 0.8s ease-out;
    }

    .progress-text {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
    }

    .results-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px;
      border-radius: 12px;
      width: 100%;
      max-width: 400px;
    }

    .results-message.passed {
      background: #ecfdf5;
      border: 2px solid #10b981;
    }

    .results-message.failed {
      background: #fef2f2;
      border: 2px solid #ef4444;
    }

    .results-status {
      font-size: 24px;
      font-weight: 700;
    }

    .results-message.passed .results-status {
      color: #065f46;
    }

    .results-message.failed .results-status {
      color: #991b1b;
    }

    .results-description {
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
    }

    .results-message.passed .results-description {
      color: #047857;
    }

    .results-message.failed .results-description {
      color: #7f1d1d;
    }

    .results-stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      width: 100%;
      max-width: 400px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }

    .stat-label {
      font-weight: 600;
      color: #475569;
    }

    .stat-value {
      font-weight: 700;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="flipbook-container">
    <div class="flipbook-header">
      <h1>${escapeHtml(courseTitle)}</h1>
    </div>

    <div class="flipbook-canvas">
      <div id="flipbook">
        ${pagesHTML}
      </div>
    </div>

    <div class="flipbook-controls">
      <button class="btn btn-primary" id="prevBtn">&larr; Previous</button>
      <div class="page-info">
        Page <span id="currentPage">1</span> of <span id="totalPages">${pages.length}</span>
        ${assessmentData && assessmentData.mcq && assessmentData.mcq.length > 0 ? `<span class="mcq-score-badge" id="mcq-score-display">0/${assessmentData.mcq.length}</span>` : ''}
      </div>
      <button class="btn btn-primary" id="nextBtn">Next &rarr;</button>
      <button class="btn btn-secondary" id="fullscreenBtn">Fullscreen</button>
      <button class="btn btn-secondary" id="printBtn">Print</button>
    </div>
  </div>

  <!-- StPageFlip Library -->
  <script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"><\/script>

  <script>
    // MCQ Score Tracking
    window.__mcqScore = { correct: 0, total: 0 };

    function updateScoreDisplay() {
      var scoreEl = document.getElementById('mcq-score-display');
      if (scoreEl) {
        scoreEl.textContent = window.__mcqScore.correct + '/' + window.__mcqScore.total;
      }
      // Also persist to session storage
      sessionStorage.setItem('mcqScore', JSON.stringify(window.__mcqScore));
      // Update results page if visible
      updateResultsPage(${passThreshold});
    }

    window.__mcqAnswer = function(btn) {
      var container = btn.parentElement;
      if (!container || container.dataset.locked === '1') return;
      container.dataset.locked = '1';
      var isCorrect = btn.getAttribute('data-correct') === '1';

      // Update score
      window.__mcqScore.total += 1;
      if (isCorrect) {
        window.__mcqScore.correct += 1;
      }
      updateScoreDisplay();

      btn.classList.add(isCorrect ? 'correct' : 'incorrect');
      Array.prototype.forEach.call(container.querySelectorAll('.mcq-option'), function(o){
        o.classList.add('answered');
        if (o !== btn && o.getAttribute('data-correct') === '1') {
          o.classList.add('correct');
        }
      });
      var feedback = container.parentElement && container.parentElement.querySelector('.mcq-feedback');
      if (feedback) {
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        feedback.textContent = isCorrect
          ? 'Correct!'
          : 'Incorrect. Correct answer: ' + (feedback.getAttribute('data-correct-text') || '');
      }
    };

    // Update results page with score
    function updateResultsPage(passThreshold) {
      var totalCorrect = window.__mcqScore.correct;
      var totalQuestions = window.__mcqScore.total;
      if (totalQuestions === 0) return;

      var percentage = Math.round((totalCorrect / totalQuestions) * 100);
      var passed = percentage >= passThreshold;

      // Update score number
      var scoreNumber = document.getElementById('results-score-number');
      if (scoreNumber) {
        scoreNumber.textContent = totalCorrect + '/' + totalQuestions;
      }

      // Update progress bar
      var progressFill = document.getElementById('results-progress-fill');
      if (progressFill) {
        setTimeout(function() {
          progressFill.style.width = percentage + '%';
        }, 100);
      }

      // Update percentage
      var percentageEl = document.getElementById('results-percentage');
      if (percentageEl) {
        percentageEl.textContent = percentage;
      }

      // Update message
      var messageEl = document.getElementById('results-message');
      if (messageEl) {
        messageEl.classList.add(passed ? 'passed' : 'failed');

        var statusEl = document.getElementById('results-status');
        if (statusEl) {
          statusEl.textContent = passed ? '✓ Passed' : '✗ Did Not Pass';
        }

        var descEl = document.getElementById('results-description');
        if (descEl) {
          if (passed) {
            descEl.textContent = 'Congratulations! You achieved ' + percentage + '% and passed the assessment.';
          } else {
            var needed = passThreshold - percentage;
            descEl.textContent = 'You scored ' + percentage + '%. You need ' + needed + '% more to pass.';
          }
        }
      }
    }

    // Restore MCQ score from session storage
    function restoreMCQScore() {
      var stored = sessionStorage.getItem('mcqScore');
      if (stored) {
        try {
          window.__mcqScore = JSON.parse(stored);
          updateScoreDisplay();
          updateResultsPage(${passThreshold});
        } catch (e) {
          console.warn('Could not restore MCQ score:', e);
        }
      }
    }

    // Save and restore reflection exercise responses
    window.__reflectionResponses = {};

    function saveReflectionResponses() {
      var textareas = document.querySelectorAll('.reflection-input');
      textareas.forEach(function(textarea, idx) {
        window.__reflectionResponses['reflection_' + idx] = textarea.value;
      });
      sessionStorage.setItem('reflectionResponses', JSON.stringify(window.__reflectionResponses));
    }

    function restoreReflectionResponses() {
      var stored = sessionStorage.getItem('reflectionResponses');
      if (stored) {
        window.__reflectionResponses = JSON.parse(stored);
        var textareas = document.querySelectorAll('.reflection-input');
        textareas.forEach(function(textarea, idx) {
          var saved = window.__reflectionResponses['reflection_' + idx];
          if (saved) textarea.value = saved;
        });
      }
    }

    // Save on input
    document.addEventListener('input', function(e) {
      if (e.target.classList.contains('reflection-input')) {
        saveReflectionResponses();
      }
    });
  </script>
  <script>
    var pageFlip = null;
    var totalPages = ${pages.length};

    // Initialize StPageFlip after DOM and library are ready
    window.addEventListener('DOMContentLoaded', function () {
      try {
        var PageFlipCtor = (window.St && window.St.PageFlip) || (window.pageFlip && window.pageFlip.PageFlip) || window.PageFlip;
        if (!PageFlipCtor) { throw new Error('PageFlip library not loaded'); }
        pageFlip = new PageFlipCtor(
          document.getElementById('flipbook'),
          {
            width: 600,
            height: 800,
            size: 'fixed',
            minWidth: 300,
            maxWidth: 1000,
            minHeight: 400,
            maxHeight: 1200,
            showCover: true,
            mobileScrollSupport: true,
            useMouseEvents: true,
            swipeDistance: 10,
            clickEventshadow: [
              -0.5, -0.5,
              0.5, -0.5,
              0.5, 0.5,
              -0.5, 0.5
            ],
            backgroundColor: '#f5f5f5',
            maxShadowBlur: 20,
            darkMode: false,
            disableFlip: false,
            disableZoom: false,
            autoSize: true
          }
        );

        // Add pages to the flipbook
        var pageElements = document.querySelectorAll('#flipbook .page');
        pageFlip.loadFromElements(Array.from(pageElements));

        // Global audio-enabled flag, persisted via localStorage. Default: ON.
        try {
          var stored = localStorage.getItem('flipbookAudioEnabled');
          window.__audioEnabled = stored === null ? true : stored === 'true';
        } catch (e) { window.__audioEnabled = true; }

        function applyAudioVisibility() {
          var sections = document.querySelectorAll('.audio-player-container');
          sections.forEach(function (sec) {
            sec.style.display = window.__audioEnabled ? '' : 'none';
          });
          var btns = document.querySelectorAll('[data-audio-toggle]');
          btns.forEach(function (b) {
            var on = b.getAttribute('data-audio-toggle') === 'on';
            if ((on && window.__audioEnabled) || (!on && !window.__audioEnabled)) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        }

        window.__setAudioEnabled = function (enabled) {
          window.__audioEnabled = !!enabled;
          try { localStorage.setItem('flipbookAudioEnabled', String(window.__audioEnabled)); } catch (e) {}
          applyAudioVisibility();
          if (!window.__audioEnabled) stopAllAudio();
          else playCurrentPageAudio();
        };

        // Stop all audio playback and reset audio elements
        function stopAllAudio() {
          var audioElements = document.querySelectorAll('.audio-player');
          audioElements.forEach(function (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
            audioEl.load();
          });
        }

        // Auto-play the current visible page's audio (if any) when audio is enabled
        function playCurrentPageAudio() {
          if (!window.__audioEnabled) return;
          try {
            var idx = pageFlip.getCurrentPageIndex();
            var pageEls = document.querySelectorAll('#flipbook .page');
            var cur = pageEls[idx];
            if (!cur) return;
            var audio = cur.querySelector('.audio-player');
            if (audio) {
              audio.currentTime = 0;
              var p = audio.play();
              if (p && typeof p.catch === 'function') p.catch(function () {});
            }
          } catch (e) {}
        }

        applyAudioVisibility();

        // Update page counter
        function updatePageInfo() {
          const currentPageNum = pageFlip.getCurrentPageIndex() + 1;
          document.getElementById('currentPage').textContent = currentPageNum;
          document.getElementById('prevBtn').disabled = currentPageNum <= 1;
          document.getElementById('nextBtn').disabled = currentPageNum >= totalPages;
        }

        // Button events
        document.getElementById('prevBtn').addEventListener('click', () => {
          if (pageFlip.getCurrentPageIndex() > 0) {
            stopAllAudio();
            pageFlip.flipPrev('top');
          }
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
          if (pageFlip.getCurrentPageIndex() < totalPages - 1) {
            stopAllAudio();
            pageFlip.flipNext('top');
          }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            document.getElementById('prevBtn').click();
          } else if (e.key === 'ArrowRight') {
            document.getElementById('nextBtn').click();
          }
        });

        // Update page info on flip and stop audio
        pageFlip.on('flip', () => {
          stopAllAudio();
          updatePageInfo();
          // Slight delay so the page is mounted before we try to play
          setTimeout(playCurrentPageAudio, 150);
        });

        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', () => {
            try {
              const docAny = document;
              const isFs = docAny.fullscreenElement || docAny.webkitFullscreenElement || docAny.mozFullScreenElement || docAny.msFullscreenElement;
              if (isFs) {
                const exit = docAny.exitFullscreen || docAny.webkitExitFullscreen || docAny.mozCancelFullScreen || docAny.msExitFullscreen;
                if (exit) exit.call(docAny);
                return;
              }
              const elem = document.getElementById('flipbook-container') || document.getElementById('flipbook') || document.documentElement;
              const req = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
              if (!req) {
                alert('Fullscreen is not supported by your browser.');
                return;
              }
              const result = req.call(elem);
              if (result && typeof result.catch === 'function') {
                result.catch((err) => {
                  console.warn('Fullscreen request rejected:', err && err.message);
                  alert('Fullscreen was blocked. Open this file directly (not inside an iframe) and try again.');
                });
              }
            } catch (err) {
              console.error('Fullscreen error:', err);
              alert('Fullscreen failed: ' + (err && err.message ? err.message : 'unknown error'));
            }
          });
        }


        // Print
        document.getElementById('printBtn').addEventListener('click', () => {
          window.print();
        });

        // Initialize page info
        updatePageInfo();

        // Restore MCQ score and reflection responses
        restoreMCQScore();
        restoreReflectionResponses();

      } catch (err) {
        console.error('StPageFlip initialization error:', err);
        console.log('Falling back to basic navigation...');

        // Fallback if StPageFlip fails to load
        let currentPage = 0;
        const pages = document.querySelectorAll('#flipbook .page');

        // Stop all audio playback and reset audio elements (fallback version)
        function stopAllAudioFallback() {
          var audioElements = document.querySelectorAll('.audio-player');
          audioElements.forEach(function (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
            audioEl.load();
          });
        }

        function showPage(idx) {
          stopAllAudioFallback();
          pages.forEach(p => p.style.display = 'none');
          if (pages[idx]) {
            pages[idx].style.display = 'flex';
            document.getElementById('currentPage').textContent = idx + 1;
            document.getElementById('prevBtn').disabled = idx <= 0;
            document.getElementById('nextBtn').disabled = idx >= pages.length - 1;
          }
        }

        document.getElementById('prevBtn').addEventListener('click', () => {
          if (currentPage > 0) showPage(--currentPage);
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
          if (currentPage < pages.length - 1) showPage(++currentPage);
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' && currentPage > 0) showPage(--currentPage);
          if (e.key === 'ArrowRight' && currentPage < pages.length - 1) showPage(++currentPage);
        });

        showPage(0);

        // Restore MCQ score and reflection responses
        restoreMCQScore();
        restoreReflectionResponses();
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
