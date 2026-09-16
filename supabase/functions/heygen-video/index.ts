import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Prefer the newest key, fall back to older ones.
const API_KEY =
  Deno.env.get("HEYGEN_API_KEY_V3") ??
  Deno.env.get("HEYGEN_API_KEY_ACTIVE") ??
  Deno.env.get("HEYGEN_API_KEY") ??
  "";

const authHeaders = (): Record<string, string> => ({ "X-Api-Key": API_KEY });

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
    if (!API_KEY) return json({ error: "Video service API key is not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "status") {
      const videoId = body?.videoId;
      if (!videoId) return json({ error: "videoId is required" }, 400);

      const res = await fetch(
        `https://api.heygen.com/v3/videos/${encodeURIComponent(videoId)}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[HeyGen v3] status error", res.status, JSON.stringify(data));
        return json(
          { error: data?.error?.message || data?.message || `Status request failed (${res.status})` },
          res.status
        );
      }
      const d = data?.data ?? data;
      return json({
        status: d?.status,
        url: d?.video_url ?? d?.captioned_video_url ?? null,
        error: d?.error?.message ?? d?.error ?? null,
      });
    }

    // default: generate
    const payload = body?.payload;
    if (!payload) return json({ error: "payload is required" }, 400);

    const res = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.error) {
      const code = data?.error?.code;
      let msg = data?.error?.message || data?.message || `Video request failed (${res.status})`;
      if (code === "insufficient_credit" || res.status === 402) {
        msg =
          "Your video account has no credits left. Top up the balance on the account that owns this API key, then try again.";
      }
      console.error("[HeyGen v3] generate error", res.status, JSON.stringify(data));
      return json({ error: msg }, res.ok ? 400 : res.status);
    }

    const videoId = data?.data?.video_id ?? data?.video_id ?? data?.data?.id ?? data?.id;
    if (!videoId) return json({ error: "No video id returned by the video service" }, 502);

    console.log("[HeyGen v3] generate ok", videoId);
    return json({ videoId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[HeyGen v3] exception", msg);
    return json({ error: msg }, 500);
  }
});
