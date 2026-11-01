import { describe, expect, it } from "vitest";
import { buildSlides } from "@/lib/slideBuilder";
import { carryDiagramsForward, extractDiagramSpecs, findDiagramRevealIndex, isDiagramRevealed, renderDiagramSvg, type DiagramSpec } from "@/lib/diagramSpec";

const marker = "[MATRIX2X2 | title: The Four Domains | columns: You; Others | rows: Recognizing emotions; Managing them | cells: Self-Awareness; Social Awareness; Self-Management; Relationship Management]";
const spec: DiagramSpec = {
  type: "matrix2x2",
  title: "The Four Domains",
  columns: ["You", "Others"],
  rows: ["Recognizing emotions", "Managing them"],
  cells: ["Self-Awareness", "Social Awareness", "Self-Management", "Relationship Management"],
};

describe("diagram markers in writer output", () => {
  it("turns a valid marker into a spec and removes the line from the screen text", () => {
    const { text, diagrams } = extractDiagramSpecs(`Hook sentence.\n${marker}\nAnother sentence.`);
    expect(diagrams).toEqual([spec]);
    expect(text).toBe("Hook sentence.\nAnother sentence.");
  });

  it("removes a malformed marker without showing it, and returns no spec", () => {
    const { text, diagrams } = extractDiagramSpecs("Intro.\n[MATRIX2X2 | title: Bad | columns: A; B | rows: C; D | cells: only; three; items]\nOutro.");
    expect(diagrams).toEqual([]);
    expect(text).not.toContain("[MATRIX2X2");
  });

  it("leaves ordinary square brackets alone", () => {
    expect(extractDiagramSpecs("Use the [Safety] checklist.").text).toBe("Use the [Safety] checklist.");
  });

  it("finds the sentence that mentions the grid", () => {
    expect(findDiagramRevealIndex(["Think about a meeting.", "Imagine a two-by-two grid.", "Place yourself on it."], spec)).toBe(1);
    expect(findDiagramRevealIndex(["Think about a meeting.", "Place yourself on it."], spec)).toBe(-1);
  });
});

describe("when the diagram shows", () => {
  it("waits for the trainer to reach the mentioning sentence", () => {
    expect(isDiagramRevealed({ revealIndex: 2, highlightIndex: 0, narrationOff: false })).toBe(false);
    expect(isDiagramRevealed({ revealIndex: 2, highlightIndex: 2, narrationOff: false })).toBe(true);
    expect(isDiagramRevealed({ revealIndex: 2, highlightIndex: 3, narrationOff: false })).toBe(true);
  });

  it("shows at once when narration is off or nothing mentions it", () => {
    expect(isDiagramRevealed({ revealIndex: 2, highlightIndex: -1, narrationOff: true })).toBe(true);
    expect(isDiagramRevealed({ revealIndex: -1, highlightIndex: -1, narrationOff: false })).toBe(true);
  });
});

describe("diagram drawing", () => {
  it("draws every label in the course palette", () => {
    const svg = renderDiagramSvg(spec);
    expect(svg.startsWith("<svg")).toBe(true);
    // Long labels wrap onto several lines, so check every word rather than the whole label.
    for (const word of [...spec.cells, ...spec.rows, ...spec.columns, spec.title].join(" ").split(" ")) expect(svg).toContain(word);
  });

  it("escapes labels so they cannot inject markup", () => {
    const svg = renderDiagramSvg({ ...spec, cells: ["<img onerror=x>", "B", "C", "D"] });
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;img onerror=x&gt;");
  });
});

describe("carrying a diagram onto later screens", () => {
  it("shows the diagram from the start of later screens in the same module that refer to it", () => {
    const slides: Array<{ moduleIndex: number; content?: string; diagram?: DiagramSpec; diagramImmediate?: boolean }> = [
      { moduleIndex: 0, content: "Imagine a two-by-two grid.", diagram: spec },
      { moduleIndex: 0, content: "Back to the grid: where do you sit?" },
      { moduleIndex: 1, content: "A different grid of tools." },
      { moduleIndex: 0, content: "No reference here." },
    ];
    const out = carryDiagramsForward(slides);
    expect(out[1]).toMatchObject({ diagram: spec, diagramImmediate: true });
    expect(out[2].diagram).toBeUndefined();
    expect(out[3].diagram).toBeUndefined();
    expect(out[0].diagramImmediate).toBeUndefined();
  });

  it("does not turn a carried-forward screen into the source of the diagram for others", () => {
    const slides: Array<{ moduleIndex: number; content?: string; diagram?: DiagramSpec; diagramImmediate?: boolean }> = [
      { moduleIndex: 0, content: "The grid.", diagram: spec },
      { moduleIndex: 0, content: "Grid again." },
    ];
    const out = carryDiagramsForward(slides);
    expect(out[1].diagram).toEqual(spec);
    expect(out[1].diagramImmediate).toBe(true);
  });

  it("works in a built course: a later topic in the same module shows the grid", () => {
    const modules = [{ title: "Emotional Intelligence", topics: ["Topic A", "Topic B"] }];
    const writer = `## Topic A\nMany people think EI is about being nice.\n${marker}\nImagine a two-by-two grid.\n## Topic B\nRevisit the grid: where do you sit on it?`;
    const { slides } = buildSlides({ architect: JSON.stringify({ modules }), writer, visual: "{}", assessment: "{}" } as any, [], "15min", 10);
    const topicB = slides.find((slide) => slide.topicTitle === "Topic B" && slide.type === "content");
    expect(topicB?.diagram).toEqual(spec);
    expect(topicB?.diagramImmediate).toBe(true);
  });
});

describe("diagram placement in the built course", () => {
  it("attaches the diagram to the screen whose text mentions it, and hides the marker", () => {
    const modules = [{ title: "Emotional Intelligence", topics: ["The Four Domains"] }];
    const writer = `## The Four Domains\nMany people think EI is about being nice.\n${marker}\nImagine a two-by-two grid. One side is You; the other is Others.\nIt all starts with Self-Awareness.`;
    const { slides } = buildSlides({
      architect: JSON.stringify({ modules }),
      writer,
      visual: "{}",
      assessment: "{}",
    } as any, [], "15min", 10);
    const withDiagram = slides.filter((slide) => slide.diagram);
    expect(withDiagram).toHaveLength(1);
    expect(withDiagram[0].diagram).toEqual(spec);
    expect(withDiagram[0].content).toContain("two-by-two grid");
    expect(slides.map((slide) => slide.content || "").join(" ")).not.toContain("[MATRIX2X2");
  });
});
