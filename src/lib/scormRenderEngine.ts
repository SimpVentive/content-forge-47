/**
 * SCORM Render Engine - Converts React components to static HTML for SCORM export
 * This is the core of the refactored export system that ensures preview and SCORM
 * render identically by using the same React component
 */

import React from "react";
import ReactDOMServer from "react-dom/server";
import type { RawAgentOutputs } from "@/types/agents";
import { buildSlides, tryParseJSON, type Module, type Slide } from "@/lib/slideBuilder";

export interface ScormRenderOptions {
  courseTitle: string;
  module: Module;
  moduleIndex: number;
  totalModules: number;
  slides: Slide[];
  quizzes: any[];
  audioUrl?: string;
  narrationText?: string;
  avatarImageUrl?: string;
  trainerName?: string;
}

export interface AssetBundle {
  avatarImage?: string; // base64 or relative path
  narrationAudio?: string; // relative path in ZIP
  visuals: Map<string, {
    imageDataUrl?: string;
    svg?: string;
  }>;
}

/**
 * Renders a module to static HTML suitable for SCORM packaging
 * Uses ReactDOMServer.renderToString to ensure consistency with preview
 */
export async function renderScormModuleHtml(
  options: ScormRenderOptions
): Promise<string> {
  const {
    courseTitle,
    module,
    moduleIndex,
    totalModules,
    slides,
    quizzes,
    avatarImageUrl,
    trainerName
  } = options;

  try {
    // Dynamically import ScormLearnerPreview to avoid circular dependencies
    const { default: ScormLearnerPreview } = await import("@/components/scorm/ScormLearnerPreview");

    // Render React component to static HTML string
    const bodyHtml = ReactDOMServer.renderToString(
      React.createElement(ScormLearnerPreview, {
        courseTitle,
        moduleTitle: module.title,
        moduleIndex,
        totalModules,
        slides,
        avatarImageUrl,
        trainerName,
      })
    );

    // Get comprehensive Tailwind CSS
    const css = buildComprehensiveTailwindCss();

    // Inject SCORM API wrapper
    const scormApi = injectScormApi();

    // Create complete self-contained HTML document
    const completeHtml = createScormHtmlDocument(bodyHtml, `${module.title} - ${courseTitle}`, css);

    // Append SCORM API script before closing body tag
    return completeHtml.replace('</body>', `${scormApi}</body>`);
  } catch (error) {
    console.error('[SCORM Render Engine] Error rendering module:', error);
    throw new Error(`Failed to render SCORM module: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper to create complete SCORM HTML document
 */
function createScormHtmlDocument(bodyHtml: string, title: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    ${css}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Extracts all assets from raw outputs for embedding in SCORM package
 */
export async function extractScormAssets(
  rawOutputs: RawAgentOutputs,
  avatarTrainerId?: string
): Promise<AssetBundle> {
  const visuals = new Map<string, { imageDataUrl?: string; svg?: string }>();

  // Parse visual data
  const visualData = tryParseJSON(rawOutputs.visual);
  const modules = visualData?.modules || [];

  modules.forEach((mod: any) => {
    const topicVisuals = mod.topic_visuals || [];
    topicVisuals.forEach((visual: any) => {
      const topicTitle = visual.topic_title || visual.title || "";
      if (topicTitle) {
        visuals.set(topicTitle, {
          imageDataUrl: visual.generated_image_data_url,
          svg: visual.generated_scene_svg
        });
      }
    });
  });

  return {
    avatarImage: undefined, // TODO: Extract from avatar trainer media
    narrationAudio: undefined, // TODO: Extract from voice data
    visuals
  };
}

/**
 * Builds comprehensive Tailwind CSS for SCORM modules
 * Includes all utilities needed for slide rendering
 */
export function buildComprehensiveTailwindCss(): string {
  return `/* CSS Reset */
      * { margin: 0; padding: 0; box-sizing: border-box; border: 0 solid #e5e7eb; }
      html { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: inherit; }

      /* Typography */
      h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
      p { margin: 0; }
      img { display: block; max-width: 100%; height: auto; }

      /* Display */
      .hidden { display: none; }
      .block { display: block; }
      .inline-block { display: inline-block; }
      .inline { display: inline; }
      .flex { display: flex; }
      .grid { display: grid; }
      .contents { display: contents; }

      /* Flexbox */
      .flex-row { flex-direction: row; }
      .flex-col { flex-direction: column; }
      .flex-wrap { flex-wrap: wrap; }
      .items-start { align-items: flex-start; }
      .items-center { align-items: center; }
      .items-end { align-items: flex-end; }
      .justify-start { justify-content: flex-start; }
      .justify-center { justify-content: center; }
      .justify-between { justify-content: space-between; }
      .gap-1 { gap: 0.25rem; }
      .gap-2 { gap: 0.5rem; }
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }
      .gap-6 { gap: 1.5rem; }

      /* Grid */
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .col-span-1 { grid-column: span 1; }
      .col-span-2 { grid-column: span 2; }

      /* Spacing */
      .p-0 { padding: 0; }
      .p-2 { padding: 0.5rem; }
      .p-3 { padding: 0.75rem; }
      .p-4 { padding: 1rem; }
      .p-6 { padding: 1.5rem; }
      .p-8 { padding: 2rem; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-8 { padding-left: 2rem; padding-right: 2rem; }
      .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .pb-4 { padding-bottom: 1rem; }
      .pb-6 { padding-bottom: 1.5rem; }
      .pt-4 { padding-top: 1rem; }
      .pt-6 { padding-top: 1.5rem; }
      .mb-1 { margin-bottom: 0.25rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mb-3 { margin-bottom: 0.75rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-2 { margin-top: 0.5rem; }
      .mt-3 { margin-top: 0.75rem; }
      .mt-6 { margin-top: 1.5rem; }

      /* Width & Height */
      .w-full { width: 100%; }
      .w-16 { width: 4rem; }
      .w-20 { width: 5rem; }
      .h-full { height: 100%; }
      .h-16 { height: 4rem; }
      .h-20 { height: 5rem; }
      .min-h-screen { min-height: 100vh; }
      .min-h-64 { min-height: 16rem; }
      .max-w-full { max-width: 100%; }
      .max-w-none { max-width: none; }
      .max-h-96 { max-height: 24rem; }

      /* Colors - Background */
      .bg-white { background-color: #ffffff; }
      .bg-slate-50 { background-color: #f8fafc; }
      .bg-slate-100 { background-color: #f1f5f9; }
      .bg-slate-200 { background-color: #e2e8f0; }
      .bg-slate-300 { background-color: #cbd5e1; }
      .bg-slate-700 { background-color: #334155; }
      .bg-slate-800 { background-color: #1e293b; }
      .bg-slate-900 { background-color: #0f172a; }
      .bg-indigo-50 { background-color: #eef2ff; }
      .bg-indigo-500 { background-color: #6366f1; }
      .bg-indigo-600 { background-color: #4f46e5; }
      .bg-indigo-700 { background-color: #4338ca; }
      .bg-orange-50 { background-color: #fff7ed; }
      .bg-orange-500 { background-color: #f97316; }
      .bg-orange-600 { background-color: #ea580c; }
      .bg-purple-600 { background-color: #9333ea; }
      .bg-purple-700 { background-color: #7e22ce; }
      .bg-green-50 { background-color: #f0fdf4; }
      .bg-green-500 { background-color: #22c55e; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
      .bg-gradient-to-b { background-image: linear-gradient(to bottom, var(--tw-gradient-stops)); }
      .from-indigo-600 { --tw-gradient-from: #4f46e5; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(79, 70, 229, 0)); }
      .from-indigo-700 { --tw-gradient-from: #4338ca; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(67, 56, 202, 0)); }
      .from-slate-700 { --tw-gradient-from: #334155; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(51, 65, 85, 0)); }
      .from-slate-900 { --tw-gradient-from: #0f172a; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(15, 23, 42, 0)); }
      .from-orange-600 { --tw-gradient-from: #ea580c; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(234, 88, 12, 0)); }
      .from-purple-600 { --tw-gradient-from: #9333ea; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(147, 51, 234, 0)); }
      .to-indigo-700 { --tw-gradient-to: #4338ca; }
      .to-slate-800 { --tw-gradient-to: #1e293b; }
      .to-orange-700 { --tw-gradient-to: #c2410c; }
      .to-purple-700 { --tw-gradient-to: #7e22ce; }

      /* Colors - Text */
      .text-white { color: #ffffff; }
      .text-slate-100 { color: #f1f5f9; }
      .text-slate-200 { color: #e2e8f0; }
      .text-slate-300 { color: #cbd5e1; }
      .text-slate-400 { color: #94a3b8; }
      .text-slate-600 { color: #475569; }
      .text-slate-700 { color: #334155; }
      .text-slate-900 { color: #0f172a; }
      .text-indigo-600 { color: #4f46e5; }
      .text-indigo-700 { color: #4338ca; }
      .text-green-700 { color: #15803d; }
      .text-green-900 { color: #166534; }
      .text-orange-100 { color: #fed7aa; }
      .text-orange-700 { color: #b45309; }
      .text-blue-700 { color: #1d4ed8; }
      .text-yellow-400 { color: #facc15; }

      /* Font Sizes */
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-base { font-size: 1rem; line-height: 1.5rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-2xl { font-size: 1.5rem; line-height: 2rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }

      /* Font Weight */
      .font-normal { font-weight: 400; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }

      /* Text Transform */
      .uppercase { text-transform: uppercase; }

      /* Letter Spacing */
      .tracking-wider { letter-spacing: 0.05em; }

      /* Line Height */
      .leading-relaxed { line-height: 1.625; }
      .leading-tight { line-height: 1.25; }

      /* Borders */
      .border { border-width: 1px; }
      .border-2 { border-width: 2px; }
      .border-4 { border-width: 4px; }
      .border-l-4 { border-left-width: 4px; }
      .border-t { border-top-width: 1px; }
      .border-b { border-bottom-width: 1px; }
      .border-slate-200 { border-color: #e2e8f0; }
      .border-slate-300 { border-color: #cbd5e1; }
      .border-indigo-600 { border-color: #4f46e5; }
      .border-green-500 { border-color: #22c55e; }
      .border-orange-500 { border-color: #f97316; }
      .border-blue-500 { border-color: #3b82f6; }

      /* Border Radius */
      .rounded { border-radius: 0.375rem; }
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }

      /* Shadow */
      .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
      .shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }

      /* Overflow */
      .overflow-hidden { overflow: hidden; }

      /* Flex */
      .flex-grow { flex-grow: 1; }
      .flex-shrink-0 { flex-shrink: 0; }

      /* Position */
      .absolute { position: absolute; }
      .relative { position: relative; }
      .sticky { position: sticky; }
      .top-8 { top: 2rem; }

      /* Object Fit */
      .object-cover { object-fit: cover; }
  `;
}

export function inlineCss(): string {
  return buildComprehensiveTailwindCss();
}

/**
 * Injects SCORM API wrapper for LMS communication
 */
export function injectScormApi(): string {
  return `
    <script>
      // SCORM 1.2 API Wrapper
      var SCORM_API;

      function findAPI(win) {
        if (win.API) return win.API;
        if (win.parent && win.parent !== win) return findAPI(win.parent);
        if (win.opener && !win.opener.closed) return findAPI(win.opener);
        return null;
      }

      function getAPI() {
        if (SCORM_API) return SCORM_API;
        SCORM_API = findAPI(window);
        if (!SCORM_API && window.parent !== window) {
          SCORM_API = findAPI(window.parent);
        }
        return SCORM_API;
      }

      function LMSSetValue(element, value) {
        const API = getAPI();
        if (API) {
          API.LMSSetValue(element, value);
        }
      }

      function scormInit() {
        const API = getAPI();
        if (API) {
          API.LMSInitialize("");
          LMSSetValue("cmi.core.lesson_status", "incomplete");
        }
      }

      function scormFinish() {
        const API = getAPI();
        if (API) {
          API.LMSCommit("");
          API.LMSFinish("");
        }
      }

      // Initialize on load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scormInit);
      } else {
        scormInit();
      }

      // Cleanup on unload
      window.addEventListener('beforeunload', scormFinish);
    </script>
  `;
}

/* ── Helpers ── */

function tryParseJSON(raw: string | undefined): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
