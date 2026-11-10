import { describe, expect, it } from "vitest";
import { isCutOff, looksUnfinished } from "@/lib/replyCompleteness";

describe("isCutOff", () => {
  it("trusts the service's finish reason when it gives one", () => {
    expect(isCutOff("length", "anything")).toBe(true);
    expect(isCutOff("max_tokens", "anything")).toBe(true);
    expect(isCutOff("stop", '{"a": [1, 2')).toBe(false);
    expect(isCutOff("end_turn", "<svg>")).toBe(false);
  });

  it("checks the text when the finish reason is missing (older service)", () => {
    expect(isCutOff(null, '{"lessons": [{"title": "CBT"')).toBe(true);
    expect(isCutOff(undefined, '{"lessons": [{"title": "CBT"}]}')).toBe(false);
  });
});

describe("looksUnfinished", () => {
  it("flags an SVG that is opened but never closed", () => {
    expect(looksUnfinished('<svg viewBox="0 0 10 10"><rect/>')).toBe(true);
    expect(looksUnfinished('<svg viewBox="0 0 10 10"><rect/></svg>')).toBe(false);
  });

  it("flags an unclosed code fence and unfinished JSON", () => {
    expect(looksUnfinished("```json\n{\"a\": 1}")).toBe(true);
    expect(looksUnfinished("```json\n{\"a\": 1}\n```")).toBe(false);
    expect(looksUnfinished('{"a": [1, 2')).toBe(true);
    expect(looksUnfinished('{"a": "unclosed string')).toBe(true);
  });

  it("ignores brackets and quotes that sit inside a JSON string", () => {
    expect(looksUnfinished('{"note": "use { and [ freely", "ok": true}')).toBe(false);
    expect(looksUnfinished('{"quote": "she said \\"hi\\"", "n": 1}')).toBe(false);
  });

  it("leaves ordinary prose alone", () => {
    expect(looksUnfinished("# Module\n\nThe CBT triangle links thoughts, feelings and behaviour.")).toBe(false);
  });
});
