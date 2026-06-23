/**
 * Narration Audio Service
 * Generates audio from narration text using ElevenLabs TTS
 */

import { supabase } from "@/integrations/supabase/client";

export interface AudioGenerationResult {
  success: boolean;
  audioBase64?: string;
  audioDataUrl?: string;
  error?: string;
}

/**
 * Map voiceover pace to ElevenLabs voice settings
 */
export function getVoiceSettingsForPace(pace: "slow" | "normal" | "fast") {
  switch (pace) {
    case "slow":
      return {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.2,
      };
    case "fast":
      return {
        stability: 0.4,
        similarity_boost: 0.7,
        style: 0.4,
      };
    case "normal":
    default:
      return {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
      };
  }
}

/**
 * Generate audio from narration text using ElevenLabs
 * Returns audio as data URL for direct HTML5 audio player playback
 */
export async function generateNarrationAudio(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM" // Rachel voice (default)
): Promise<AudioGenerationResult> {
  try {
    if (!text || text.trim().length === 0) {
      return { success: false, error: "Empty narration text" };
    }

    const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
      body: {
        text: text.trim(),
        voiceId,
      },
    });

    if (error || !data) {
      return {
        success: false,
        error: data?.error || error?.message || "Failed to generate audio",
      };
    }

    if (data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    if (!data.audioBase64) {
      return {
        success: false,
        error: "No audio data returned from TTS service",
      };
    }

    // Convert base64 to data URL for HTML5 audio player
    const audioDataUrl = `data:audio/mpeg;base64,${data.audioBase64}`;

    return {
      success: true,
      audioBase64: data.audioBase64,
      audioDataUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error generating audio",
    };
  }
}

/**
 * Get voice ID for a given narrator language/accent
 * Maps language to a suitable ElevenLabs voice
 */
export function getVoiceIdForLanguage(language: string): string {
  const languageVoiceMap: Record<string, string> = {
    // English voices
    "English": "21m00Tcm4TlvDq8ikWAM", // Rachel
    "en": "21m00Tcm4TlvDq8ikWAM",

    // Hindi
    "Hindi": "21m00Tcm4TlvDq8ikWAM", // Rachel works for Hindi too
    "hi": "21m00Tcm4TlvDq8ikWAM",

    // Spanish
    "Spanish": "EXAVITQu4vr4xnSDxMaL", // Sarah
    "es": "EXAVITQu4vr4xnSDxMaL",

    // French
    "French": "21m00Tcm4TlvDq8ikWAM", // Rachel
    "fr": "21m00Tcm4TlvDq8ikWAM",

    // German
    "German": "21m00Tcm4TlvDq8ikWAM", // Rachel
    "de": "21m00Tcm4TlvDq8ikWAM",

    // Portuguese
    "Portuguese": "21m00Tcm4TlvDq8ikWAM", // Rachel
    "pt": "21m00Tcm4TlvDq8ikWAM",

    // Tamil
    "Tamil": "21m00Tcm4TlvDq8ikWAM", // Rachel works for Tamil
    "ta": "21m00Tcm4TlvDq8ikWAM",

    // Default
  };

  return languageVoiceMap[language] || "21m00Tcm4TlvDq8ikWAM"; // Default to Rachel
}
