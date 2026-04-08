import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { __scormTestUtils } from "../src/lib/scormExport";

const modules = __scormTestUtils.parseModules(JSON.stringify({
  modules: [
    {
      module_title: "Working Smarter",
      topics: [
        "{\"label\":\"Inbox triage\"}",
        { topic_title: "Meeting hygiene" },
      ],
    },
  ],
}));

const scriptMap = __scormTestUtils.parseScript(
  [
    "## Inbox triage",
    "Start with the most urgent messages. **Batch** the rest into scheduled review windows. This prevents constant context switching. Key Takeaway: Protecting attention helps you finish more meaningful work.",
    "",
    "## Meeting hygiene",
    "Use a short agenda before every discussion.",
    "- Clarify the decision needed",
    "- Invite only the people required",
    "Key Takeaway: Shorter meetings create more time for actual execution.",
  ].join("\n"),
  modules,
);

const html = __scormTestUtils.buildModuleHtml(
  "Office Productivity",
  modules[0],
  0,
  3,
  scriptMap.get("Working Smarter") || [],
  [
    {
      question: "What improves focus?",
      options: ["Constant checking", "Scheduled review windows"],
      correct: 1,
    },
  ],
  null,
  "",
);

const outputDir = path.resolve(process.cwd(), "artifacts", "scorm-sample");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "module_1.html"), html, "utf8");

console.log(path.join(outputDir, "module_1.html"));