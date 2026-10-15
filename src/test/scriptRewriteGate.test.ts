import { describe, expect, it } from "vitest";
import { acceptScriptRewrite, hasAiPlaceholder, safeLearnerText, stripAiPlaceholders } from "@/lib/textCleaningUtility";

const full = "## Topic\n\nYou're a production lead finishing a campaign. The batch record shows a deviation. ".repeat(10);

describe("script rewrite gate", () => {
  it("rejects abbreviated rewrites", () => {
    const r = acceptScriptRewrite(full, "## Topic\n\nYou're a production lead finishing a campaign... [rest of original script follows] ...".padEnd(full.length, " x"));
    expect(r).toEqual({ accepted: false, reason: "abbreviated" });
  });
  it("rejects rewrites that drop most content", () => {
    expect(acceptScriptRewrite(full, "## Topic\n\nShort.").accepted).toBe(false);
  });
  it("accepts complete rewrites", () => {
    expect(acceptScriptRewrite(full, full.replace(/deviation/g, "gap")).accepted).toBe(true);
  });
  it("strips placeholders from learner text but keeps normal parentheses", () => {
    expect(safeLearnerText("You're a production lead finishing a campaign... [rest of original script follows] ...")).toBe("You're a production lead finishing a campaign");
    expect(safeLearnerText("[rest of original script follows] ...")).toBe("");
    expect(hasAiPlaceholder("Review the remaining 20% of batches (the remaining batches are urgent).")).toBe(false);
    expect(stripAiPlaceholders("Line one\n[remaining content unchanged]\nLine two")).toBe("Line one\n\nLine two");
  });
});
