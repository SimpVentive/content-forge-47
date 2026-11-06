import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LearnerPreview, buildSlides } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Camera Selection", topics: ["Cameras"] }] }),
  writer: "# Module 1: Camera Selection\n\n## Cameras\nPick the housing that fits the place it is going.",
  visual: "{}",
  assessment: JSON.stringify({
    match_the_following: [{
      module_title: "Camera Selection",
      question: "Match each camera to what it does best.",
      column_a: ["Bullet camera", "Dome camera"],
      column_b: ["Visible deterrent", "Hides direction of aim"],
      correct_pairings: [{ a: "Bullet camera", b: "Visible deterrent" }, { a: "Dome camera", b: "Hides direction of aim" }],
    }],
    fill_blanks: [{
      module_title: "Camera Selection",
      question: "Complete the sentence.",
      passage: "An ___ records on the network.",
      correct_answer: "NVR",
    }],
  }),
} as any;

describe("debug", () => {
  it("shows what the learner walks through", async () => {
    const { slides } = buildSlides(rawOutputs, [], undefined, 10, "standard");
    console.log("SLIDES:", slides.map((s: any, i: number) => `${i}:${s.type}${s.question ? "(" + (s.question.column_a ? "match" : s.question.passage ? "fill" : "mcq") + ")" : ""}`).join(" | "));

    render(<LearnerPreview courseTitle="Camera Selection" rawOutputs={rawOutputs} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
    for (let step = 0; step < 14; step++) {
      const buttons = screen.getAllByRole("button").map((b) => `${b.textContent?.trim()}${b.disabled ? "[disabled]" : ""}`).join(", ");
      console.log(`STEP ${step} buttons=[${buttons}] selects=${screen.queryAllByLabelText(/Partner for/i).length} inputs=${screen.queryAllByLabelText(/Blank \d+/i).length}`);
      const submit = screen.queryByRole("button", { name: "Submit Answer" });
      if (submit) {
        for (const select of screen.queryAllByLabelText(/Partner for/i)) {
          const v = Array.from(select.options).map((o) => o.value).find((x) => x !== "");
          await act(async () => { fireEvent.change(select, { target: { value: v ?? "" } }); });
        }
        for (const input of screen.queryAllByLabelText(/Blank \d+/i)) {
          await act(async () => { fireEvent.change(input, { target: { value: "NVR" } }); });
        }
        await act(async () => { fireEvent.click(submit); });
        continue;
      }
      const next = screen.queryByRole("button", { name: /^Next/i }) || screen.queryByRole("button", { name: /start lesson|start course|begin/i });
      if (!next) { console.log("no advance button"); break; }
      await act(async () => { fireEvent.click(next); });
    }
    expect(true).toBe(true);
  }, 60_000);
});
