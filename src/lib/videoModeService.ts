/**
 * Video Mode Service
 * Handles mode-specific instructions for agents and video generation logic
 */

export type VideoMode = "static_elearning" | "video_learning" | "sop_video";

export interface AgentModeInstructions {
  agentName: string;
  mode: VideoMode;
  instructions: string;
}

/**
 * Get mode-specific instructions for each agent
 */
export function getAgentModeInstructions(agentName: string, mode: VideoMode): string {
  const instructions: Record<string, Record<VideoMode, string>> = {
    writer: {
      static_elearning:
        "Write slide narration text for e-learning content. Each topic should have 120-180 words of clear, concise narration suitable for an avatar voiceover. Format as natural speech with pauses indicated by [PAUSE 2s].",
      video_learning:
        'Write a professional video script for course content. Include these markers:\n[VIDEO CUE: description] - visual moment\n[ACTION: avatar action] - what the avatar is doing\n[PAUSE 2s] - pause duration\nEnsure 4-8 minutes per video segment with natural pacing.',
      sop_video:
        'Write procedural steps for a Standard Operating Procedure (SOP) video. Each step should include:\n- Clear instruction text\n- [ACTION: action description]\n- [WHITEBOARD: diagram needed? yes/no]\n- [DIAGRAM TYPE: if yes, specify: flowchart, hazard, decision-tree, equipment-diagram]\n- [PAUSE 3s] for whiteboard explanation\nEnsure logical flow with decision branches where applicable.',
    },
    visual_design: {
      static_elearning:
        "Design infographic SVG assets for individual slides. Create clear, visually appealing diagrams, charts, and illustrations. Output: SVG code with inline styles. Colors: #4f46e5 (primary), #0891b2 (secondary), #6b7280 (text).",
      video_learning:
        "Design detailed storyboard frames for video scenes. For each scene, specify:\n- Background environment description\n- Avatar position and gestures\n- Visual elements (charts, text, animations)\n- Timing and transitions\nEnsure visual consistency across all frames.",
      sop_video:
        'Design whiteboard diagrams for SOP steps. Output as JSON:\n{\n  "step_title": "Step name",\n  "needs_whiteboard": true/false,\n  "diagram_type": "flowchart|hazard|decision-tree|equipment-diagram",\n  "diagram_spec": "detailed SVG specification or ASCII diagram description",\n  "estimated_duration_seconds": 20\n}\nDiagrams must be clear and support learning objectives.',
    },
    voice_narration: {
      static_elearning:
        'Generate text-to-speech narration with timing cues. Output format:\n{\n  "text": "narration text",\n  "duration_seconds": 45,\n  "voice_id": "selected voice",\n  "speed": 1.0\n}',
      video_learning:
        'Generate TTS narration synchronized with video script. For each [ACTION] marker, provide precise timing:\n{\n  "text": "narration",\n  "start_second": 0,\n  "duration_seconds": 30,\n  "voice_id": "voice",\n  "emotional_tone": "professional/friendly/urgent"\n}',
      sop_video:
        'Generate TTS for each SOP step with pause timing for whiteboard. Output:\n{\n  "step_number": 1,\n  "narration_text": "step instructions",\n  "narration_duration": 15,\n  "whiteboard_pause": 20,\n  "total_duration": 35,\n  "voice_id": "rachel"\n}',
    },
  };

  return (
    instructions[agentName]?.[mode] ||
    `Generate content in ${mode} format for ${agentName}. Follow best practices for video content creation.`
  );
}

/**
 * Calculate SOP video granularity based on total duration
 */
export interface VideoGranularity {
  videoCount: number;
  strategy: "single_file" | "sections" | "steps";
  targetMinutesPerVideo: number;
}

export function calculateVideoGranularity(sopDurationMinutes: number): VideoGranularity {
  if (sopDurationMinutes <= 10) {
    return {
      videoCount: 1,
      strategy: "single_file",
      targetMinutesPerVideo: sopDurationMinutes,
    };
  }

  if (sopDurationMinutes <= 20) {
    const videoCount = Math.ceil(sopDurationMinutes / 7);
    return {
      videoCount,
      strategy: "sections",
      targetMinutesPerVideo: 7,
    };
  }

  // > 20 minutes
  const videoCount = Math.ceil(sopDurationMinutes / 4);
  return {
    videoCount,
    strategy: "steps",
    targetMinutesPerVideo: 4,
  };
}

/**
 * Group SOP steps into video chunks based on granularity
 */
export interface VideoChunk {
  chunkIndex: number;
  title: string;
  steps: Array<{
    stepNumber: number;
    title: string;
    narration: string;
    needsWhiteboard: boolean;
    diagramType?: "flowchart" | "hazard" | "decision-tree" | "equipment-diagram";
    diagramSvg?: string;
    estimatedSeconds: number;
  }>;
  estimatedTotalSeconds: number;
}

export function groupStepsIntoChunks(
  steps: any[],
  videoCount: number
): VideoChunk[] {
  const chunks: VideoChunk[] = [];
  const stepsPerChunk = Math.ceil(steps.length / videoCount);

  for (let i = 0; i < videoCount; i++) {
    const startIdx = i * stepsPerChunk;
    const endIdx = Math.min(startIdx + stepsPerChunk, steps.length);
    const chunkSteps = steps.slice(startIdx, endIdx);

    const totalSeconds = chunkSteps.reduce((sum: number, step: any) => sum + (step.estimatedSeconds || 60), 0);

    chunks.push({
      chunkIndex: i + 1,
      title: `Video ${i + 1}: ${chunkSteps[0]?.title || "Introduction"} to ${chunkSteps[chunkSteps.length - 1]?.title || "Conclusion"}`,
      steps: chunkSteps,
      estimatedTotalSeconds: totalSeconds,
    });
  }

  return chunks;
}

/**
 * Validate video settings before generation
 */
export interface VideoSettings {
  selectedAvatar: string;
  videoQuality: "720p" | "1080p" | "4k";
  backgroundStyle: "simple" | "office" | "classroom";
}

export function validateVideoSettings(settings: VideoSettings): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!settings.selectedAvatar) {
    errors.push("Avatar selection is required");
  }

  if (!["720p", "1080p", "4k"].includes(settings.videoQuality)) {
    errors.push("Invalid video quality selection");
  }

  if (!["simple", "office", "classroom"].includes(settings.backgroundStyle)) {
    errors.push("Invalid background style selection");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimate total credits needed for video generation
 */
export function estimateVideoCredits(
  videoMode: "video_learning" | "sop_video",
  videoCount: number,
  avgDurationMinutes: number,
  quality: "720p" | "1080p" | "4k"
): number {
  const baseCreditsPerVideo = 25;
  const qualityMultiplier: Record<string, number> = {
    "720p": 0.8,
    "1080p": 1.0,
    "4k": 1.5,
  };

  const sopMultiplier = videoMode === "sop_video" ? 1.2 : 1.0; // SOP with whiteboard costs 20% more

  return Math.ceil(baseCreditsPerVideo * videoCount * qualityMultiplier[quality] * sopMultiplier);
}
