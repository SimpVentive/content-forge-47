import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedHeyGenSettings } from "./lib/heygenDefaults";

// Debug logging
console.log("main.tsx: Starting app initialization at", new Date().toISOString());

try {
  seedHeyGenSettings();
  console.log("main.tsx: seedHeyGenSettings completed");
} catch (e) {
  console.error("main.tsx: seedHeyGenSettings failed", e);
}

const rootElement = document.getElementById("root");
console.log("main.tsx: root element found?", !!rootElement);

if (!rootElement) {
  console.error("main.tsx: root element not found!");
  document.body.innerHTML = '<div style="padding: 20px; color: red;"><h1>ERROR: Root element not found</h1></div>';
} else {
  try {
    console.log("main.tsx: Creating React root and rendering App");
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log("main.tsx: React render completed");
  } catch (e) {
    console.error("main.tsx: Failed to render app", e);
    rootElement.innerHTML = '<div style="padding: 20px; color: red;"><h1>ERROR: Failed to render</h1><pre>' + e.toString() + '</pre></div>';
  }
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});
