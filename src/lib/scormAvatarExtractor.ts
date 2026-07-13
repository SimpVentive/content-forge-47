/**
 * SCORM Avatar Extractor - Handles avatar trainer media for SCORM packages
 * Extracts images and voice configuration from trainer selections
 */

import { AVATAR_TRAINERS, getTrainerMedia, getTrainerVoiceId } from "@/lib/avatarTrainers";

export interface AvatarMedia {
  trainerName: string;
  imagePath?: string;
  imageUrl?: string;
  voiceId?: string;
  voiceName?: string;
}

/**
 * Extracts avatar media based on trainer selection
 * Returns avatar image URL and voice configuration
 */
export function extractAvatarMedia(trainerId?: string): AvatarMedia {
  const defaultAvatar: AvatarMedia = {
    trainerName: "Trainer",
    voiceName: "Unknown",
  };

  if (!trainerId) {
    return defaultAvatar;
  }

  // Find trainer in AVATAR_TRAINERS database
  const trainer = AVATAR_TRAINERS.find((t) => t.id === trainerId);
  if (!trainer) {
    console.warn(`[Avatar Extractor] Trainer not found: ${trainerId}`);
    return defaultAvatar;
  }

  // Get trainer media (images, videos)
  const media = getTrainerMedia(trainerId);
  if (!media) {
    console.warn(`[Avatar Extractor] No media found for trainer: ${trainerId}`);
    return {
      trainerName: trainer.name || "Trainer",
      voiceId: getTrainerVoiceId(trainerId),
      voiceName: trainer.defaultVoice || "Unknown",
    };
  }

  // Determine best image to use for avatar
  let imageUrl: string | undefined;

  // Try to find a static image (preferred for SCORM)
  if (media.staticImageUrl) {
    imageUrl = media.staticImageUrl;
  } else if (media.videoUrl) {
    // Fallback to video thumbnail if available
    imageUrl = media.videoThumbnailUrl || media.videoUrl;
  } else if (media.imagePath) {
    imageUrl = media.imagePath;
  }

  return {
    trainerName: trainer.name || "Trainer",
    imagePath: media.imagePath,
    imageUrl,
    voiceId: getTrainerVoiceId(trainerId),
    voiceName: trainer.defaultVoice || "Unknown",
  };
}

/**
 * Validates avatar media availability
 * Checks if trainer selection has necessary assets
 */
export function validateAvatarMedia(trainerId?: string): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!trainerId) {
    warnings.push("No trainer selected - using default avatar");
    return { isValid: false, warnings };
  }

  const trainer = AVATAR_TRAINERS.find((t) => t.id === trainerId);
  if (!trainer) {
    warnings.push(`Trainer not found: ${trainerId}`);
    return { isValid: false, warnings };
  }

  const media = getTrainerMedia(trainerId);
  if (!media) {
    warnings.push(`No media found for trainer: ${trainer.name}`);
    return { isValid: false, warnings };
  }

  if (!media.staticImageUrl && !media.videoUrl && !media.imagePath) {
    warnings.push(`Trainer "${trainer.name}" has no image or video assets`);
    return { isValid: false, warnings };
  }

  const voiceId = getTrainerVoiceId(trainerId);
  if (!voiceId) {
    warnings.push(`Trainer "${trainer.name}" has no voice configuration`);
  }

  return { isValid: warnings.length === 0, warnings };
}

/**
 * Gets list of available trainers
 */
export function getAvailableTrainers(): Array<{
  id: string;
  name: string;
  hasImage: boolean;
  hasVideo: boolean;
  voiceName: string;
}> {
  return AVATAR_TRAINERS.map((trainer) => {
    const media = getTrainerMedia(trainer.id);
    const voiceId = getTrainerVoiceId(trainer.id);

    return {
      id: trainer.id,
      name: trainer.name || "Unknown Trainer",
      hasImage: !!(media?.staticImageUrl || media?.imagePath),
      hasVideo: !!media?.videoUrl,
      voiceName: trainer.defaultVoice || "Unknown",
    };
  });
}

/**
 * Extracts voice narration configuration for SCORM
 * Used to determine if TTS audio should be generated/embedded
 */
export interface NarrationConfig {
  enabled: boolean;
  voiceId?: string;
  voiceName?: string;
  trainerName?: string;
}

export function extractNarrationConfig(trainerId?: string): NarrationConfig {
  if (!trainerId) {
    return { enabled: false };
  }

  const trainer = AVATAR_TRAINERS.find((t) => t.id === trainerId);
  if (!trainer) {
    return { enabled: false };
  }

  const voiceId = getTrainerVoiceId(trainerId);

  return {
    enabled: !!voiceId,
    voiceId,
    voiceName: trainer.defaultVoice,
    trainerName: trainer.name,
  };
}

/**
 * Estimates asset storage requirements
 * Returns estimated size in MB for avatar and voice assets
 */
export function estimateAvatarStorageSize(trainerId?: string): {
  imageSize: number;
  audioPerMinute: number;
  estimatedTotal: number;
} {
  // Rough estimates based on typical SCORM content
  // JPEG image: 50-200KB
  // MP3 audio: 1MB per minute (128kbps)

  const media = trainerId ? getTrainerMedia(trainerId) : null;

  return {
    imageSize: 0.15, // MB - typical compressed trainer image
    audioPerMinute: 1.0, // MB - typical voice narration at 128kbps
    estimatedTotal: 0.15 + 5.0, // MB - assumes 5 minute course average
  };
}
