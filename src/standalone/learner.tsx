import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import type { LearnerPreviewProps } from "@/components/contentforge/LearnerPreview";

const LearnerPreview = React.lazy(() => import("@/components/contentforge/LearnerPreview").then(m => ({ default: m.LearnerPreview })));
declare global {
  interface Window { __CONTENTFORGE_COURSE__: Omit<LearnerPreviewProps, "onClose">; }
}
// Exit: record completion (the SCORM wrapper listens for this event), then try to close the tab.
// Browsers only allow window.close() for tabs the script opened, so the fallback is a plain message.
function StandaloneLearner() {
  const [exited, setExited] = React.useState(false);
  if (exited) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0f172a", color: "#ffffff", fontFamily: "Inter, sans-serif", textAlign: "center" }}>
        <p>You have left the course. Your progress has been saved. You can close this tab.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <LearnerPreview
        {...window.__CONTENTFORGE_COURSE__}
        standalone
        onClose={() => {
          window.dispatchEvent(new Event("contentforge:exit"));
          window.close();
          setExited(true);
        }}
      />
    </Suspense>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<StandaloneLearner />);
}