import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LearnerPreview, buildSlides } from "@/components/contentforge/LearnerPreview";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/narrationAudioService", () => ({ generateNarrationAudio: () => Promise.resolve({ success: false }) }));

const svg = `<svg viewBox="0 0 1200 800">${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 180}" y="100" width="170" height="200"/><text x="${i * 180}" y="150">Camera coverage step ${i + 1}</text>`).join("")}</svg>`;
const rawOutputs = (diagram: string) => ({
  architect: JSON.stringify({ modules: [{ module_title: "Camera Selection", topics: ["Coverage"] }] }),
  writer: "# Module 1: Camera Selection\n\n## Coverage\nChoose a camera that covers the entrance. Check the viewing distance before installation.",
  visual: JSON.stringify({ modules: [{ module_title: "Camera Selection", infographic_description: diagram }] }),
  assessment: "{}",
});

afterEach(() => { cleanup(); invoke.mockReset(); });

async function reachContent(outputs: ReturnType<typeof rawOutputs>) {
  const index = buildSlides(outputs).slides.findIndex(slide => slide.type === "content");
  expect(index).toBeGreaterThan(0);
  for (let i = 0; i < index; i++) {
    const next = screen.getAllByRole("button", { name: /next/i }).at(-1);
    if (!next) throw new Error("Learner Next control missing");
    await act(async () => { fireEvent.click(next); });
  }
}

describe("learner infographic dependencies", () => {
  it.each([false, true])("navigates beyond the cover with authored SVG in standalone=%s", async standalone => {
    const outputs = rawOutputs(svg);
    render(<LearnerPreview courseTitle="Camera Selection" rawOutputs={outputs} standalone={standalone} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
    await reachContent(outputs);
    const visual = screen.getByRole("button", { name: /module infographic/i });
    fireEvent.click(visual);
    expect(document.querySelector("svg[viewBox='0 0 1200 800']")).not.toBeNull();
  });

  it("generates a sparse diagram and explains its labels without undefined functions", async () => {
    invoke.mockResolvedValueOnce({ data: { text: svg }, error: null })
      .mockResolvedValueOnce({ data: { text: "• Camera coverage step 1 identifies the entrance." }, error: null });
    const outputs = rawOutputs("<svg><text>Coverage</text></svg>");
    render(<LearnerPreview courseTitle="Camera Selection" rawOutputs={outputs} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
    await reachContent(outputs);
    fireEvent.click(screen.getByRole("button", { name: /module infographic/i }));
    await waitFor(() => expect(document.querySelector("svg[viewBox='0 0 1200 800']")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /explain the image/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls[1][1].body.userMessage).toContain("Camera coverage step 1");
    expect(await screen.findByText(/identifies the entrance/)).toBeInTheDocument();
  });
});