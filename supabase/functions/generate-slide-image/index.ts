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
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const model = Deno.env.get("AI_IMAGE_MODEL") || "openai/gpt-image-1";

    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not set");
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: enhancedPrompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
        response_format: "b64_json",
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings -> Workspace -> Usage." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || "AI image generation failed");
    }

    const imagePayload = data?.data?.[0] || data?.images?.[0] || null;
    if (!imagePayload) {
      throw new Error("AI image generation returned no image payload");
    }

    if (imagePayload.b64_json) {
      return new Response(JSON.stringify({
        imageDataUrl: `data:image/png;base64,${imagePayload.b64_json}`,
        mimeType: "image/png",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imagePayload.url) {
      const fetched = await fetchImageAsDataUrl(imagePayload.url);
      return new Response(JSON.stringify(fetched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported AI image response format");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
