/**
 * HeyGen Video Generation Service
 * All calls go through the `heygen-video` edge function (the browser cannot
 * call api.heygen.com directly: CORS + the API key must stay server-side).
 */

import { supabase } from "@/integrations/supabase/client";

export interface HeyGenVideoParams {
  avatarId: "rachel" | "josh" | "anna" | string;
  script: string;
  voiceId: string;
  backgroundStyle: "simple" | "office" | "classroom";
  quality: "720p" | "1080p" | "4k";
  whiteboard?: {
    enabled: boolean;
    diagrams: Array<{
      svgContent: string;
      startSeconds: number;
      durationSeconds: number;
    }>;
  };
  videoTitle: string;
}

export interface GeneratedVideo {
  videoId: string;
  videoUrl: string;
  title: string;
  duration: number;
  status: "pending" | "processing" | "ready" | "failed";
}

const avatarMap: Record<string, string> = {
  rachel: "Anna_public_3_20240108",
  anna: "Anna_public_20240108",
  josh: "Aditya_public_1",
};

const resolutionMap: Record<string, string> = {
  "720p": "720p",
  "1080p": "1080p",
  "4k": "1080p", // v3 caps avatar renders at 1080p
};


const backgroundMap: Record<string, string> = {
  simple: "#f5f5f5",
  office: "#e8eef7",
  classroom: "#eef7ee",
};

const DEFAULT_VOICE_ID = "44c2584dd48f46b7bce9b66c8bf086e0";

function estimateScriptDuration(script: string): number {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.ceil((wordCount / 150) * 60));
}

async function callFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("heygen-video", { body });
  if (error) {
    // Surface the function's own error message when available
    const detail = (data as any)?.error;
    throw new Error(detail || error.message || "HeyGen request failed");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/**
 * Generate video via HeyGen (through the edge function)
 */
export async function generateHeyGenVideo(params: HeyGenVideoParams): Promise<GeneratedVideo> {
  const script = (params.script || "").trim();
  if (!script) throw new Error("Empty narration script — nothing to render");

  const avatarId = avatarMap[params.avatarId] || params.avatarId;
  const resolution = resolutionMap[params.quality] || "1080p";

  const payload = {
    type: "avatar",
    title: params.videoTitle?.slice(0, 100) || "Course video",
    avatar_id: avatarId,
    script: script.slice(0, 4500),
    voice_id: params.voiceId || DEFAULT_VOICE_ID,
    aspect_ratio: "16:9",
    resolution,
    background: {
      type: "color",
      value: backgroundMap[params.backgroundStyle] || backgroundMap.office,
    },
  };

  const { videoId } = await callFunction<{ videoId: string }>({ action: "generate", payload });


  return {
    videoId,
    videoUrl: "",
    title: params.videoTitle,
    duration: estimateScriptDuration(script),
    status: "pending",
  };
}

/**
 * Poll for video completion
 */
export async function pollForVideoCompletion(
  videoId: string,
  maxAttempts = 120,
  pollIntervalMs = 5000
): Promise<string> {
  let lastError = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await getVideoStatus(videoId);
      if (res.status === "completed" && res.url) return res.url;
      if (res.status === "failed") {
        throw new Error(`HeyGen video generation failed: ${res.error || "Unknown error"}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError.startsWith("HeyGen video generation failed")) throw error;
      console.error(`Poll attempt ${attempt + 1} failed:`, lastError);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Video generation timed out${lastError ? ` (${lastError})` : ""}`);
}

/**
 * Get video status without waiting
 */
export async function getVideoStatus(
  videoId: string
): Promise<{ status: string; url?: string | null; error?: string | null }> {
  return await callFunction<{ status: string; url?: string | null; error?: string | null }>({
    action: "status",
    videoId,
  });
}

/**
 * Calculate SOP video granularity based on duration
 */
export function calculateVideoGranularity(sopDurationMinutes: number) {
  if (sopDurationMinutes <= 10) {
    return {
      videoCount: 1,
      strategy: "single_file" as const,
      targetMinutesPerVideo: sopDurationMinutes,
    };
  }

  if (sopDurationMinutes <= 20) {
    const videoCount = Math.ceil(sopDurationMinutes / 7);
    return {
      videoCount,
      strategy: "sections" as const,
      targetMinutesPerVideo: 7,
    };
  }

  const videoCount = Math.ceil(sopDurationMinutes / 4);
  return {
    videoCount,
    strategy: "steps" as const,
    targetMinutesPerVideo: 4,
  };
}
