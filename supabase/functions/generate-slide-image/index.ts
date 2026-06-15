import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(url: string): Promise<{ imageDataUrl: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  const mimeType = response.headers.get("content-type") || "image/png";
  const imageBuffer = await response.arrayBuffer();
  const imageBase64 = arrayBufferToBase64(imageBuffer);
  return {
    imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
    mimeType,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, style, altText, moduleTitle, topicTitle } = await req.json();
    const apiKey = Deno.env.get("BFL_API_KEY");

    if (!apiKey) {
      throw new Error("BFL_API_KEY (Black Forest Labs Flux 2) is not set");
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enhancedPrompt = [
      "Create an original AI-generated corporate training image.",
      `Module: ${moduleTitle || "Untitled module"}.`,
      `Topic: ${topicTitle || "Untitled topic"}.`,
      `Style: ${style || "realistic-office"}.`,
      `Accessibility intent: ${altText || "AI-generated visual for workplace learning."}.`,
      "No logos, no watermarks, no copyrighted characters, no branded products, no visible trademarks.",
      "Use a contemporary corporate training aesthetic with diverse people, realistic office lighting, and professional composition.",
      prompt,
    ].join(" ");

    // Call Black Forest Labs Flux 2 API
    const response = await fetch("https://api.bfl.ml/v1/image", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        width: 1536,
        height: 1024,
        steps: 28,
        guidance_scale: 7.5,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402 || response.status === 403) {
      return new Response(JSON.stringify({ error: "Invalid or expired API key. Please check BFL_API_KEY configuration." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || "Flux 2 image generation failed");
    }

    // Flux 2 returns a result with a URL that needs polling or direct fetch
    const imageUrl = data?.result?.sample || data?.result?.images?.[0] || data?.sample || null;
    if (!imageUrl) {
      throw new Error("Flux 2 image generation returned no image URL");
    }

    // Fetch the image and convert to base64
    const fetched = await fetchImageAsDataUrl(imageUrl);
    return new Response(JSON.stringify(fetched), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
