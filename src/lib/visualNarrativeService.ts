/**
 * Visual Narrative Service
 * Handles generation and assembly of multi-image narratives for image-based learning
 */

export interface NarrativeScene {
  sceneNumber: number;
  title: string;
  caption: string; // Comic-style text/caption for this scene
  narration: string; // Optional voiceover text
  imagePrompt: string; // Prompt for Flux 2 image generation
  imageDataUrl?: string; // Generated image as base64 data URL
  audioDataUrl?: string; // Audio narration as data URL for HTML5 audio player
  timelinePosition?: number; // Position in overall narrative (0-100%)
}

export interface TopicNarrative {
  topicTitle: string;
  topicObjective: string;
  sceneCount: number;
  scenes: NarrativeScene[];
  totalNarrativeText: string; // Combined narration for all scenes
}

/**
 * Generate scene breakdowns from topic content
 * Input: topic title, objective, and main content
 * Output: Array of scenes with captions and image prompts
 */
export function buildNarrativeScenePrompt(
  topicTitle: string,
  topicObjective: string,
  mainContent: string,
  sceneCount: number,
  learningLevel: string,
  voiceoverEnabled: boolean = false,
  voiceoverPace: "slow" | "normal" | "fast" = "normal"
): string {
  const narrationGuidance = voiceoverEnabled
    ? `\n\nNARRATION REQUIREMENTS (for voiceover):
For each scene, provide a "narration" field with voiceover script.
${voiceoverPace === "slow" ? "Pace: SLOW - Use short sentences (5-8 words max), include pauses for emphasis. Aim for ~80-100 words per minute." : ""}
${voiceoverPace === "normal" ? "Pace: NORMAL - Conversational speed. Aim for ~120-140 words per minute." : ""}
${voiceoverPace === "fast" ? "Pace: FAST - Energetic and concise. Aim for ~160-180 words per minute." : ""}
The narration should complement but not simply repeat the caption. Include context, emphasis, or additional insight.`
    : "";

  return `You are a visual storyboarding expert creating a narrative sequence for corporate training.

Topic: ${topicTitle}
Learning Objective: ${topicObjective}
Content Summary: ${mainContent}
Target Scene Count: ${sceneCount}
Learning Level: ${learningLevel}

Create exactly ${sceneCount} connected scenes that tell a coherent story and teach the topic. Each scene builds on the previous one.

For each scene, provide:
1. Scene title (short, 3-4 words)
2. Visual caption/text that appears with the image (like a comic book panel - 1-2 sentences, conversational, action-oriented)
3. Detailed image prompt for AI generation (specific scene, action, people, setting, mood)
4. Optional narration text (if different from caption)${narrationGuidance}

Format as JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title",
      "caption": "What the learner reads below the image",
      "imagePrompt": "Detailed visual description for Flux 2 image generation",
      "narration": "Optional voiceover script"
    }
  ],
  "narrativeSummary": "Brief overview of the story arc"
}

Requirements:
- Each caption must be conversational and action-oriented (e.g., "She realizes the mistake and takes action")
- Image prompts must be specific and visual (describe people, expressions, settings, objects)
- No text overlays in images - all text comes via captions below
- Scenes should progress logically and build understanding
- Include realistic workplace scenarios, diverse characters, and contemporary settings
- Make it engaging and memorable, like a training comic strip`;
}

/**
 * Build prompts for multi-image generation based on narrative scenes
 */
export function buildImageGenerationPrompts(
  scenes: NarrativeScene[],
  topicTitle: string,
  imageStyle: string,
  aspectRatio: string,
  characterEthnicity?: string
): NarrativeScene[] {
  const ethnicityNameMap: Record<string, string> = {
    indian: "Indian names like Raj, Priya, Amit, Neha, Rohan, Ananya",
    "south-asian": "South Asian names like Arjun, Divya, Adit, Simran",
    "east-asian": "East Asian names like Wei, Yuki, Chen, Lin, Mina",
    african: "African names like Kwame, Zainab, Kofi, Amara",
    caucasian: "Western names like James, Sarah, Michael, Emma",
    "middle-eastern": "Middle Eastern names like Ahmed, Fatima, Rami, Leila",
    latino: "Latino names like Carlos, Maria, Diego, Sofia",
    diverse: ""
  };

  const ethnicityGuidance = characterEthnicity && characterEthnicity !== "diverse"
    ? `CRITICAL: The character MUST have ${characterEthnicity} ethnicity and appearance. Features: predominantly ${characterEthnicity} facial features, skin tone, and cultural styling. Use ${ethnicityNameMap[characterEthnicity] || 'appropriate names for this ethnicity'}. DO NOT generate other ethnicities.`
    : "Diverse mix of ethnicities and cultural backgrounds.";

  return scenes.map((scene, index) => ({
    ...scene,
    imagePrompt: [
      "Create an original, realistic training image for corporate learning.",
      `Topic: ${topicTitle}. Scene ${index + 1}/${scenes.length}: ${scene.title}.`,
      `Scene context: ${scene.caption}`,
      `Visual requirements: ${scene.imagePrompt}`,
      `Style: ${imageStyle}. Aspect ratio: ${aspectRatio}.`,
      ethnicityGuidance,
      "No logos, no watermarks, no copyrighted content. Use authentic corporate/workplace aesthetics.",
      "Realistic emotions, contemporary setting, professional composition.",
    ].join(" "),
  }));
}

/**
 * Create a title slide/scene as the first scene of the narrative
 * This ensures the course title is displayed prominently at the beginning
 */
export function createTitleSlide(courseTitle: string, courseObjective?: string): NarrativeScene {
  return {
    sceneNumber: 0,
    title: "Course Title",
    caption: courseTitle,
    narration: courseObjective || `Welcome to ${courseTitle}. This course will help you master the key concepts and skills you need to succeed.`,
    imagePrompt: `Create a professional, welcoming title slide image for corporate training.
      Title: "${courseTitle}"
      Style: Modern, clean, professional aesthetic with a gradient or subtle background.
      Include warm, inviting imagery that represents learning and growth.
      Professional composition, contemporary design, diverse representation.
      No text overlays - the title will be added separately.
      High quality, inspiring, corporate training material.`,
    imageDataUrl: undefined,
    audioDataUrl: undefined,
    timelinePosition: 0,
  };
}

/**
 * Prepend title slide to narrative scenes
 */
export function prependTitleSlideToNarratives(
  narratives: TopicNarrative[],
  courseTitle: string,
  courseObjective?: string
): TopicNarrative[] {
  if (!narratives || narratives.length === 0) return narratives;

  const titleScene = createTitleSlide(courseTitle, courseObjective);

  // Add title as the first scene of the first narrative
  const updatedNarratives = [...narratives];
  updatedNarratives[0] = {
    ...updatedNarratives[0],
    scenes: [titleScene, ...updatedNarratives[0].scenes],
    sceneCount: updatedNarratives[0].sceneCount + 1,
  };

  return updatedNarratives;
}

/**
 * Estimate credit usage for multi-image narrative generation
 */
export function estimateNarrativeImageCredits(
  sceneCount: number,
  imageQuality: string
): number {
  const baseCreditsPerImage = 10; // Flux 2 credits per image
  const qualityMultiplier: Record<string, number> = {
    "low": 0.8,
    "medium": 1.0,
    "high": 1.2,
  };

  return Math.ceil(sceneCount * baseCreditsPerImage * (qualityMultiplier[imageQuality] || 1.0));
}

/**
 * Validate narrative scenes before output generation
 */
export function validateNarrativeScenes(scenes: NarrativeScene[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(scenes) || scenes.length === 0) {
    errors.push("No scenes provided");
    return { valid: false, errors };
  }

  scenes.forEach((scene, index) => {
    if (!scene.title || scene.title.trim().length === 0) {
      errors.push(`Scene ${index + 1}: Missing title`);
    }
    if (!scene.caption || scene.caption.trim().length === 0) {
      errors.push(`Scene ${index + 1}: Missing caption`);
    }
    if (!scene.imagePrompt || scene.imagePrompt.trim().length === 0) {
      errors.push(`Scene ${index + 1}: Missing image prompt`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate visual narrative instruction for Claude to break down a topic into scenes
 */
export function getVisualNarrativeAgentInstructions(): string {
  return `You are an expert instructional designer and visual storyboarding specialist. Your job is to take training content and break it into a cohesive narrative sequence that can be illustrated.

Key principles:
1. Story Arc: Each scene should build toward understanding, not just repeat information
2. Visual Clarity: Describe scenes in vivid, specific details (not abstract concepts)
3. Conversational Tone: Captions feel like dialogue in a training comic book
4. Diverse Representation: Include different people, backgrounds, and perspectives
5. Realistic Scenarios: Ground content in actual workplace situations learners will recognize
6. Progressive Complexity: Start simple, build to more nuanced understanding

For each topic, generate EXACTLY the requested number of scenes. Each scene must:
- Have a clear, specific visual moment (not a concept or abstract idea)
- Include 2-4 people or characters when appropriate
- Show action, emotion, or reaction (not static instruction)
- Build on the previous scene's narrative
- Lead toward the learning objective

Output format: Structured JSON with scenes array, where each scene contains:
- sceneNumber: Position in sequence
- title: Short descriptive title
- caption: What appears below the image (1-2 sentences, conversational, action-focused)
- imagePrompt: Detailed visual description for AI generation
- narration: Optional additional voiceover`;
}
