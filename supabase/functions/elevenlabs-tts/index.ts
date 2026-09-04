import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId } = await req.json();
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ElevenLabs");

    if (!apiKey) {
      console.error("[ElevenLabs TTS] ElevenLabs API key environment variable not set");
      return new Response(JSON.stringify({ error: "ElevenLabs API key is not configured in backend secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Text parameter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || "21m00Tcm4TlvDq8ikWAM"}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ElevenLabs TTS] API error: ${response.status}`, errText);

      const isBilling = response.status === 401 || response.status === 402;
      const message = isBilling
        ? "ElevenLabs: Invalid API key or insufficient credits. Check ELEVENLABS_API_KEY and account balance."
        : `ElevenLabs API error: ${response.status} ${response.statusText}`;

      return new Response(JSON.stringify({
        error: message,
        status: response.status,
        details: errText,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (parseErr) {
      console.error("[ElevenLabs TTS] Failed to parse JSON response");
      const text = await response.text();
      return new Response(JSON.stringify({
        error: "ElevenLabs returned invalid JSON",
        details: text.substring(0, 500),
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload?.audio_base64) {
      console.error("[ElevenLabs TTS] Response missing audio_base64", Object.keys(payload || {}));
      return new Response(JSON.stringify({
        error: "ElevenLabs response missing audio payload",
        received_keys: Object.keys(payload || {}),
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ElevenLabs TTS] ✅ Generated audio (${text.length} chars) with voice ${voiceId || "default"}`);

    return new Response(JSON.stringify({
      audioBase64: payload.audio_base64,
      alignment: payload.alignment || null,
      normalizedAlignment: payload.normalized_alignment || null,
      voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM",
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
