import { describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LearnerPreview } from "@/components/contentforge/LearnerPreview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const rawOutputs = {
  architect: JSON.stringify({ modules: [{ module_title: "Emotional Intelligence", topics: ["The Four Domains", "Social Awareness"] }] }),
  writer: "## The Four Domains\nMany people think EI is about being nice.\n## Social Awareness\nRead the room before you speak.",
  visual: "{}",
  assessment: "{}",
};

function openPreview() {
  render(<LearnerPreview courseTitle="Emotional Intelligence" rawOutputs={rawOutputs} onClose={() => {}} exportMedia={{ introImages: { 0: "data:image/png;base64,AA==" } }} />);
}

describe("skipping ahead is explained in the middle of the screen", () => {
  it("shows a centred message when a locked screen is chosen from the lesson map", async () => {
    openPreview();
    const locked = screen.getAllByTitle("Complete the earlier screens to unlock")[0];
    await act(async () => { fireEvent.click(locked); });

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Please go through the screens in order to unlock this one.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    cleanup();
  });
});

describe("objectives are opened from the sidebar", () => {
  it("shows the learning objectives directly under the Objectives button", async () => {
    openPreview();
    fireEvent.click(screen.getByRole("button", { name: /^Objectives$/ }));
    const panel = document.getElementById("cf-sidebar-panel");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText("Learning Objectives")).toBeInTheDocument();
    cleanup();
  });
});
