import { describe, expect, it } from "vitest";
import { countSourceWords, estimateMinutesCombined, estimateMinutesFromDocumentMeta, estimateMinutesFromText } from "@/lib/contentDuration";
import { estimateCredits } from "@/lib/creditEstimator";

describe("source duration", () => {
  it("does not turn the 721788-byte sales PDF into 35 minutes", () => {
    const source = Array(520).fill("CCTV").join(" ");
    expect(estimateMinutesCombined(source, 721788, "Sales_Team_Training.pdf")).toBe(4);
  });
  it("does not change the estimate when images increase file size", () => {
    const source = Array(650).fill("camera").join(" ");
    for (const name of ["training.pdf", "training.pptx", "training.docx"]) {
      expect(estimateMinutesCombined(source, 10_000_000, name)).toBe(5);
      expect(estimateMinutesCombined(source, 100, name)).toBe(5);
      expect(estimateMinutesFromDocumentMeta(10_000_000, name)).toBe(0);
    }
  });
  it("uses the same 130-word narration rate at rounding boundaries", () => {
    expect(estimateMinutesFromText(Array(130).fill("word").join(" "))).toBe(1);
    expect(estimateMinutesFromText(Array(131).fill("word").join(" "))).toBe(2);
  });
  it("returns unavailable instead of estimating from extraction failures", () => {
    for (const text of ["", "   ", "[Document] Extracting content from Sales_Team_Training.pdf...", "[Document] Uploaded: Sales_Team_Training.pdf (705 KB)\n\nWarning: Could not extract content automatically. Please paste the key topics and notes manually below.", "[Document] Uploaded: training.pdf (705 KB)\n\nCould not extract text. You can paste additional notes below."]) {
      expect(estimateMinutesCombined(text, 721788, "Sales_Team_Training.pdf")).toBe(0);
    }
  });
  it("counts real pasted notes after an upload warning", () => {
    expect(countSourceWords("[Document] Uploaded: test.pdf\n\nWarning: Please paste content.\n\nChoose outdoor cameras for parking.")).toBe(5);
  });
  it("preserves the chosen course duration for credit calculations", () => {
    expect(estimateCredits("CCTV", "static", 10).estimatedMinutes).toBe(10);
  });
});