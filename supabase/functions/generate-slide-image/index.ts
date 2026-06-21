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

    // Submit job to Black Forest Labs (async API — returns task id to poll)
    const submitRes = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
      method: "POST",
      headers: {
        "x-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        width: 1536,
        height: 1024,
        prompt_upsampling: false,
        safety_tolerance: 2,
        output_format: "png",
      }),
    });

    const submitData = await submitRes.json().catch(() => ({}));
    if (!submitRes.ok) {
      console.error("BFL submit failed:", submitRes.status, submitData);
      if (submitRes.status === 401 || submitRes.status === 402 || submitRes.status === 403) {
        return new Response(JSON.stringify({ error: "Invalid or expired BFL_API_KEY." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (submitRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const msg = submitData?.error || submitData?.detail || `BFL submit failed: ${submitRes.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    const taskId = submitData?.id;
    const pollUrl = submitData?.polling_url || (taskId ? `https://api.bfl.ai/v1/get_result?id=${taskId}` : null);
    if (!pollUrl) throw new Error("BFL returned no task id");

    let imageUrl: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(pollUrl, { headers: { "x-key": apiKey, "accept": "application/json" } });
      const pollData = await pollRes.json().catch(() => ({}));
      const status = pollData?.status;
      if (status === "Ready") {
        imageUrl = pollData?.result?.sample;
        break;
      }
      if (status && status !== "Pending" && status !== "Processing" && status !== "Queued") {
        throw new Error(`BFL ${status}: ${JSON.stringify(pollData?.result || pollData)}`);
      }
    }

    if (!imageUrl) throw new Error("BFL generation timed out");

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
