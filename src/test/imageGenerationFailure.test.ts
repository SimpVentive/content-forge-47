import { describeImageFailure, requireNarrativeImages } from "@/lib/imageGenerationFailure";

describe("image-based generation failures", () => {
  it("reports provider setup failures without exposing provider response text", async () => {
    const response = new Response(JSON.stringify({error: "OpenAI 400: model does not exist | BFL 402: Insufficient credits"}), {status:502});
    expect(await describeImageFailure({context:response})).toBe("OpenAI rejected the configured image model; the fallback image account has insufficient credits; the Black Forest Labs image account has no credit left (HTTP 402). Top up the balance, then retry");
  });
  it("says plainly when the Black Forest Labs balance is empty", async () => {
    const response = new Response(JSON.stringify({error: "BFL submit 402: Payment Required"}), {status:500});
    expect(await describeImageFailure({context:response})).toContain("no credit left (HTTP 402)");
  });
  it("stops assembly if any scene has no image", () => {
    expect(() => requireNarrativeImages([{scenes:[{imageDataUrl:"data:image/png;base64,abc"},{}]}])).toThrow("1 scene(s) need images");
  });
  it("allows assembly when every scene has an image", () => {
    expect(() => requireNarrativeImages([{scenes:[{imageDataUrl:"data:image/png;base64,abc"}]}])).not.toThrow();
  });
});