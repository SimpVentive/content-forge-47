import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LIVEAVATAR_KEY = Deno.env.get("LIVEAVATAR_API_KEY") ?? "";
const API_KEY =
  Deno.env.get("HEYGEN_API_KEY_ACTIVE") ?? Deno.env.get("HEYGEN_API_KEY") ?? LIVEAVATAR_KEY;

// LiveAvatar authenticates with X-API-KEY; HeyGen uses X-Api-Key.
const authHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { "X-Api-Key": API_KEY };
  if (LIVEAVATAR_KEY) h["X-API-KEY"] = LIVEAVATAR_KEY;
  return h;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!API_KEY) return json({ error: "HEYGEN_API_KEY is not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "status") {
      const videoId = body?.videoId;
      if (!videoId) return json({ error: "videoId is required" }, 400);
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[HeyGen] status error", res.status, JSON.stringify(data));
        return json({ error: data?.message || data?.error || `HeyGen status ${res.status}` }, res.status);
      }
      return json({
        status: data?.data?.status ?? data?.status,
        url: data?.data?.video_url ?? data?.data?.download_url ?? null,
        error: data?.data?.error ?? null,
      });
    }

    // default: generate
    const payload = body?.payload;
    if (!payload) return json({ error: "payload is required" }, 400);

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const msg = data?.error?.message || data?.message || `HeyGen error ${res.status}`;
      console.error("[HeyGen] generate error", res.status, JSON.stringify(data));
      return json({ error: msg }, res.ok ? 400 : res.status);
    }
    const videoId = data?.data?.video_id ?? data?.video_id;
    if (!videoId) return json({ error: "No video_id returned by HeyGen" }, 502);
    console.log("[HeyGen] generate ok", videoId);
    return json({ videoId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[HeyGen] exception", msg);
    return json({ error: msg }, 500);
  }
});
