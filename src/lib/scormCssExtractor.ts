/**
 * SCORM CSS Extractor - Extracts and inlines Tailwind CSS for static SCORM modules
 * Takes rendered HTML and extracts only the CSS classes actually used in the markup
 */

/**
 * Extracts used CSS class names from HTML
 * Uses a regex to find all class="..." and extract individual classes
 */
function extractUsedClasses(html: string): Set<string> {
  const classRegex = /class="([^"]*)"/g;
  const usedClasses = new Set<string>();

  let match;
  while ((match = classRegex.exec(html)) !== null) {
    const classes = match[1].split(/\s+/).filter(Boolean);
    classes.forEach((cls) => usedClasses.add(cls));
  }

  return usedClasses;
}

/**
 * Builds essential Tailwind CSS that's self-contained for SCORM modules
 * This is a curated subset of Tailwind utilities used by the SCORM components
 */
export function buildTailwindCss(): string {
  return `
    /* Tailwind CSS - Essential utilities for SCORM modules */
    *,
    ::before,
    ::after {
      box-sizing: border-box;
      border-width: 0;
      border-style: solid;
      border-color: #e5e7eb;
    }

    html {
      line-height: 1.5;
      -webkit-text-size-adjust: 100%;
      -moz-tab-size: 4;
      tab-size: 4;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    }

    body {
      margin: 0;
      line-height: inherit;
    }

    /* Typography */
    h1, h2, h3, h4, h5, h6 {
      font-size: inherit;
      font-weight: inherit;
    }

    p { margin: 0; }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    /* Display Utilities */
    .hidden { display: none; }
    .block { display: block; }
    .inline-block { display: inline-block; }
    .inline { display: inline; }
    .flex { display: flex; }
    .grid { display: grid; }
    .contents { display: contents; }
    .inline-flex { display: inline-flex; }

    /* Flexbox */
    .flex-row { flex-direction: row; }
    .flex-col { flex-direction: column; }
    .flex-wrap { flex-wrap: wrap; }
    .items-start { align-items: flex-start; }
    .items-end { align-items: flex-end; }
    .items-center { align-items: center; }
    .items-baseline { align-items: baseline; }
    .items-stretch { align-items: stretch; }
    .justify-start { justify-content: flex-start; }
    .justify-end { justify-content: flex-end; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .justify-around { justify-content: space-around; }
    .justify-evenly { justify-content: space-evenly; }
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }

    /* Grid */
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .col-span-1 { grid-column: span 1 / span 1; }
    .col-span-2 { grid-column: span 2 / span 2; }

    /* Spacing - Padding */
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .px-8 { padding-left: 2rem; padding-right: 2rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
    .pb-4 { padding-bottom: 1rem; }
    .pb-6 { padding-bottom: 1.5rem; }
    .pt-4 { padding-top: 1rem; }
    .pt-6 { padding-top: 1.5rem; }

    /* Spacing - Margin */
    .m-0 { margin: 0; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-6 { margin-top: 1.5rem; }

    /* Width & Height */
    .w-full { width: 100%; }
    .w-20 { width: 5rem; }
    .h-full { height: 100%; }
    .h-20 { height: 5rem; }
    .min-h-screen { min-height: 100vh; }
    .min-h-xs { min-height: 20rem; }
    .max-w-full { max-width: 100%; }
    .max-w-none { max-width: none; }
    .max-h-96 { max-height: 24rem; }

    /* Colors - Background */
    .bg-white { background-color: #ffffff; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-slate-200 { background-color: #e2e8f0; }
    .bg-slate-700 { background-color: #334155; }
    .bg-slate-900 { background-color: #0f172a; }
    .bg-indigo-50 { background-color: #eef2ff; }
    .bg-indigo-500 { background-color: #6366f1; }
    .bg-indigo-600 { background-color: #4f46e5; }
    .bg-indigo-700 { background-color: #4338ca; }
    .bg-orange-50 { background-color: #fff7ed; }
    .bg-orange-600 { background-color: #ea580c; }
    .bg-orange-700 { background-color: #c2410c; }
    .bg-purple-600 { background-color: #9333ea; }
    .bg-purple-700 { background-color: #7e22ce; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-green-500 { background-color: #22c55e; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-white\\/5 { background-color: rgba(255, 255, 255, 0.05); }
    .bg-white\\/10 { background-color: rgba(255, 255, 255, 0.1); }
    .bg-white\\/20 { background-color: rgba(255, 255, 255, 0.2); }
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
    .text-slate-500 { color: #64748b; }
    .text-slate-600 { color: #475569; }
    .text-slate-700 { color: #334155; }
    .text-slate-900 { color: #0f172a; }
    .text-indigo-600 { color: #4f46e5; }
    .text-indigo-700 { color: #4338ca; }
    .text-indigo-400 { color: #818cf8; }
    .text-green-700 { color: #15803d; }
    .text-green-900 { color: #166534; }
    .text-orange-100 { color: #fed7aa; }
    .text-orange-700 { color: #b45309; }
    .text-blue-700 { color: #1d4ed8; }
    .text-yellow-400 { color: #facc15; }
    .text-green-300 { color: #86efac; }

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
    .lowercase { text-transform: lowercase; }

    /* Letter Spacing */
    .tracking-wider { letter-spacing: 0.05em; }
    .tracking-widest { letter-spacing: 0.1em; }

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
    .border-slate-700 { border-color: #334155; }
    .border-indigo-600 { border-color: #4f46e5; }
    .border-green-500 { border-color: #22c55e; }
    .border-orange-500 { border-color: #f97316; }
    .border-blue-500 { border-color: #3b82f6; }
    .border-white\\/10 { border-color: rgba(255, 255, 255, 0.1); }
    .border-white\\/15 { border-color: rgba(255, 255, 255, 0.15); }
    .border-indigo-500\\/30 { border-color: rgba(99, 102, 241, 0.3); }
    .border-green-500\\/30 { border-color: rgba(34, 197, 94, 0.3); }

    /* Border Radius */
    .rounded { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    .rounded-\\[20px\\] { border-radius: 20px; }

    /* Shadow */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
    .shadow-inner { box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05); }
    .shadow-white\\/10 { box-shadow: inset 0 2px 4px 0 rgba(255, 255, 255, 0.1); }

    /* Overflow */
    .overflow-hidden { overflow: hidden; }

    /* Flex Grow */
    .flex-grow { flex-grow: 1; }
    .flex-shrink-0 { flex-shrink: 0; }

    /* Min Width */
    .min-w-0 { min-width: 0; }

    /* Sticky */
    .sticky { position: sticky; }
    .top-8 { top: 2rem; }

    /* Pointer Events */
    .pointer-events-none { pointer-events: none; }

    /* Prose */
    .prose-sm { font-size: 0.875rem; }
    .prose p { margin-top: 0; margin-bottom: 0; }
  `;
}

/**
 * Injects CSS directly into HTML for self-contained SCORM modules
 */
export function injectCssIntoHtml(html: string, css: string): string {
  const styleTag = \`<style type="text/css">\${css}</style>\`;
  return html.replace(/<head>/, \`<head>\${styleTag}\`);
}

/**
 * Creates a complete HTML document with inlined CSS for SCORM
 */
export function createScormHtmlDocument(
  bodyHtml: string,
  title: string,
  css?: string
): string {
  const styles = css || buildTailwindCss();

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${title}</title>
  <style type="text/css">
    \${styles}
  </style>
</head>
<body>
  \${bodyHtml}
</body>
</html>\`;
}
