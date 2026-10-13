import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import type { LearnerPreviewProps } from "@/components/contentforge/LearnerPreview";

const LearnerPreview = React.lazy(() => import("@/components/contentforge/LearnerPreview").then(m => ({ default: m.LearnerPreview })));
declare global {
  interface Window { __CONTENTFORGE_COURSE__: Omit<LearnerPreviewProps, "onClose">; }
}
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Suspense fallback={null}><LearnerPreview {...window.__CONTENTFORGE_COURSE__} standalone onClose={() => window.dispatchEvent(new Event("contentforge:exit"))} /></Suspense>);
}