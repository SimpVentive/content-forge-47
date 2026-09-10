/**
 * Image Generation Edge Function - Lovable AI Gateway
 *
 * Uses the built-in Lovable AI image model (google/gemini-3-pro-image) so no
 * third-party image API key is required. Returns a base64 data URL.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "google/gemini-3-pro-image";

function enhancePromptForTraining(
  prompt: string,
  style: string,
  altText: string,
  moduleTitle: string,
  topicTitle: string,
): string {
  const softened = String(prompt).replace(
    /\b(violence|violent|blood|bloody|injury|weapon|weapons|gun|explosion|fight|attack|hazard|danger|accident|emergency)\b/gi,
    "workplace safety concern",
  );

  return [
    "Create an original, high-quality corporate training image.",
    moduleTitle ? `Module: ${moduleTitle}.` : "",
    topicTitle ? `Topic: ${topicTitle}.` : "",
    `Visual style: ${style || "realistic-office"}.`,
    altText ? `Accessibility description: ${altText}.` : "",
    "No logos, no watermarks, no copyrighted characters, no branded products, no visible trademarks, no text overlays.",
    "Contemporary corporate training aesthetic: diverse people, realistic lighting, professional composition.",
    softened,
  ]
    .filter(Boolean)
    .join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, style, altText, moduleTitle, topicTitle } = body ?? {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "prompt is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[Image Generation] LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Image generation is not configured (missing LOVABLE_API_KEY)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const enhancedPrompt = enhancePromptForTraining(prompt, style, altText, moduleTitle, topicTitle);
    console.log(`[Image Generation] Generating for "${topicTitle || "untitled"}" (${enhancedPrompt.length} chars)`);

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: enhancedPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[Image Generation] Gateway error ${response.status}: ${errText.slice(0, 500)}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Image generation is rate limited. Please try again shortly.", retryAfter: 30 }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up credits to continue generating images." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Image generation failed (${response.status}).` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      console.error("[Image Generation] No image in response:", JSON.stringify(data).slice(0, 300));
      return new Response(JSON.stringify({ error: "Image generation returned no image." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[Image Generation] ✓ Success");
    return new Response(
      JSON.stringify({ imageDataUrl: `data:image/png;base64,${b64}`, mimeType: "image/png" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Image Generation] ERROR:", message);
    return new Response(JSON.stringify({ error: `Image generation failed: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
