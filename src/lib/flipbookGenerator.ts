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
  companyLogoDataUrl?: string | null
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

  // Add a title page at the beginning
  const pages: FlipbookPage[] = [
    {
      title: courseTitle,
      content: "Professional Learning Guide",
      images: [],
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

    pages.push({
      title: "Course Overview",
      content: `Course Objective: ${narratives.map(n => n.topicObjective || "Master key concepts").slice(0, 3).join(" ")}

Course Content:
${topicsList}

Duration: Approximately ${estimatedMinutes} minutes

${assessmentDetails}`,
      images: [],
      speaker: "",
      pageNumber: 1,
    });
  }

  // Convert narratives to flipbook pages with narration support
  const contentPages = narratives.flatMap((narrative, topicIdx) =>
    narrative.scenes.map((scene, sceneIdx) => ({
      title: scene.title,
      content: scene.caption || "",
      images: scene.imageDataUrl ? [scene.imageDataUrl] : [],
      speaker: voiceoverEnabled && scene.narration ? scene.narration : "",
      audioDataUrl: voiceoverEnabled && scene.audioDataUrl ? scene.audioDataUrl : undefined,
      pageNumber: (topicIdx + 1) * 10 + sceneIdx + 2,
    }))
  );

  pages.push(...contentPages);

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
          title: `Q${qIdx + 1} - ${(questionText || "Question").substring(0, 60)}`,
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
      assessmentData.scenarios.slice(0, 5).forEach((s: any) => {
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
          title: `Scenario - ${(situation || "Scenario").substring(0, 60)}`,
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
      pages.push({
        title: "Reflection Exercise",
        content: `Prompt: ${assessmentData.reflection.prompt || ""}\n\nGuidance: ${assessmentData.reflection.guidance || ""}`,
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
          ${page.audioDataUrl ? `
            <div class="audio-player-container">
              <audio class="audio-player" controls>
                <source src="${page.audioDataUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
              </audio>
            </div>
          ` : ""}
          <div class="narration-label">Narrator:</div>
          <div class="narration-text">${escapeHtml(page.speaker)}</div>
        </div>
        ` : ""}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <div class="page-number">Page ${page.pageNumber}</div>
          ${companyLogoDataUrl && idx > 0 ? `<img src="${companyLogoDataUrl}" alt="Company logo" class="logo-footer" />` : ""}
        </div>
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
      gap: 15px;
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
      margin-top: 8px;
      padding-top: 0px;
      border-top: none;
      width: 100%;
      font-weight: 500;
    }

    .page-number {
      font-size: 11px;
      color: #aaa;
      text-align: center;
      margin-top: 10px;
      flex-shrink: 0;
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
      margin-top: 15px;
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
      </div>
      <button class="btn btn-primary" id="nextBtn">Next &rarr;</button>
      <button class="btn btn-secondary" id="fullscreenBtn">Fullscreen</button>
      <button class="btn btn-secondary" id="printBtn">Print</button>
    </div>
  </div>

  <!-- StPageFlip Library -->
  <script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"><\/script>

  <script>
    let pageFlip = null;
    const totalPages = ${pages.length};

    // Initialize StPageFlip after DOM and library are ready
    window.addEventListener('DOMContentLoaded', () => {
      try {
        pageFlip = new pageFlip.PageFlip(
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
        const pageElements = document.querySelectorAll('#flipbook .page');
        pageFlip.loadFromElements(Array.from(pageElements));

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
            pageFlip.flipPrev('top');
          }
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
          if (pageFlip.getCurrentPageIndex() < totalPages - 1) {
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

        // Update page info on flip
        pageFlip.on('flip', updatePageInfo);

        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', () => {
            const elem = document.getElementById('flipbook-container') || document.getElementById('flipbook');
            if (!elem) return;

            const requestFullscreen = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
            if (requestFullscreen) {
              requestFullscreen.call(elem).catch((err) => {
                console.warn('Fullscreen unavailable:', err.message);
                alert('Fullscreen is not available in your browser.');
              });
            } else {
              alert('Fullscreen is not supported by your browser.');
            }
          });
        }

        // Print
        document.getElementById('printBtn').addEventListener('click', () => {
          window.print();
        });

        // Initialize page info
        updatePageInfo();

      } catch (err) {
        console.error('StPageFlip initialization error:', err);
        console.log('Falling back to basic navigation...');

        // Fallback if StPageFlip fails to load
        let currentPage = 0;
        const pages = document.querySelectorAll('#flipbook .page');

        function showPage(idx) {
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
