import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LearnerPreview } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
afterEach(cleanup);

/** One module, one match-the-following item and one fill-in-the-blank item. */
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
      correct_pairings: [
        { a: "Bullet camera", b: "Visible deterrent" },
        { a: "Dome camera", b: "Hides direction of aim" },
      ],
    }],
    fill_blanks: [{
      module_title: "Camera Selection",
      question: "Complete the sentence.",
      passage: "An ___ records on the network.",
      correct_answer: "NVR",
    }],
  }),
} as any;

const renderCourse = () => render(
  <LearnerPreview courseTitle="Camera Selection" rawOutputs={rawOutputs} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />,
);

const advanceButton = () =>
  screen.queryByRole("button", { name: /^Next$/i })
  || screen.queryByRole("button", { name: /start lesson|start course|begin/i });

/** Walk the course forward until the screen we want is on screen. */
async function advanceUntil(found: () => boolean, maxSteps = 15) {
  for (let step = 0; step < maxSteps && !found(); step++) {
    const button = advanceButton();
    if (!button) break;
    await act(async () => { fireEvent.click(button); });
  }
  return found();
}

const matchScreen = () => Boolean(screen.queryByLabelText(/Partner for Bullet camera/i));
const fillScreen = () => Boolean(screen.queryByLabelText(/Blank 1/i));

describe("match the following in the learner runtime", () => {
  it("marks every correct pairing and scores the exercise", async () => {
    renderCourse();
    expect(await advanceUntil(matchScreen)).toBe(true);

    await act(async () => { fireEvent.change(screen.getByLabelText(/Partner for Bullet camera/i), { target: { value: "0" } }); });
    await act(async () => { fireEvent.change(screen.getByLabelText(/Partner for Dome camera/i), { target: { value: "1" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit Answer" })); });

    expect(screen.getByRole("status")).toHaveTextContent("Correct answer");
    expect(screen.getByText(/Score 2\/2/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Correct").length).toBe(2);
  }, 30_000);

  it("says Incorrect, then shows the partner that was missed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderCourse();
    expect(await advanceUntil(matchScreen)).toBe(true);

    // Bullet camera paired with the dome's partner: one right, one wrong.
    await act(async () => { fireEvent.change(screen.getByLabelText(/Partner for Bullet camera/i), { target: { value: "1" } }); });
    await act(async () => { fireEvent.change(screen.getByLabelText(/Partner for Dome camera/i), { target: { value: "1" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit Answer" })); });

    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    expect(screen.queryByText(/Correct partner:/i)).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1600); });
    expect(screen.getByText("Correct partner: Visible deterrent")).toBeInTheDocument();
    expect(screen.getByText(/Score 1\/2/)).toBeInTheDocument();
    vi.useRealTimers();
  }, 30_000);

  it("will not submit until every row has a partner", async () => {
    renderCourse();
    expect(await advanceUntil(matchScreen)).toBe(true);
    expect(screen.getByRole("button", { name: "Submit Answer" })).toBeDisabled();
  }, 30_000);
});

describe("fill in the blanks in the learner runtime", () => {
  it("scores a typed answer that matches the authored key", async () => {
    renderCourse();
    expect(await advanceUntil(fillScreen)).toBe(true);

    await act(async () => { fireEvent.change(screen.getByLabelText(/Blank 1/i), { target: { value: "  nvr. " } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit Answer" })); });

    expect(screen.getByRole("status")).toHaveTextContent("Correct answer");
    expect(screen.getByText(/Score 1\/1/)).toBeInTheDocument();
  }, 30_000);

  it("says Incorrect, then reveals the word the learner missed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderCourse();
    expect(await advanceUntil(fillScreen)).toBe(true);

    await act(async () => { fireEvent.change(screen.getByLabelText(/Blank 1/i), { target: { value: "DVR" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit Answer" })); });

    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    expect(screen.queryByText("NVR")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1600); });
    expect(screen.getByText("NVR")).toBeInTheDocument();
    expect(screen.getByText(/Score 0\/1/)).toBeInTheDocument();
    vi.useRealTimers();
  }, 30_000);
});
