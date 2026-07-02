import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function softenPromptForTrainingImage(prompt: string): string {
  return prompt
    .replace(/\b(violence|violent|blood|bloody|injury|injured|weapon|weapons|gun|guns|knife|knives|explosion|explosive|fight|fighting|attack|attacking|hazardous|hazard|danger|dangerous|accident|emergency)\b/gi, "workplace safety concern")
    .replace(/\bkill|killed|death|dead|fatal|fatality\b/gi, "serious incident")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, style, altText, moduleTitle, topicTitle } = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
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
      "Keep the scene safe and non-graphic. Show prevention, discussion, procedure, equipment, or calm observation only. No harm, weapons, blood, damage, or physical conflict.",
      softenPromptForTrainingImage(prompt),
    ].join(" ");

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        size: "1536x1024",
        quality: "standard",
        n: 1,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("OpenAI image failed:", res.status, data);
      if (res.status === 401 || res.status === 403) {
        return new Response(JSON.stringify({ error: "Invalid or expired OPENAI_API_KEY." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const msg = data?.error?.message || data?.error || `OpenAI image failed: ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    let imageDataUrl: string;
    const mimeType = "image/png";

    if (b64) {
      imageDataUrl = `data:${mimeType};base64,${b64}`;
    } else if (url) {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
      const buf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageDataUrl = `data:${mimeType};base64,${btoa(binary)}`;
    } else {
      throw new Error("OpenAI returned no image data");
    }

    return new Response(JSON.stringify({ imageDataUrl, mimeType }), {
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
