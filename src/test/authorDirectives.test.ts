import { describe, it, expect } from "vitest";
import { isPlaceholderToken, safeLearnerText, stripAiPlaceholders, acceptScriptRewrite } from "@/lib/textCleaningUtility";

describe("author directives never reach learners", () => {
  it("drops the unclosed Interaction Point line from the screenshot", () => {
    expect(isPlaceholderToken("[Interaction Point: Drag-and-Drop Categorization.")).toBe(true);
    expect(safeLearnerText("[Interaction Point: Drag-and-Drop Categorization.")).toBe("");
  });
  it("strips closed directives inside text but keeps real content", () => {
    const out = stripAiPlaceholders("Map every connection point.\n[Image: HVAC diagram]\nScope expands.");
    expect(out).not.toMatch(/Image/);
    expect(out).toMatch(/Map every connection point\./);
    expect(out).toMatch(/Scope expands\./);
  });
  it("keeps normal sentences that mention images", () => {
    expect(isPlaceholderToken("The image shows a camera.")).toBe(false);
  });
  it("does not reject a complete rewrite just because it had a directive", () => {
    expect(acceptScriptRewrite("a b c", "a b c [Pause]").accepted).toBe(true);
  });
});
