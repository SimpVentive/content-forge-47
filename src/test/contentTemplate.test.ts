import { describe, expect, it } from "vitest";
import { inferContentTemplate, getOnScreenLines, buildSlideNarration } from "@/components/contentforge/LearnerPreview";

describe("shared legacy media-quiz migration", () => {
  it.each([false, true])("uses the explanation-only layout even when media exists (%s)", hasVisual => {
    expect(inferContentTemplate({ contentTemplate: "media-quiz", topicIndex: 1 }, hasVisual)).toBe("guided-notes");
  });

  it.each([false, true])("never renders the repetitive dashboard layout (%s)", hasVisual => {
    expect(inferContentTemplate({ contentTemplate: "dashboard", topicIndex: 0 }, hasVisual)).toBe("guided-notes");
    expect(inferContentTemplate({ topicIndex: 0, topicPartIndex: 0 }, hasVisual)).toBe("guided-notes");
  });

  it("keeps all displayed explanation lines in narration, without adding a module quiz", () => {
    const content = "Compare memory bandwidth before choosing a Mac. More bandwidth supports demanding workflows.";
    const lines = getOnScreenLines(content);
    expect(lines.length).toBeGreaterThan(0);
    expect(buildSlideNarration({ type: "content", content })).toBe(lines.map(line => line.text.trim().replace(/[.!?]*$/, ".")).join(" "));
  });

  it("retains every option on the dedicated assessment narration path", () => {
    const narration = buildSlideNarration({ type: "assessment", question: { question: "Which factor matters?", options: ["Colour", "Bandwidth", "Weight", "Age"] } });
    expect(narration).toContain("Option A. Colour");
    expect(narration).toContain("Option B. Bandwidth");
    expect(narration).toContain("Option C. Weight");
    expect(narration).toContain("Option D. Age");
  });
});