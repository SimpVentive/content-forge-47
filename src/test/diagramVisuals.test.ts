import { describe, expect, it, vi } from "vitest";
import { addMissingDiagramMarkers, isUsableSvg, mentionsDiagram, renderDiagramSvg, sanitizeSvg, type DiagramSpec } from "@/lib/diagramSpec";
import { buildSlides } from "@/lib/slideBuilder";

// A drawing that passes the shared quality rule: enough shapes, labels and explanatory words.
const goodSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">',
  '<rect x="40" y="40" width="1120" height="120" fill="#e8eef9"/>',
  '<text x="600" y="110" font-size="38">The escalation path has three steps for every complaint</text>',
  '<rect x="60" y="260" width="300" height="200" fill="#ffffff" stroke="#355fa8"/>',
  '<text x="210" y="350" font-size="26">Listen first, then name the problem clearly</text>',
  '<rect x="450" y="260" width="300" height="200" fill="#ffffff" stroke="#355fa8"/>',
  '<text x="600" y="350" font-size="26">Agree the next step with the customer together</text>',
  '<rect x="840" y="260" width="300" height="200" fill="#ffffff" stroke="#355fa8"/>',
  '<text x="990" y="350" font-size="26">Follow up within one working day to confirm</text>',
  '<line x1="360" y1="360" x2="450" y2="360" stroke="#f59e0b"/>',
  '<line x1="750" y1="360" x2="840" y2="360" stroke="#f59e0b"/>',
  '<text x="210" y="240" font-size="22">Step 1</text>',
  '<text x="600" y="240" font-size="22">Step 2</text>',
  '<text x="990" y="240" font-size="22">Step 3</text>',
  '<text x="600" y="720" font-size="20">Why it matters: unresolved complaints escalate fast</text>',
  "</svg>",
].join("");

const script = [
  "## Escalating a Complaint",
  "Every complaint follows a path, and the diagram shows the three steps.",
  "Listen first.",
  "",
  "## Following Up",
  "Follow up within a day.",
].join("\n");

describe("references to diagrams, images and charts", () => {
  it("counts any reference to a visual as a mention", () => {
    expect(mentionsDiagram("Look at the diagram below.")).toBe(true);
    expect(mentionsDiagram("The image shows a forklift.")).toBe(true);
    expect(mentionsDiagram("Check the sales chart.")).toBe(true);
    expect(mentionsDiagram("Speak clearly to the customer.")).toBe(false);
  });
});

describe("drawn visuals for references in the script", () => {
  it("stores a drawn visual for the topic that refers to a diagram", async () => {
    const askModel = vi.fn().mockResolvedValue(goodSvg);
    const { script: out, added, diagrams } = await addMissingDiagramMarkers(script, askModel);
    expect(added).toBe(1);
    expect(diagrams["Escalating a Complaint"]).toMatchObject({ type: "svg", title: "Escalating a Complaint" });
    expect(out).toBe(script);
  });

  it("does not ask the model about topics that have no visual reference", async () => {
    const askModel = vi.fn().mockResolvedValue(goodSvg);
    const plain = "## Following Up\nFollow up within a day.";
    await addMissingDiagramMarkers(plain, askModel);
    expect(askModel).not.toHaveBeenCalled();
  });

  it("rejects a drawing that contains a script or fails the quality rule", async () => {
    const unsafe = goodSvg.replace("</svg>", "<script>alert(1)</script></svg>");
    const { diagrams } = await addMissingDiagramMarkers(script, vi.fn().mockResolvedValue(unsafe));
    expect(diagrams).toEqual({});
    expect(isUsableSvg(goodSvg)).toBe(true);
    expect(isUsableSvg("<svg><rect/></svg>")).toBe(false);
  });

  it("removes scripts and event handlers before a drawing is shown", () => {
    const dirty = '<svg viewBox="0 0 10 10" onload="x()"><script>bad()</script><a href="javascript:bad()">x</a><text>ok</text></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<text>ok</text>");
  });

  it("renders a drawn visual with an accessible label", () => {
    const spec: DiagramSpec = { type: "svg", title: "Escalation path", svg: goodSvg };
    const html = renderDiagramSvg(spec);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Escalation path"');
  });

  it("shows the drawn visual on the screen that mentions it in a built course", () => {
    const modules = [{ title: "Service", topics: ["Escalating a Complaint"] }];
    const rawOutputs = {
      architect: JSON.stringify({ modules }),
      writer: "## Escalating a Complaint\nEvery complaint follows a path, and the diagram shows the three steps.\nListen first.",
      visual: "{}",
      assessment: "{}",
      diagrams: JSON.stringify({ "Escalating a Complaint": { type: "svg", title: "Escalating a Complaint", svg: goodSvg } }),
    } as any;
    const { slides } = buildSlides(rawOutputs, [], "15min", 10);
    const withVisual = slides.filter((slide) => slide.diagram);
    expect(withVisual).toHaveLength(1);
    expect(withVisual[0].diagram).toMatchObject({ type: "svg" });
    expect(withVisual[0].content).toContain("the diagram shows");
  });
});
