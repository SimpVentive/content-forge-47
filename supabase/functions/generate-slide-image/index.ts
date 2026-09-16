/**
 * Image Generation Edge Function - Black Forest Labs Flux 2
 *
 * RATIONALE:
 * - BFL Flux 2 is the primary image generation service for this project
 * - API key (BFL_API_KEY) is configured in .env
 * - Provides consistent, high-quality corporate training visuals
 * - Modern model actively maintained by Black Forest Labs
 *
 * DECISION LOG:
 * - Chosen over OpenAI gpt-image-1 (model deprecated, key not configured)
 * - Chosen over DALL-E (requires separate API key, higher costs)
 * - This is a permanent architectural decision, not a temporary workaround
 *
 * @see https://docs.bfl.ml/ - Black Forest Labs API Documentation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BFL_API_ENDPOINT = "https://api.bfl.ml/v1/image";
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes for image generation
const IMAGE_GENERATION_TIMEOUT_MS = 90000; // 90 seconds for Flux to complete
const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 1000;

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

/**
 * Fetch image from URL with retry logic and timeout
 */
async function fetchImageAsDataUrl(
  url: string,
  maxRetries: number = FETCH_RETRY_ATTEMPTS
): Promise<{ imageDataUrl: string; mimeType: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), IMAGE_GENERATION_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Image fetch failed: HTTP ${response.status}`);
      }

      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const imageBuffer = await response.arrayBuffer();
      const imageBase64 = arrayBufferToBase64(imageBuffer);

      return {
        imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
        mimeType,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[Image Fetch] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw new Error(`Image fetch failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Validate BFL API response and extract image URL
 */
function extractImageUrlFromBFLResponse(data: any): string {
  // BFL Flux 2 response structure: { result: { sample: "url" } }
  const imageUrl = data?.result?.sample || data?.result?.images?.[0] || data?.sample;

  if (!imageUrl || typeof imageUrl !== "string") {
    console.error("[BFL Response] Unexpected response structure:", JSON.stringify(data).substring(0, 200));
    throw new Error("BFL image generation returned no image URL in expected format");
  }

  if (!imageUrl.startsWith("http")) {
    throw new Error(`BFL returned invalid image URL: ${imageUrl.substring(0, 50)}`);
  }

  return imageUrl;
}

/**
 * Enhance prompt for better corporate training imagery
 */
function enhancePromptForTraining(
  prompt: string,
  style: string,
  altText: string,
  moduleTitle: string,
  topicTitle: string
): string {
  // Safety: Remove potentially problematic keywords
  const softened = prompt
    .replace(/\b(violence|violent|blood|bloody|injury|weapon|weapons|gun|explosion|fight|attack|hazard|danger|accident|emergency)\b/gi, "workplace safety concern");

  return [
    "Create an original, high-quality AI-generated corporate training image.",
    `Module: ${moduleTitle || "Untitled module"}.`,
    `Topic: ${topicTitle || "Untitled topic"}.`,
    `Visual style: ${style || "realistic-office"}.`,
    `Accessibility description: ${altText || "AI-generated visual for workplace learning."}.`,
    "⚠️ CRITICAL: No logos, no watermarks, no copyrighted characters, no branded products, no visible trademarks, no watermarks.",
    "Use contemporary corporate training aesthetic: diverse people, realistic office lighting, professional composition, polished appearance.",
    "Image should feel suitable for executive presentation or formal training material.",
    "Avoid generic stock photo appearance - aim for authentic, realistic workplace scenario.",
    softened,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Request timeout wrapper
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Parse request
    let requestBody: any;
    try {
      requestBody = await req.json();
    } catch {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { prompt, style, altText, moduleTitle, topicTitle } = requestBody;

    // Validate required fields
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: "prompt is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify API key is configured
    const apiKey = Deno.env.get("BFL_API_KEY");
    if (!apiKey) {
      clearTimeout(timeoutId);
      console.error("[Image Generation] FATAL: BFL_API_KEY environment variable not set");
      return new Response(
        JSON.stringify({
          error: "Image generation service not properly configured. BFL_API_KEY is missing. Please contact administrator.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enhance the prompt for better results
    const enhancedPrompt = enhancePromptForTraining(prompt, style, altText, moduleTitle, topicTitle);

    console.log(`[Image Generation] Starting Flux 2 generation for: "${topicTitle || "untitled"}"`);
    console.log(`[Image Generation] Prompt length: ${enhancedPrompt.length} characters`);

    // Call BFL Flux 2 API
    const bflResponse = await fetch(BFL_API_ENDPOINT, {
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
      signal: controller.signal,
    });

    // Handle specific HTTP errors
    if (bflResponse.status === 429) {
      clearTimeout(timeoutId);
      console.warn("[Image Generation] Rate limited by BFL API");
      return new Response(
        JSON.stringify({
          error: "Image generation rate limited. Please try again in a few moments.",
          retryAfter: 30,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bflResponse.status === 401 || bflResponse.status === 403) {
      clearTimeout(timeoutId);
      console.error("[Image Generation] FATAL: BFL API authentication failed (401/403)");
      return new Response(
        JSON.stringify({
          error: "Image generation authentication failed. BFL_API_KEY is invalid or expired. Please contact administrator.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bflResponse.status === 402) {
      clearTimeout(timeoutId);
      console.error("[Image Generation] BFL account has insufficient credits");
      return new Response(
        JSON.stringify({
          error: "Image generation service out of credits. Please contact administrator.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bflResponse.ok) {
      clearTimeout(timeoutId);
      const errorData = await bflResponse.json().catch(() => ({}));
      console.error(`[Image Generation] BFL API error ${bflResponse.status}:`, errorData);
      throw new Error(
        errorData?.error?.message || errorData?.error || `BFL API returned ${bflResponse.status}`
      );
    }

    // Parse BFL response
    const bflData = await bflResponse.json();
    console.log("[Image Generation] BFL API response received, extracting image URL");

    // Extract image URL from response
    const imageUrl = extractImageUrlFromBFLResponse(bflData);
    console.log("[Image Generation] Image URL extracted, fetching image data");

    // Fetch and convert image to base64 data URL
    const imageResult = await fetchImageAsDataUrl(imageUrl);
    console.log(`[Image Generation] ✓ Success - Image converted to base64 (${imageResult.mimeType})`);

    clearTimeout(timeoutId);
    return new Response(JSON.stringify(imageResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = message.includes("AbortError") || message.includes("timeout");

    console.error(`[Image Generation] ${isTimeout ? "TIMEOUT" : "ERROR"}:`, message);

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? "Image generation timed out. The server took too long to respond. Please try again."
          : `Image generation failed: ${message}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
