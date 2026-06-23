/**
 * Credit Estimation Engine
 * Analyzes user requirements and estimates credits needed for generation
 */

export interface CreditEstimate {
  learningType: "image" | "video" | "static";
  totalCredits: number;
  breakdown: {
    component: string;
    quantity: number;
    rate: number;
    subtotal: number;
  }[];
  summary: string;
  estimatedMinutes?: number;
  estimatedTopics?: number;
}

// Credit rates (must match CREDITS_PRICING_SYSTEM.md)
const CREDITS_PER_IMAGE = 9;
const CREDITS_PER_ELEARNING_MINUTE = 12;
const CREDITS_PER_VIDEO_MINUTE = 83;

/**
 * Estimate word count from text input
 * Assumes average 5 words per line
 */
function estimateWordCount(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(words, 100);
}

/**
 * Estimate number of topics/modules from text
 * Uses heuristics like section markers, line breaks, etc.
 */
function estimateTopicCount(text: string): number {
  // Count common topic markers
  const moduleMarkers = (text.match(/module|^#+\s|^##\s/gim) || []).length;
  const topicMarkers = (text.match(/topic|lesson|section|^###\s/gim) || []).length;

  // Fallback: estimate based on paragraph density
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20).length;

  const estimate = Math.max(
    Math.ceil(paragraphs / 2), // Assume ~2 paragraphs per topic
    Math.max(moduleMarkers, topicMarkers || 3)
  );

  return Math.min(Math.max(estimate, 1), 50); // Clamp between 1-50 topics
}

/**
 * Estimate duration in minutes from word count
 * Based on narration speed: 130 words per minute
 */
function estimateDurationMinutes(wordCount: number): number {
  const WORDS_PER_MINUTE = 130;
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

/**
 * Estimate images per topic (for image-based courses)
 * Typically 2-3 images per topic
 */
function estimateImagesPerTopic(): number {
  return 2; // Conservative estimate
}

/**
 * Estimate credits for IMAGE-BASED learning
 */
export function estimateImageCredits(text: string): CreditEstimate {
  const topics = estimateTopicCount(text);
  const imagesPerTopic = estimateImagesPerTopic();
  const totalImages = topics * imagesPerTopic;

  const claudeTokens = totalImages * 500; // 500 tokens per image for script
  const imageGenerationCredits = totalImages * CREDITS_PER_IMAGE;

  // Rough conversion: 1 token ≈ ₹0.083 / 1000, but we'll account in main credits
  // Each image also has narration which we include in the image cost

  return {
    learningType: "image",
    totalCredits: imageGenerationCredits,
    breakdown: [
      {
        component: "AI-Generated Images",
        quantity: totalImages,
        rate: CREDITS_PER_IMAGE,
        subtotal: imageGenerationCredits,
      },
    ],
    summary: `${topics} topics × ${imagesPerTopic} images = ${totalImages} images`,
    estimatedTopics: topics,
  };
}

/**
 * Estimate credits for E-LEARNING (static, SCORM)
 */
export function estimateStaticELearningCredits(text: string): CreditEstimate {
  const wordCount = estimateWordCount(text);
  const topics = estimateTopicCount(text);
  const durationMinutes = estimateDurationMinutes(wordCount);

  // E-learning is priced per minute but we estimate more conservatively
  // Account for assessments, interactivity, packaging
  const estimatedMinutes = Math.max(
    durationMinutes,
    Math.ceil(topics / 1.5) // Fallback: ~1.5 min per topic
  );

  const totalCredits = estimatedMinutes * CREDITS_PER_ELEARNING_MINUTE;

  return {
    learningType: "static",
    totalCredits,
    breakdown: [
      {
        component: "E-Learning Content",
        quantity: estimatedMinutes,
        rate: CREDITS_PER_ELEARNING_MINUTE,
        subtotal: totalCredits,
      },
    ],
    summary: `~${estimatedMinutes} minutes of learning content (${wordCount} words, ${topics} topics)`,
    estimatedMinutes,
    estimatedTopics: topics,
  };
}

/**
 * Estimate credits for VIDEO learning (HeyGen)
 */
export function estimateVideoCredits(text: string): CreditEstimate {
  const wordCount = estimateWordCount(text);
  const topics = estimateTopicCount(text);
  const durationMinutes = estimateDurationMinutes(wordCount);

  // Video is expensive, so estimate conservatively
  // Typically 1.5-2 min per topic
  const estimatedMinutes = Math.max(
    durationMinutes,
    Math.ceil(topics * 1.5)
  );

  const totalCredits = estimatedMinutes * CREDITS_PER_VIDEO_MINUTE;

  return {
    learningType: "video",
    totalCredits,
    breakdown: [
      {
        component: "HeyGen Video Generation",
        quantity: estimatedMinutes,
        rate: CREDITS_PER_VIDEO_MINUTE,
        subtotal: totalCredits,
      },
    ],
    summary: `~${estimatedMinutes} minutes of AI avatar video (${wordCount} words, ${topics} topics)`,
    estimatedMinutes,
    estimatedTopics: topics,
  };
}

/**
 * Main estimation function - routes to appropriate format
 */
export function estimateCredits(
  text: string,
  learningType: "image" | "video" | "static",
  durationMinutes?: number
): CreditEstimate {
  if (durationMinutes !== undefined && (learningType === "video" || learningType === "static")) {
    // Use explicit duration if provided for video and static learning
    const rate = learningType === "video" ? CREDITS_PER_VIDEO_MINUTE : CREDITS_PER_ELEARNING_MINUTE;
    const totalCredits = durationMinutes * rate;
    const summary = learningType === "video"
      ? `~${durationMinutes} minutes of AI avatar video`
      : `~${durationMinutes} minutes of learning content`;

    return {
      learningType,
      totalCredits,
      breakdown: [
        {
          component: learningType === "video" ? "HeyGen Video Generation" : "E-Learning Content",
          quantity: durationMinutes,
          rate,
          subtotal: totalCredits,
        },
      ],
      summary,
      estimatedMinutes: durationMinutes,
    };
  }

  switch (learningType) {
    case "image":
      return estimateImageCredits(text);
    case "video":
      return estimateVideoCredits(text);
    case "static":
    default:
      return estimateStaticELearningCredits(text);
  }
}

/**
 * Format credits estimate for display
 */
export function formatCreditEstimate(estimate: CreditEstimate): string {
  return `${estimate.totalCredits} credits (₹${estimate.totalCredits})`;
}

/**
 * Get color coding for credit amount
 * Green (good) = under 100, Yellow (caution) = 100-500, Red (expensive) = 500+
 */
export function getCreditAmountColor(credits: number): string {
  if (credits <= 100) return "text-emerald-600";
  if (credits <= 500) return "text-amber-600";
  return "text-red-600";
}

/**
 * Get detailed breakdown text
 */
export function getCreditBreakdownText(estimate: CreditEstimate): string {
  const lines = estimate.breakdown.map(
    (item) => `• ${item.component}: ${item.quantity} × ${item.rate} = ${item.subtotal} credits`
  );
  return lines.join("\n");
}
