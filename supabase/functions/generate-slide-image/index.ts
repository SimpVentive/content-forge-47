/**
 * Image Generation Edge Function — provider chain with hard time limits.
 *
 * 1. OpenAI Images API (OPENAI_API_KEY, model OPENAI_IMAGE_MODEL || gpt-image-2)
 * 2. Black Forest Labs Flux (BFL_API_KEY) — async submit + poll API
 *
 * Each provider is bounded so the caller always gets an answer well inside the
 * client's timeout. Response shape: { imageDataUrl, mimeType, provider }.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const OPENAI_TIMEOUT_MS = 70_000;
const BFL_TIMEOUT_MS = 40_000;

function enhancePrompt(prompt: string, style: string, altText: string, moduleTitle: string, topicTitle: string): string {
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
    "No logos, no watermarks, no copyrighted characters, no visible trademarks, no text overlays.",
    "Contemporary corporate training aesthetic: diverse people, realistic lighting, professional composition.",
    softened,
  ].filter(Boolean).join(" ");
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function fetchAsDataUrl(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`image download HTTP ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  return `data:${mime};base64,${toBase64(await res.arrayBuffer())}`;
}

async function openAI(prompt: string, size: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2";
  const signal = AbortSignal.timeout(OPENAI_TIMEOUT_MS);
  const body: Record<string, unknown> = { model, prompt, n: 1, size };
  if (model.startsWith("gpt-image")) body.quality = "medium";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  const first = data?.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return fetchAsDataUrl(first.url, signal);
  throw new Error("OpenAI returned no image");
}

async function bfl(prompt: string): Promise<string> {
  const key = Deno.env.get("BFL_API_KEY");
  if (!key) throw new Error("BFL_API_KEY not set");
  const deadline = Date.now() + BFL_TIMEOUT_MS;
  const signal = AbortSignal.timeout(BFL_TIMEOUT_MS);
  const submit = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "x-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ prompt, width: 1024, height: 768 }),
    signal,
  });
  if (!submit.ok) throw new Error(`BFL submit ${submit.status}: ${(await submit.text().catch(() => "")).slice(0, 200)}`);
  const { id, polling_url } = await submit.json();
  const pollUrl = polling_url || `https://api.bfl.ai/v1/get_result?id=${id}`;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(pollUrl, { headers: { "x-key": key, accept: "application/json" }, signal });
    const data = await poll.json().catch(() => ({}));
    if (data?.status === "Ready" && data?.result?.sample) return fetchAsDataUrl(data.result.sample, signal);
    if (["Error", "Failed", "Request Moderated", "Content Moderated"].includes(data?.status)) throw new Error(`BFL ${data.status}`);
  }
  throw new Error("BFL timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON in request body" }, 400); }
  const { prompt, style, altText, moduleTitle, topicTitle, size } = body ?? {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) return json({ error: "prompt is required" }, 400);

  const enhanced = enhancePrompt(prompt, style, altText, moduleTitle, topicTitle);
  const errors: string[] = [];
  const providers: Array<[string, () => Promise<string>]> = [
    ["openai", () => openAI(enhanced, typeof size === "string" && size ? size : "1024x1024")],
    ["bfl", () => bfl(enhanced)],
  ];
  for (const [name, run] of providers) {
    try {
      const imageDataUrl = await run();
      console.log(`[Image Generation] ✓ ${name}`);
      return json({ imageDataUrl, mimeType: imageDataUrl.slice(5, imageDataUrl.indexOf(";")), provider: name });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Image Generation] ${name} failed: ${message}`);
      errors.push(`${name}: ${message}`);
    }
  }
  return json({ error: `Image generation failed — ${errors.join(" | ")}` }, 502);
});
