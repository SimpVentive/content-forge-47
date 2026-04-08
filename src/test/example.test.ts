import { describe, expect, it } from "vitest";

import { __scormTestUtils } from "@/lib/scormExport";

describe("scorm HTML export", () => {
  it("renders narrator, topic pills, markdown, takeaways, and polished styling", () => {
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

    expect(html).toContain('linear-gradient(135deg, var(--header-start, #4f46e5), var(--header-end, #7c3aed))');
    expect(html).toContain('height: 3px');
    expect(html).toContain('class="avatar-narrator"');
    expect(html).toContain('Focus on the practical benefit to an office worker.');
    expect(html).toContain('class="topic-pill active"');
    expect(html).toContain('>Inbox triage<');
    expect(html).toContain('>Meeting hygiene<');
    expect(html).not.toContain('{&quot;label&quot;');
    expect(html).toContain('<strong>Batch</strong>');
    expect(html).toContain('<ul><li>Clarify the decision needed</li><li>Invite only the people required</li></ul>');
    expect(html).toContain('class="key-takeaway-card"');
    expect(html).toContain('Protecting attention helps you finish more meaningful work.');
    expect(html).not.toContain('Key Takeaway: Protecting attention');
    expect(html).toContain('scrollIntoView({ behavior: \'smooth\', block: \'center\' })');
    expect(html).toContain('.quiz-opt.correct');
    expect(html).toContain('@media (max-width: 480px)');
    expect(html).toContain('color-scheme: light dark');
    expect(html).toContain('accent-color: var(--primary)');
  });
});
