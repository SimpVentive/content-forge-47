/**
 * Video Mode Service
 * Handles mode-specific instructions for agents and video generation logic
 */

export type VideoMode = "static_elearning" | "video_learning" | "image_based_learning" | "sop_video";

// Map image_based_learning to static_elearning for instruction lookup
function normalizeMode(mode: VideoMode): "static_elearning" | "video_learning" | "sop_video" {
  if (mode === "image_based_learning") return "static_elearning";
  return mode as "static_elearning" | "video_learning" | "sop_video";
}

export interface AgentModeInstructions {
  agentName: string;
  mode: VideoMode;
  instructions: string;
}

/**
 * Get mode-specific instructions for each agent
 */
export function getAgentModeInstructions(agentName: string, mode: VideoMode): string {
  const normalizedMode = normalizeMode(mode);
  const instructions: Record<string, Record<string, string>> = {
    research: {
      static_elearning:
        "Extract deep, detailed learning content from source material. Prioritize comprehensive coverage of concepts, nuances, edge cases, and expert insights. Identify rich scenarios, misconceptions, and evidence. Build a foundation for text-heavy, detailed instructional content.",
      video_learning:
        "Extract video-friendly learning content: compelling hooks, memorable examples, key decision moments, and engaging scenarios. Prioritize narrative potential, visual anchors, and content that translates well to short video segments (4-8 min). Focus on what learners will remember visually.",
      sop_video:
        "Extract procedural and operational content: step-by-step processes, decision trees, hazard points, and equipment operations. Identify visual checkpoints, whiteboard moments, and critical decision branches. Prioritize sequential clarity and safety-critical information.",
    },
    architect: {
      static_elearning:
        "Design a comprehensive course structure with deep topic treatments. Create modules (4-6 topics each) with rich learning objectives, complex scenarios, and layered explanations. Prioritize breadth and depth with room for elaboration, examples, and nuanced discussion. Allow 120-180 words per topic.",
      video_learning:
        "Design a video-optimized course structure with shorter modules (2-3 topics each, 4-8 min videos). Focus on narrative arc, visual storytelling, and avatar engagement. Each topic should have a single clear learning point with a hook, explanation, and memorable takeaway. Minimize text-heavy content.",
        sop_video:
        "Design a procedural course structure organized by process steps. Create logical sequences with decision branches where applicable. Structure as discrete video segments (3-5 min each) covering procedural steps, equipment operations, or hazard protocols. Include whiteboard/diagram moments for complex steps.",
    },
    writer: {
      static_elearning:
        "Write slide narration text for e-learning content. Each topic should have 120-180 words of clear, concise narration suitable for an avatar voiceover. Format as natural speech with pauses indicated by [PAUSE 2s]. Include detailed explanations, multiple examples, and deeper exploration.",
      video_learning:
        'Write a professional video script for course content. Include these markers:\n[VIDEO CUE: description] - visual moment\n[ACTION: avatar action] - what the avatar is doing\n[PAUSE 2s] - pause duration\nEnsure 4-8 minutes per video segment with natural pacing, conversational tone, and visual narrative flow.',
      sop_video:
        'Write procedural steps for a Standard Operating Procedure (SOP) video. Each step should include:\n- Clear instruction text\n- [ACTION: action description]\n- [WHITEBOARD: diagram needed? yes/no]\n- [DIAGRAM TYPE: if yes, specify: flowchart, hazard, decision-tree, equipment-diagram]\n- [PAUSE 3s] for whiteboard explanation\nEnsure logical flow with decision branches where applicable.',
    },
    visual_design: {
      static_elearning:
        "Design complex infographic SVG assets for individual slides. Create detailed diagrams, charts, illustrations, and visual explainers. Prioritize information density, professional aesthetics, and support for deep explanations. Output: SVG code with inline styles. Colors: #4f46e5, #0891b2, #6b7280.",
      video_learning:
        "Design visual storyboards and scene backgrounds for video segments. For each scene, specify: background environment, avatar position, visual elements, and on-screen graphics. Ensure visual consistency, uncluttered backgrounds, and graphics that enhance (not distract from) the avatar. Optimize for 1080p video.",
      sop_video:
        'Design whiteboard diagrams and procedural visuals for SOP steps. Output as JSON:\n{\n  "step_title": "Step name",\n  "needs_whiteboard": true/false,\n  "diagram_type": "flowchart|hazard|decision-tree|equipment-diagram",\n  "diagram_spec": "detailed SVG specification or diagram description",\n  "estimated_duration_seconds": 20\n}\nDiagrams must be clear, safety-focused, and support learning objectives.',
    },
    animation: {
      static_elearning:
        "Write detailed animation and interaction notes for slide-based e-learning. Specify entrance animations, emphasis effects, hover interactions, and quiz/scenario branching logic. Create a rich interactive experience with progressive disclosure of content.",
      video_learning:
        "Write animation notes focused on avatar movement, scene transitions, text overlays, and graphic animations within video segments. Specify timing for avatar actions, camera pans, and on-screen graphics. Prioritize visual flow that complements the narration without overwhelming it.",
      sop_video:
        "Write animation and visualization notes for procedural steps, whiteboard drawings, equipment highlights, and visual decision trees. Specify step-by-step visual progression, pause points for explanation, and emphasis on critical safety moments.",
    },
    youtube: {
      static_elearning:
        "Search for supplementary educational videos that provide detailed explanations, expert insights, case studies, and comprehensive coverage of topics. Prioritize longer, in-depth videos (10-30 min) from educational institutions and domain experts.",
      video_learning:
        "Search for short, engaging video clips and examples that support video narrative moments. Prioritize compelling real-world examples, scenario demonstrations, and visual explanations (3-8 min). Focus on content that enhances the avatar-led narrative.",
      sop_video:
        "Search for procedural demonstration videos, equipment operation tutorials, and safety training content. Prioritize step-by-step instructional videos and expert demonstrations that directly support operational procedures.",
    },
    compliance: {
      static_elearning:
        "Review comprehensive e-learning content for reading level, inclusive language, accessibility for detailed text, and policy alignment. Ensure content supports detailed explanations and complex scenarios while maintaining compliance.",
      video_learning:
        "Review video script and visual design for accessibility (captions, audio descriptions), inclusive language, and policy alignment. Ensure video content is accessible to diverse learners and compliant with video accessibility standards.",
      sop_video:
        "Review procedural content for safety compliance, clear instructions, hazard communication, and regulatory alignment (OSHA, etc.). Verify that safety-critical information is prominent and unambiguous.",
    },
    assessment: {
      static_elearning:
        "Design comprehensive assessment with higher-order thinking questions. Create scenario-based questions requiring analysis and synthesis. Include case studies, complex decision-making exercises, and reflective prompts. Distribute assessments throughout course for deeper learning verification.",
      video_learning:
        "Design bite-sized assessments optimized for video pacing. Create quick knowledge checks, scenario-based decisions, and moment-of-learning quizzes that fit within or between video segments. Prioritize memorable decision points and immediate feedback.",
      sop_video:
        "Design procedural verification assessments. Create checklists, step-sequence ordering exercises, hazard identification tasks, and decision-point scenarios. Verify learners can execute procedures correctly and identify critical safety moments.",
    },
    voice_narration: {
      static_elearning:
        'Generate text-to-speech narration with detailed explanations. Output format:\n{\n  "text": "narration text",\n  "duration_seconds": 120-180,\n  "voice_id": "selected voice",\n  "speed": 1.0,\n  "emphasis_markers": ["key terms"]\n}',
      video_learning:
        'Generate TTS narration synchronized with video script. For each [ACTION] marker, provide precise timing:\n{\n  "text": "narration",\n  "start_second": 0,\n  "duration_seconds": 30-60,\n  "voice_id": "voice",\n  "emotional_tone": "professional/friendly/engaging"\n}',
      sop_video:
        'Generate TTS for each SOP step with pause timing for whiteboard. Output:\n{\n  "step_number": 1,\n  "narration_text": "step instructions",\n  "narration_duration": 15-30,\n  "whiteboard_pause": 20-40,\n  "total_duration": 40-60,\n  "voice_id": "rachel",\n  "safety_emphasis": false\n}',
    },
    assembly: {
      static_elearning:
        "Package a comprehensive e-learning course with detailed outlines, complete scripts, rich assessments, and visual assets. Include SCORM/xAPI manifest with all components. Prepare LMS deployment checklist for standard e-learning systems.",
      video_learning:
        "Package a video-based course with video files, synchronized scripts, quick-check assessments, and scene graphics. Include video manifest with timing and sequencing. Prepare deployment checklist for video-enabled LMS or standalone video platform.",
      sop_video:
        "Package an SOP video course with video files, procedural checklists, visual diagrams, and competency assessments. Include equipment and hazard reference materials. Prepare compliance documentation and deployment checklist for training platforms.",
    },
  };

  return (
    instructions[agentName]?.[normalizedMode] ||
    `Generate content in ${normalizedMode} format for ${agentName}. Follow best practices for the selected learning mode.`
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
