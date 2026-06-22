/**
 * Professional Flipbook Generator with turn.js
 * Generates high-quality interactive flipbooks with realistic page-turn animations
 */

import type { TopicNarrative } from "@/lib/visualNarrativeService";

export interface FlipbookPage {
  title?: string;
  content: string;
  images?: string[];
  speaker?: string;
  pageNumber: number;
}

export function generateFlipbookHTML(
  narratives: TopicNarrative[],
  courseTitle: string,
  displayStyle: "page-flip" | "smooth-slide" | "step-reveal" = "page-flip"
): string {
  // Convert narratives to flipbook pages
  const pages: FlipbookPage[] = narratives.flatMap((narrative, topicIdx) =>
    narrative.scenes.map((scene, sceneIdx) => ({
      title: scene.title,
      content: scene.caption || "",
      images: scene.imageDataUrl ? [scene.imageDataUrl] : [],
      speaker: "",
      pageNumber: topicIdx * 10 + sceneIdx + 1,
    }))
  );

  const pagesHTML = pages
    .map(
      (page) => `
    <div class="page">
      <div class="page-inner">
        ${page.title ? `<h1 class="page-title">${escapeHtml(page.title)}</h1>` : ""}
        <div class="page-content">
          ${page.images ? page.images.map((img) => `<img src="${img}" alt="Page content" class="page-image" />`).join("") : ""}
          ${page.content ? `<div class="page-text">${escapeHtml(page.content)}</div>` : ""}
        </div>
        <div class="page-number">Page ${page.pageNumber}</div>
      </div>
    </div>
  `
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
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
    }

    #flipbook {
      position: relative;
      width: 90%;
      max-width: 1200px;
      height: 90%;
      max-height: 800px;
      background: white;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    #flipbook .page {
      width: 100%;
      height: 100%;
      background: white;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    #flipbook .page:first-child {
      display: flex;
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
      justify-content: center;
      gap: 15px;
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
      margin-top: auto;
      padding-top: 15px;
      border-top: 2px solid #e0e0e0;
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
        width: 95%;
        height: 95%;
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
      <button class="btn btn-primary" id="prevBtn">← Previous</button>
      <div class="page-info">
        Page <span id="currentPage">1</span> of <span id="totalPages">${pages.length}</span>
      </div>
      <button class="btn btn-primary" id="nextBtn">Next →</button>
      <button class="btn btn-secondary" id="fullscreenBtn">⛶ Fullscreen</button>
      <button class="btn btn-secondary" id="printBtn">🖨 Print</button>
    </div>
  </div>

  <script>
    let currentPage = 1;
    const totalPages = ${pages.length};

    function showPage(pageNum) {
      // Hide all pages
      document.querySelectorAll('#flipbook .page').forEach(p => p.style.display = 'none');

      // Show current page
      const pages = document.querySelectorAll('#flipbook .page');
      if (pages[pageNum - 1]) {
        pages[pageNum - 1].style.display = 'flex';
      }

      // Update page counter
      document.getElementById('currentPage').textContent = pageNum;

      // Update button states
      document.getElementById('prevBtn').disabled = pageNum <= 1;
      document.getElementById('nextBtn').disabled = pageNum >= totalPages;
    }

    function nextPage() {
      if (currentPage < totalPages) {
        currentPage++;
        showPage(currentPage);
      }
    }

    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        showPage(currentPage);
      }
    }

    // Initialize on load
    window.addEventListener('DOMContentLoaded', () => {
      showPage(1);

      // Button events
      document.getElementById('prevBtn').addEventListener('click', prevPage);
      document.getElementById('nextBtn').addEventListener('click', nextPage);

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevPage();
        if (e.key === 'ArrowRight') nextPage();
      });

      // Fullscreen
      document.getElementById('fullscreenBtn').addEventListener('click', () => {
        const elem = document.getElementById('flipbook');
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      });

      // Print
      document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
      });
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
