import { describe, expect, it } from "vitest";
import { buildSlides, buildSlideNarration, getOnScreenLines } from "@/components/contentforge/LearnerPreview";

const topic = "Architectural Choice: DVR vs. NVR";
const source = `You'll first choose the system's brain. A DVR (Digital Video Recorder) is the budget-friendly traditionalist. It processes raw data at the recorder, using older coaxial cables. It's reliable for small shops, but cable signal degrades over long distances. For clients demanding high-definition clarity or AI-powered mobile alerts, you must recommend an NVR (Network Video Recorder). Here the IP cameras are the smart ones; they process video internally and transmit digital signals via Cat6 cables. If you need remote scalability and smart analytics, lead with NVR. If they are upgrading an old building on a tight budget using existing wiring, DVR is your play.`;

function contentSlides(text: string, maxLines = 10) {
  return buildSlides({
    architect: JSON.stringify({ modules: [{ module_title: "Consultative CCTV Solutions", topics: [topic] }] }),
    writer: `# Module 1: Consultative CCTV Solutions\n\n## ${topic}\n${text}`,
    assessment: "{}", visual: "{}",
  }, [], "3", maxLines).slides.filter(slide => slide.type === "content");
}

describe("shared learner content preservation", () => {
  it("retains the complete CCTV explanation including coaxial cables and the final DVR decision", () => {
    const slides = contentSlides(source);
    expect(slides.map(slide => slide.content).join(" ")).toBe(source);
    const spoken = slides.map(slide => buildSlideNarration(slide)).join(" ");
    expect(spoken).toContain("using older coaxial cables.");
    expect(spoken).toContain("using existing wiring, DVR is your play.");
    expect(slides.every(slide => !slide.wasTrimmedForLayout)).toBe(true);
  });

  it("keeps every sentence even when the configured line budget is smaller", () => {
    const sentences = Array.from({ length: 14 }, (_, i) => `Camera ${i + 1} covers entrance ${i + 1}.`);
    const lines = getOnScreenLines(sentences.join(" "), 4);
    expect(lines.map(line => line.text).sort()).toEqual([...sentences].sort());
  });

  it("paginates overflow instead of deleting it to meet a short duration", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Camera number ${i + 1} requires a separate review of its viewing distance and its outdoor mounting position.`).join(" ");
    const slides = contentSlides(text, 4);
    expect(slides.length).toBeGreaterThan(2);
    expect(slides.map(slide => slide.content).join(" ")).toBe(text);
  });

  it("preserves a long single sentence rather than cutting it mid-thought", () => {
    const text = `Review ${Array.from({ length: 110 }, (_, i) => `requirement${i + 1}`).join(" ")} before approving the installation.`;
    expect(contentSlides(text, 4).map(slide => slide.content).join(" ")).toBe(text);
  });
});