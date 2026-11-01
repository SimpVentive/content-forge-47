import { describe, expect, it, vi } from "vitest";
import { addMissingDiagramMarkers } from "@/lib/diagramSpec";

const goodReply = "[MATRIX2X2 | title: Goleman Domains | columns: Self; Social | rows: Recognition; Management | cells: Self-Awareness; Social Awareness; Self-Management; Relationship Management]";

const script = [
  "## Decoding the Goleman Grid",
  "To master EI, you need a map.",
  "Visualize a simple two-by-two grid.",
  "It starts with Self-Awareness.",
  "",
  "## Reading the Room",
  "Read the room before you speak.",
].join("\n");

describe("grids described in the script get a marker", () => {
  it("asks for a marker once and inserts it after the sentence that mentions the grid", async () => {
    const askModel = vi.fn().mockResolvedValue(goodReply);
    const { script: out, added } = await addMissingDiagramMarkers(script, askModel);
    expect(added).toBe(1);
    expect(askModel).toHaveBeenCalledTimes(1);
    const lines = out.split("\n");
    expect(lines[lines.indexOf("Visualize a simple two-by-two grid.") + 1]).toBe(goodReply);
    expect(out).toContain("## Reading the Room\nRead the room before you speak.");
  });

  it("leaves topics without a grid, and topics that already have a marker, alone", async () => {
    const askModel = vi.fn().mockResolvedValue(goodReply);
    const withMarker = script.replace("Visualize a simple two-by-two grid.", `Visualize a simple two-by-two grid.\n${goodReply}`);
    const { added } = await addMissingDiagramMarkers(withMarker, askModel);
    expect(added).toBe(0);
    expect(askModel).toHaveBeenCalledTimes(0);
  });

  it("keeps the script unchanged when the model says there is no grid or returns something invalid", async () => {
    const none = await addMissingDiagramMarkers(script, vi.fn().mockResolvedValue("NONE"));
    expect(none).toEqual({ script, added: 0, diagrams: {} });
    const broken = await addMissingDiagramMarkers(script, vi.fn().mockResolvedValue("[MATRIX2X2 | title: Bad | columns: A; B]"));
    expect(broken).toEqual({ script, added: 0, diagrams: {} });
  });

  it("skips the topic when the model call fails", async () => {
    const failing = await addMissingDiagramMarkers(script, vi.fn().mockRejectedValue(new Error("timeout")));
    expect(failing).toEqual({ script, added: 0, diagrams: {} });
  });
});
