import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { normalizeAssessmentAnswer, resolveAssessmentAnswer } from "@/lib/assessmentAnswer";
import { LearnerPreview, buildSlides } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
afterEach(cleanup);

const options = ["PowerPC", "Intel", "Apple silicon", "Motorola"];
const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Mac Strategy", topics: ["Silicon"] }] }),
  writer: "# Module 1: Mac Strategy\n\n## Silicon\nApple silicon powers modern Macs.",
  visual: "{}",
  assessment: JSON.stringify({ mcq: [{ module_title: "Mac Strategy", question: "What powers modern Macs?", options, correct_answer: "Option C" }] }),
};

describe("shared quiz answer resolution", () => {
  it.each(["C", "c)", "Option C", "(C)", "Correct Answer: C", "3", 3, "Apple silicon", "C. Apple silicon", "**Apple silicon**"])("resolves authored key %s", key => {
    expect(resolveAssessmentAnswer({ options, correct_answer: key })).toBe(2);
  });
  it("preserves the correct option when shuffled", () => {
    const question = buildSlides(rawOutputs).slides.find(slide => slide.type === "assessment")?.question;
    expect(question?.correct_answer).toBe("Apple silicon");
    expect(question?.options[resolveAssessmentAnswer(question ?? {}) ?? -1]).toBe("Apple silicon");
  });
  it("uses best_response for scenario answer keys", () => {
    expect(normalizeAssessmentAnswer({ options, best_response: "Option C" }).correct_answer).toBe("Apple silicon");
  });
  it("never accepts partial text or an invalid key", () => {
    expect(resolveAssessmentAnswer({ options: ["Apple", "Apple silicon"], correct_answer: "Apple silicon" })).toBe(1);
    expect(resolveAssessmentAnswer({ options, correct_answer: "Missing answer" })).toBeUndefined();
    expect(resolveAssessmentAnswer({ options, correct_answer: "" })).toBeUndefined();
  });
  it.each([false, true])("scores exactly one of all four choices correctly (standalone=%s)", async standalone => {
    for (const selected of options) {
      render(<LearnerPreview courseTitle="Mac Strategy" rawOutputs={rawOutputs} standalone={standalone} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
      for (let step = 0; step < 12 && !screen.queryByRole("button", { name: "Submit Answer" }); step++) {
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Next$/i })); });
      }
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: new RegExp(selected + "$", "i") })); });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit Answer" })); });
      expect(screen.getByText(new RegExp(`Score ${selected === "Apple silicon" ? "1" : "0"}/1`))).toBeInTheDocument();
      cleanup();
    }
  });
});