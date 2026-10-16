import { describe, it, expect } from "vitest";
import { getCompletionBlockers, getFurthestReachableSlide } from "@/lib/learnerProgression";

const slides = [{ type: "title" }, { type: "content" }, { type: "content" }, { type: "assessment" }, { type: "summary" }];

describe("learner progression rule", () => {
  it("on the cover, only the next screen is reachable — the summary is locked", () => {
    expect(getFurthestReachableSlide(slides, new Set([0]), 0, new Set())).toBe(1);
  });

  it("stops at an unanswered knowledge check", () => {
    expect(getFurthestReachableSlide(slides, new Set([0, 1, 2, 3]), 3, new Set())).toBe(3);
    expect(getFurthestReachableSlide(slides, new Set([0, 1, 2, 3]), 3, new Set([3]))).toBe(4);
  });

  it("blocks completion until every screen is viewed and every check answered", () => {
    expect(getCompletionBlockers(slides, new Set([0]), 4, new Set())).toEqual({ unseen: [1, 2, 3], unanswered: [3] });
    expect(getCompletionBlockers(slides, new Set([0, 1, 2, 3]), 4, new Set([3]))).toEqual({ unseen: [], unanswered: [] });
  });
});

import { vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { LearnerPreview } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Mac Strategy", topics: ["Legacy", "Silicon"] }] }),
  writer: "# Module 1: Mac Strategy\n\n## Legacy\nPowerPC came first.\n\n## Silicon\nApple silicon followed.",
  visual: "{}",
  assessment: JSON.stringify({ quizzes: [{ module_title: "Mac Strategy", questions: [{ question: "Which came first?", options: ["PowerPC", "M1"], correct_answer: "A" }] }] }),
};

describe("learner screen cannot skip to completion", () => {
  it("locks Jump to Module Summary on the cover page", async () => {
    render(<LearnerPreview courseTitle="History of MAC Products" rawOutputs={rawOutputs} standalone onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
    const jump = screen.getByRole("button", { name: /jump to module summary/i });
    expect(jump).toBeDisabled();
    await act(async () => { fireEvent.click(jump); });
    expect(screen.queryByRole("button", { name: /complete course/i })).toBeNull();
    expect(screen.getByText(/Slide 1 of/)).toBeInTheDocument();
    cleanup();
  });
});
