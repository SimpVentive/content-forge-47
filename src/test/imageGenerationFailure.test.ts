import { describeImageFailure, requireNarrativeImages } from "@/lib/imageGenerationFailure";

describe("image-based generation failures", () => {
  it("reports provider setup failures without exposing provider response text", async () => {
    const response = new Response(JSON.stringify({error: "OpenAI 400: model does not exist | BFL 402: Insufficient credits"}), {status:502});
    expect(await describeImageFailure({context:response})).toBe("OpenAI rejected the configured image model; the fallback image account has insufficient credits");
  });
  it("stops assembly if any scene has no image", () => {
    expect(() => requireNarrativeImages([{scenes:[{imageDataUrl:"data:image/png;base64,abc"},{}]}])).toThrow("1 scene(s) need images");
  });
  it("allows assembly when every scene has an image", () => {
    expect(() => requireNarrativeImages([{scenes:[{imageDataUrl:"data:image/png;base64,abc"}]}])).not.toThrow();
  });
});