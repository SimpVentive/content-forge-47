import { describe, expect, it, vi } from "vitest";
import { generateIntroImage, resolveIntroImage } from "@/lib/learnerIntroImage";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

describe("introduction image", () => {
  it("uses module images before other modules", () => {
    expect(resolveIntroImage([
      { moduleIndex: 0, visualImageDataUrl: "data:image/png;base64,first" },
      { moduleIndex: 1, visualImageDataUrl: "data:image/png;base64,second" },
    ], 1)).toBe("data:image/png;base64,second");
  });

  it("includes authored SVG visuals", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" /></svg>';
    expect(resolveIntroImage([{ moduleIndex: 0, visualSvg: svg }], 0)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  });

  it("accepts scene images and alternate image fields", () => {
    const slide = { moduleIndex: 0, narrative: { scenes: [{ image_url: "https://example.com/scene.png" }] } };
    expect(resolveIntroImage([slide], 0)).toBe("https://example.com/scene.png");
  });

  it("surfaces generation failures instead of leaving a permanent spinner", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "Image credits exhausted" }, error: null });
    await expect(generateIntroImage("CCTV", "Training")).rejects.toThrow("Image credits exhausted");
  });

  it("reads the generated image response", async () => {
    invoke.mockResolvedValueOnce({ data: { imageDataUrl: "data:image/png;base64,image" }, error: null });
    await expect(generateIntroImage("CCTV", "Training")).resolves.toBe("data:image/png;base64,image");
  });
});