/**
 * HTML Flipbook Generator
 * Generates standalone interactive flipbook HTML from narrative scenes
 */

import type { TopicNarrative } from "@/lib/visualNarrativeService";

export function generateFlipbookHTML(
  narratives: TopicNarrative[],
  courseTitle: string,
  displayStyle: "page-flip" | "smooth-slide" | "step-reveal" = "smooth-slide"
): string {
  // Prepare scene data for embedding
  const scenesJSON = JSON.stringify(
    narratives.flatMap((narrative, topicIdx) =>
      narrative.scenes.map((scene) => ({
        topicIndex: topicIdx,
        sceneIndex: scene.sceneNumber - 1,
        topicTitle: narrative.topicTitle,
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        caption: scene.caption,
        imageDataUrl: scene.imageDataUrl || "",
      }))
    )
  );

  const displayStyleClass =
    displayStyle === "page-flip"
      ? "transition-all duration-500 ease-in-out"
      : displayStyle === "step-reveal"
        ? "transition-opacity duration-300"
        : "transition-all duration-400";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(courseTitle)} - Visual Narrative Flipbook</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      width: 100%;
      max-width: 1000px;
    }

    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }

    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }

    .flipbook-wrapper {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .flipbook-container {
      position: relative;
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
      aspect-ratio: 16 / 9;
      overflow: hidden;
    }

    .scene-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      ${displayStyleClass};
    }

    .scene-image.transitioning {
      opacity: 0.75;
    }

    .image-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #d1d5db 0%, #f3f4f6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: #6b7280;
    }

    .spinner {
      width: 60px;
      height: 60px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .caption-area {
      background: white;
      border-top: 2px solid #e5e7eb;
      padding: 24px;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .scene-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }

    .scene-caption {
      font-size: 1.0625rem;
      line-height: 1.6;
      color: #374151;
    }

    .footer {
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }

    .navigation {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .nav-button {
      padding: 8px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #374151;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
    }

    .nav-button:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .nav-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .scene-counter {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
      white-space: nowrap;
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #d1d5db;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }

    .topic-indicator {
      text-align: right;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .topic-indicator strong {
      color: #111827;
    }

    .instruction-overlay {
      position: absolute;
      top: 16px;
      right: 16px;
      font-size: 0.75rem;
      color: white;
      background: rgba(0, 0, 0, 0.4);
      padding: 8px 12px;
      border-radius: 6px;
      pointer-events: none;
      backdrop-filter: blur(4px);
      z-index: 10;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.875rem;
      }

      .caption-area {
        padding: 16px;
        min-height: 100px;
      }

      .scene-caption {
        font-size: 0.9375rem;
      }

      .footer {
        flex-direction: column;
        gap: 12px;
      }

      .topic-indicator {
        text-align: center;
      }
    }

    /* SVG Icons */
    .icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(courseTitle)}</h1>
      <p>Interactive Visual Narrative</p>
    </div>

    <div class="flipbook-wrapper">
      <div class="flipbook-container">
        <img id="sceneImage" class="scene-image" alt="Scene image" />
        <div class="instruction-overlay">
          ← → or A/D keys to navigate
        </div>
      </div>

      <div class="caption-area">
        <div class="scene-title" id="sceneTitle"></div>
        <div class="scene-caption" id="sceneCaption"></div>
      </div>

      <div class="footer">
        <div class="navigation">
          <button class="nav-button" id="prevBtn" aria-label="Previous scene">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <span class="scene-counter">Scene <span id="currentScene">1</span> of <span id="totalScenes">0</span></span>
          <button class="nav-button" id="nextBtn" aria-label="Next scene">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="topic-indicator">
          <strong id="topicName">Topic</strong>
        </div>
      </div>
    </div>
  </div>

  <script>
    const scenes = ${scenesJSON};
    let currentIndex = 0;
    let isTransitioning = false;

    function updateDisplay() {
      const scene = scenes[currentIndex];
      const totalScenes = scenes.length;
      const progress = ((currentIndex + 1) / totalScenes) * 100;

      // Update image
      const img = document.getElementById('sceneImage');
      if (scene.imageDataUrl) {
        img.src = scene.imageDataUrl;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }

      // Update text
      document.getElementById('sceneTitle').textContent = scene.title;
      document.getElementById('sceneCaption').textContent = scene.caption;
      document.getElementById('currentScene').textContent = currentIndex + 1;
      document.getElementById('totalScenes').textContent = totalScenes;
      document.getElementById('topicName').textContent = scene.topicTitle;

      // Update progress
      document.getElementById('progressFill').style.width = progress + '%';

      // Update button states
      document.getElementById('prevBtn').disabled = currentIndex === 0;
      document.getElementById('nextBtn').disabled = currentIndex === totalScenes - 1;
    }

    function goToPrevious() {
      if (isTransitioning || currentIndex === 0) return;
      isTransitioning = true;
      currentIndex--;
      updateDisplay();
      setTimeout(() => { isTransitioning = false; }, 300);
    }

    function goToNext() {
      if (isTransitioning || currentIndex === scenes.length - 1) return;
      isTransitioning = true;
      currentIndex++;
      updateDisplay();
      setTimeout(() => { isTransitioning = false; }, 300);
    }

    // Event listeners
    document.getElementById('prevBtn').addEventListener('click', goToPrevious);
    document.getElementById('nextBtn').addEventListener('click', goToNext);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') goToPrevious();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') goToNext();
    });

    // Initialize
    updateDisplay();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
