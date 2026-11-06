import { describe, expect, it, vi } from "vitest";

const { written } = vi.hoisted(() => ({ written: [] as string[] }));

vi.mock("jspdf", () => {
  class FakePDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    addPage() {}
    addImage() {}
    text(input: unknown) {
      (Array.isArray(input) ? input : [input]).forEach((value) => written.push(String(value)));
    }
    splitTextToSize(text: string) { return [String(text)]; }
    output() { return "data:application/pdf;base64,"; }
  }
  return { jsPDF: FakePDF };
});

import { exportNarrativeToPDF } from "@/lib/pdfExportService";

const narratives = [{
  topicTitle: "Cameras",
  scenes: [{ title: "Housings", caption: "Pick the housing that fits the place it is going.", narration: "" }],
}] as any;

const assessment = JSON.stringify({
  match_the_following: [{
    question: "Match each camera to what it does best.",
    column_a: ["Bullet camera", "Dome camera"],
    column_b: ["Visible deterrent", "Hides direction of aim"],
    correct_pairings: [
      { a: "Bullet camera", b: "Visible deterrent" },
      { a: "Dome camera", b: "Hides direction of aim" },
    ],
  }],
  fill_blanks: [{
    question: "Complete the sentence.",
    passage: "An ___ records on the network.",
    correct_answer: "NVR",
  }],
  true_false: [{ question: "Domes hide the aim.", correct_answer: "True" }],
});

describe("printable assessment pages", () => {
  it("include match, fill-in-the-blank and true/false items, not only MCQs", async () => {
    written.length = 0;
    const result = await exportNarrativeToPDF(narratives, "Camera Selection", assessment, null);

    expect(result.success).toBe(true);
    const text = written.join("\n");
    expect(text).toContain("Match 1: Match each camera to what it does best.");
    expect(text).toContain("Bullet camera  ->  Visible deterrent");
    expect(text).toContain("Dome camera  ->  Hides direction of aim");
    expect(text).toContain("Fill in the blanks 1");
    expect(text).toContain("An ___ records on the network.");
    expect(text).toContain("Answer: NVR");
    expect(text).toContain("1. Domes hide the aim.");
  }, 30_000);
});
