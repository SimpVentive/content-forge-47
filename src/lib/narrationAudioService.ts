/**
 * Narration Audio Service
 * Generates audio from narration text using ElevenLabs (English) or Google Cloud TTS (Indian languages)
 */

import { supabase } from "@/integrations/supabase/client";

export interface AudioGenerationResult {
  success: boolean;
  audioBase64?: string;
  audioDataUrl?: string;
  error?: string;
}

const INDIAN_LANGUAGES = ["Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu"];

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
 * Generate audio from narration text
 * Uses Google Cloud TTS for Indian languages (proper pronunciation & accent)
 * Uses ElevenLabs for English and other languages
 */
export async function generateNarrationAudio(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM", // Rachel voice (default for English)
  language: string = "English"
): Promise<AudioGenerationResult> {
  try {
    if (!text || text.trim().length === 0) {
      return { success: false, error: "Empty narration text" };
    }

    // Use Google Cloud TTS for Indian languages (better pronunciation & native accents)
    if (INDIAN_LANGUAGES.includes(language)) {
      return await generateNarrationAudioViaGoogleCloud(text.trim(), language);
    }

    // Use ElevenLabs for English and other languages
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
 * Generate audio using Google Cloud Text-to-Speech
 * Supports Indian languages with native accents and correct pronunciation
 */
async function generateNarrationAudioViaGoogleCloud(
  text: string,
  language: string
): Promise<AudioGenerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("google-cloud-tts", {
      body: {
        text,
        language,
      },
    });

    if (error || !data) {
      return {
        success: false,
        error: data?.error || error?.message || "Failed to generate audio via Google Cloud TTS",
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
        error: "No audio data returned from Google Cloud TTS",
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
      error: err instanceof Error ? err.message : "Unknown error with Google Cloud TTS",
    };
  }
}

/**
 * Get voice ID for a given narrator language/accent
 * For English & European languages: maps to ElevenLabs voice ID
 * For Indian languages: returns null (uses Google Cloud TTS instead)
 */
export function getVoiceIdForLanguage(language: string): string | null {
  // Indian languages use Google Cloud TTS, not ElevenLabs
  if (INDIAN_LANGUAGES.includes(language)) {
    return null; // Google Cloud TTS will handle this
  }

  const languageVoiceMap: Record<string, string> = {
    // English voices
    "English": "21m00Tcm4TlvDq8ikWAM", // Rachel
    "en": "21m00Tcm4TlvDq8ikWAM",

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

    // Default
  };

  return languageVoiceMap[language] || "21m00Tcm4TlvDq8ikWAM"; // Default to Rachel
}

/**
 * Check if a language is an Indian language that should use Google Cloud TTS
 */
export function isIndianLanguage(language: string): boolean {
  return INDIAN_LANGUAGES.includes(language);
}
