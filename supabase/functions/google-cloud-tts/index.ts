import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TTSRequest {
  text: string;
  language: string;
}

interface TTSResponse {
  audioBase64?: string;
  error?: string;
}

// Language to Google Cloud TTS language code mapping
const LANGUAGE_CODE_MAP: Record<string, string> = {
  "Hindi": "hi-IN",
  "Tamil": "ta-IN",
  "Telugu": "te-IN",
  "Kannada": "kn-IN",
  "Malayalam": "ml-IN",
  "Bengali": "bn-IN",
  "Marathi": "mr-IN",
  "Gujarati": "gu-IN",
  "Punjabi": "pa-IN",
  "Urdu": "ur-PK",
};

// Language to voice name mapping (Google Cloud TTS voice names)
const VOICE_NAME_MAP: Record<string, string> = {
  "hi-IN": "hi-IN-Neural2-A", // Female voice
  "ta-IN": "ta-IN-Neural2-A", // Female voice
  "te-IN": "te-IN-Neural2-A", // Female voice
  "kn-IN": "kn-IN-Neural2-A", // Female voice
  "ml-IN": "ml-IN-Neural2-A", // Female voice
  "bn-IN": "bn-IN-Neural2-A", // Female voice
  "mr-IN": "mr-IN-Neural2-A", // Female voice
  "gu-IN": "gu-IN-Neural2-A", // Female voice
  "pa-IN": "pa-IN-Neural2-A", // Female voice
  "ur-PK": "ur-PK-Neural2-A", // Female voice
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, language }: TTSRequest = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Empty text provided" } as TTSResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!language || !LANGUAGE_CODE_MAP[language]) {
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${language}` } as TTSResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleApiKey = Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY");
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "Google Cloud TTS API key not configured" } as TTSResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageCode = LANGUAGE_CODE_MAP[language];
    const voiceName = VOICE_NAME_MAP[languageCode];

    if (!voiceName) {
      return new Response(
        JSON.stringify({ error: `No voice available for language: ${language}` } as TTSResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Google Cloud Text-to-Speech API
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
      },
      body: JSON.stringify({
        input: { text: text.trim() },
        voice: {
          languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          pitch: 0.0,
          speakingRate: 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Cloud TTS error:", errorData);
      return new Response(
        JSON.stringify({ error: `Google Cloud TTS error: ${errorData?.error?.message || "Unknown error"}` } as TTSResponse),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (!data.audioContent) {
      return new Response(
        JSON.stringify({ error: "No audio content returned from Google Cloud TTS" } as TTSResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ audioBase64: data.audioContent } as TTSResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in google-cloud-tts function:", error);
    return new Response(
      JSON.stringify({ error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}` } as TTSResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
