/**
 * HeyGen Video Generation Service
 * Handles avatar video creation with customization options
 */

const HEYGEN_API_URL = "https://api.heygen.com/v1";
const HEYGEN_API_KEY = import.meta.env.VITE_HEYGEN_API_KEY;

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
  rachel: "Rachel_public_3_20240108",
  josh: "josh_lite3_20230714",
  anna: "Daisy-inskirt-20220818",
};

const qualityMap: Record<string, string> = {
  "720p": "low",
  "1080p": "medium",
  "4k": "high",
};

const backgroundMap: Record<string, string> = {
  simple: "simple_white",
  office: "office",
  classroom: "classroom",
};

/**
 * Estimate script duration in seconds (rough estimate: ~150 words per minute)
 */
function estimateScriptDuration(script: string): number {
  const wordCount = script.split(/\s+/).length;
  const minutes = wordCount / 150;
  return Math.ceil(minutes * 60);
}

/**
 * Generate video via HeyGen API
 */
export async function generateHeyGenVideo(params: HeyGenVideoParams): Promise<GeneratedVideo> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY not configured");
  }

  const avatarId = avatarMap[params.avatarId] || params.avatarId;

  const heygenPayload = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text_to_speech",
          input_text: params.script,
          voice_id: params.voiceId,
          speed: 1.0,
        },
        background: {
          type: backgroundMap[params.backgroundStyle] || "office",
        },
      },
    ],
    quality: qualityMap[params.quality] || "medium",
    output_format: "mp4",
  };

  // Add whiteboard overlays if present
  if (params.whiteboard?.enabled && params.whiteboard.diagrams.length > 0) {
    (heygenPayload as any).visual_layers = params.whiteboard.diagrams.map((diagram, index) => ({
      type: "svg_overlay",
      svg_data: diagram.svgContent,
      start_time: diagram.startSeconds,
      duration: diagram.durationSeconds,
      position: "right",
      opacity: 0.95,
    }));
  }

  try {
    const response = await fetch(`${HEYGEN_API_URL}/video_generate`, {
      method: "POST",
      headers: {
        "X-HEYGEN-API-KEY": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(heygenPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`HeyGen API error: ${error.error?.message || response.statusText}`);
    }

    const data = (await response.json()) as any;
    const videoId = data.data?.video_id || data.video_id;

    if (!videoId) {
      throw new Error("No video_id in HeyGen response");
    }

    return {
      videoId,
      videoUrl: "", // Will be filled after polling
      title: params.videoTitle,
      duration: estimateScriptDuration(params.script),
      status: "pending",
    };
  } catch (error) {
    console.error("HeyGen video generation failed:", error);
    throw error;
  }
}

/**
 * Poll HeyGen API for video completion
 */
export async function pollForVideoCompletion(
  videoId: string,
  maxAttempts = 120,
  pollIntervalMs = 5000
): Promise<string> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY not configured");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${HEYGEN_API_URL}/video/${videoId}`, {
        headers: {
          "X-HEYGEN-API-KEY": HEYGEN_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const status = data.data?.status || data.status;

      if (status === "completed") {
        return data.data?.download_url || data.download_url;
      }

      if (status === "failed") {
        throw new Error(`HeyGen video generation failed: ${data.data?.error || "Unknown error"}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error(`Poll attempt ${attempt + 1} failed:`, error);
      if (attempt === maxAttempts - 1) {
        throw new Error("Video generation polling timeout");
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error("Video generation timeout after polling");
}

/**
 * Get video status without waiting
 */
export async function getVideoStatus(videoId: string): Promise<{ status: string; url?: string }> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY not configured");
  }

  const response = await fetch(`${HEYGEN_API_URL}/video/${videoId}`, {
    headers: {
      "X-HEYGEN-API-KEY": HEYGEN_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get video status: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  return {
    status: data.data?.status || data.status,
    url: data.data?.download_url || data.download_url,
  };
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
