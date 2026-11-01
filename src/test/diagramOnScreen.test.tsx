import { describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LearnerPreview } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const marker = "[MATRIX2X2 | title: The Four Domains | columns: You; Others | rows: Recognizing emotions; Managing them | cells: Self-Awareness; Social Awareness; Self-Management; Relationship Management]";
const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Emotional Intelligence", topics: ["The Four Domains"] }] }),
  writer: `## The Four Domains\nMany people think EI is just about being nice.\n${marker}\nImagine a two-by-two grid. One side is You; the other is Others.\nIt all starts with Self-Awareness.`,
  visual: "{}",
  assessment: "{}",
};

// Matches the SVG's aria-label, which is the diagram's title.
const diagramLabel = "The Four Domains";

async function openTopicScreen() {
  render(<LearnerPreview courseTitle="Emotional Intelligence" rawOutputs={rawOutputs} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
  // The sidebar lists the topic; open it, then confirm the screen with the mentioning sentence is showing.
  const topicButtons = screen.getAllByRole("button", { name: /^The Four Domains$/ });
  await act(async () => { fireEvent.click(topicButtons[0]); });
  expect(await screen.findByText("Imagine a two-by-two grid", { exact: false })).toBeInTheDocument();
}

describe("teaching diagram on the learner screen", () => {
  it("stays hidden while the trainer is speaking, and shows at the mention when voice is on", async () => {
    await openTopicScreen();
    expect(screen.queryByRole("img", { name: diagramLabel })).not.toBeInTheDocument();
    cleanup();
  });

  it("shows straight away when voice is off, so a silent learner still sees it", async () => {
    await openTopicScreen();
    fireEvent.click(screen.getByText("Voice On").closest("button")!);
    expect(await screen.findByRole("img", { name: diagramLabel })).toBeInTheDocument();
    cleanup();
  });
});
