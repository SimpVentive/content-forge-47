/**
 * Image Generation Edge Function - OpenAI Images API (direct)
 *
 * Uses your own OpenAI account (OPENAI_API_KEY). No Lovable AI gateway involved.
 * Model can be overridden with the OPENAI_IMAGE_MODEL secret.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-1";

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

    const { prompt, style, altText, moduleTitle, topicTitle, size } = body ?? {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "prompt is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("[Image Generation] OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Image generation is not configured (missing OPENAI_API_KEY)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const model = Deno.env.get("OPENAI_IMAGE_MODEL") || DEFAULT_MODEL;
    const enhancedPrompt = enhancePromptForTraining(prompt, style, altText, moduleTitle, topicTitle);
    console.log(
      `[Image Generation] OpenAI ${model} for "${topicTitle || "untitled"}" (${enhancedPrompt.length} chars)`,
    );

    const response = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: enhancedPrompt,
        n: 1,
        size: typeof size === "string" && size ? size : "1024x1024",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[Image Generation] OpenAI error ${response.status}: ${errText.slice(0, 500)}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "OpenAI rate limit or quota reached. Please try again shortly.",
            retryAfter: 30,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "OpenAI rejected the API key. Check OPENAI_API_KEY." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Image generation failed (${response.status}). ${errText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const first = data?.data?.[0];
    const b64 = first?.b64_json;
    const url = first?.url;

    if (!b64 && !url) {
      console.error("[Image Generation] No image in response:", JSON.stringify(data).slice(0, 300));
      return new Response(JSON.stringify({ error: "Image generation returned no image." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageDataUrl: string;
    if (b64) {
      imageDataUrl = `data:image/png;base64,${b64}`;
    } else {
      const imgRes = await fetch(url);
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      imageDataUrl = `data:image/png;base64,${btoa(binary)}`;
    }

    console.log("[Image Generation] ✓ Success");
    return new Response(JSON.stringify({ imageDataUrl, mimeType: "image/png" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Image Generation] ERROR:", message);
    return new Response(JSON.stringify({ error: `Image generation failed: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
