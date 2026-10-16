import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { LearnerPreview, buildSlides } from "@/components/contentforge/LearnerPreview";
import { learnerDocument } from "@/lib/learnerScormPackage";
import { listCourseDrafts, saveCourseDraft } from "@/lib/courseDrafts";
import type { CourseParameters } from "@/components/contentforge/CourseParametersDialog";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const logo = "data:image/png;base64,AA==";
const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Client Training", topics: ["Safety"] }] }),
  writer: "# Module 1: Client Training\n\n## Safety\nCheck equipment before use.",
  visual: "{}",
  assessment: JSON.stringify({ quizzes: [{ module_title: "Client Training", questions: [{ question: "When should you check equipment?", options: ["Before use", "Never"], correct_answer: "A" }] }] }),
};

describe("course-level client branding", () => {
  it("keeps the logo visible through every screen and completion in preview and standalone mode", async () => {
    for (const standalone of [false, true]) {
      render(<LearnerPreview courseTitle="Client Training" companyLogo={logo} rawOutputs={rawOutputs} standalone={standalone} onClose={() => {}} exportMedia={{ introImages: { 0: logo } }} />);
      const { slides } = buildSlides(rawOutputs);
      for (let index = 0; index < slides.length; index++) {
        expect(screen.getByRole("img", { name: "Client logo" })).toHaveAttribute("src", logo);
        const next = screen.getAllByRole("button", { name: /next|complete course/i }).at(-1);
        if (!next) throw new Error("Missing course navigation");
        await act(async () => { fireEvent.click(next); });
      }
      expect(screen.getByRole("img", { name: "Client logo" })).toHaveAttribute("src", logo);
      cleanup();
    }
  });

  it("retains the logo when saving and restoring course settings", () => {
    saveCourseDraft({ id: "logo-test", title: "Client Training", inputText: "Safety", courseParams: { companyLogo: logo } as CourseParameters, workflowClips: [], rawOutputs, outputData: { outline: "", script: "", assessment: "", package: "" } });
    expect(listCourseDrafts().find(draft => draft.id === "logo-test")?.courseParams?.companyLogo).toBe(logo);
  });

  it("includes client branding in the portable course document", () => {
    const html = learnerDocument("Client Training", { courseTitle: "Client Training", companyLogo: logo, rawOutputs }, { js: "", css: "" });
    expect(html).toContain(`"companyLogo":"${logo}"`);
  });
});