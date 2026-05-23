import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedHeyGenSettings } from "./lib/heygenDefaults";

seedHeyGenSettings();

createRoot(document.getElementById("root")!).render(<App />);
