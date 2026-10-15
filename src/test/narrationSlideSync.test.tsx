import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Voice requests resolve only when the test says so, to reproduce a slow voice service.
const pending: Array<{ text: string; resolve: (v: { success: boolean; audioDataUrl: string }) => void }> = [];
vi.mock("@/lib/narrationAudioService", () => ({
  generateNarrationAudio: (text: string) => new Promise(resolve => pending.push({ text, resolve })),
  getVoiceIdForLanguage: () => "voice",
}));
vi.mock("@/lib/learnerIntroImage", () => ({
  resolveIntroImage: () => "data:image/png;base64,AA==",
  generateIntroImage: () => Promise.resolve(null),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, from: vi.fn() } }));

const played: string[] = [];
class FakeAudio {
  src: string; muted = false; paused = true; ended = false; currentTime = 0; duration = 5;
  onplay?: () => void; onended?: () => void; onpause?: () => void;
  constructor(src: string) { this.src = src; }
  play() { played.push(this.src); this.paused = false; this.onplay?.(); return Promise.resolve(); }
  pause() { this.paused = true; }
}

const architect = JSON.stringify({ modules: [{ module_title: "Server Basics", topics: ["Processor Logic", "Memory Tiers"] }] });
const writer = `# Module 1: Server Basics

## Processor Logic
Processors trade hardware complexity for software efficiency.
CISC chips use many specialised instructions.

## Memory Tiers
Memory is arranged in fast and slow tiers.
Cache sits closest to the processor.`;

describe("narration always matches the screen", () => {
  beforeEach(() => {
    pending.length = 0; played.length = 0;
    vi.stubGlobal("Audio", FakeAudio);
    Object.defineProperty(window, "speechSynthesis", { value: { cancel: vi.fn(), speak: vi.fn(), speaking: false }, configurable: true });
  });

  it("never plays a late voice clip from the previous screen", async () => {
    const { LearnerPreview, buildSlides, buildSlideNarration } = await import("@/components/contentforge/LearnerPreview");
    const rawOutputs = { architect, writer, visual: "{}", assessment: "{}" };
    console.log("A");
    const { slides } = buildSlides(rawOutputs);
    console.log("B", slides.map(s=>s.type).join(","));
    const contentIdx = slides.map((s, i) => [s, i] as const).filter(([s]) => s.type === "content").map(([, i]) => i);
    expect(contentIdx.length).toBeGreaterThanOrEqual(2);

    console.log("C");
    render(<LearnerPreview courseTitle="Sync Test" rawOutputs={rawOutputs} onClose={() => {}} />);
    console.log("D");
    const next = () => fireEvent.click(screen.getAllByRole("button", { name: /next/i }).at(-1)!);

    // Go to the first content screen; its voice request starts but is slow.
    for (let i = 0; i < contentIdx[0]; i++) await act(async () => { next(); });
    await act(async () => {});
    const firstText = buildSlideNarration(slides[contentIdx[0]]);
    expect(pending.at(-1)?.text).toBe(firstText);
    const slowRequest = pending.at(-1)!;

    // Learner moves on before the first voice arrives.
    for (let i = contentIdx[0]; i < contentIdx[1]; i++) await act(async () => { next(); });
    await act(async () => { slowRequest.resolve({ success: true, audioDataUrl: "data:audio/mpeg;base64,FIRST" }); });

    expect(played).not.toContain("data:audio/mpeg;base64,FIRST");

    // The second screen's own clip is what plays there.
    const secondRequest = pending.at(-1)!;
    expect(secondRequest.text).toBe(buildSlideNarration(slides[contentIdx[1]]));
    await act(async () => { secondRequest.resolve({ success: true, audioDataUrl: "data:audio/mpeg;base64,SECOND" }); });
    expect(played.at(-1)).toBe("data:audio/mpeg;base64,SECOND");
  });
});
