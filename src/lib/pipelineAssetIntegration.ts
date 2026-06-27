/**
 * Pipeline Asset Integration
 * Functions to integrate selected assets into course generation
 */

import { findMatchingAsset } from '@/utils/assetMatching';
import { fetchAssetImage, logAssetUsage } from '@/lib/assetStorage';

export interface SelectedAsset {
  id: string;
  storageUrl: string;
  tags: string[];
  description?: string;
}

export interface AssetCheckResult {
  hasMatch: boolean;
  assetId?: string;
  dataUrl?: string;
  mimeType?: string;
  error?: string;
}

/**
 * Check if there's a matching asset for a slide and prepare it for use
 */
export async function checkAndPrepareAsset(
  slideTitle: string,
  slideContent: string,
  selectedAssets: SelectedAsset[]
): Promise<AssetCheckResult> {
  try {
    // Find matching asset
    const matchedAsset = findMatchingAsset(slideContent, slideTitle, selectedAssets);

    if (!matchedAsset) {
      return { hasMatch: false };
    }

    // Fetch the asset image
    const imageData = await fetchAssetImage(matchedAsset.storageUrl);

    if (!imageData) {
      return {
        hasMatch: false,
        error: 'Failed to fetch asset image',
      };
    }

    return {
      hasMatch: true,
      assetId: matchedAsset.id,
      dataUrl: imageData.dataUrl,
      mimeType: imageData.mimeType,
    };
  } catch (error) {
    return {
      hasMatch: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Log asset usage for analytics
 * Call this when an asset is successfully used in a slide
 */
export async function recordAssetUsage(
  userId: string,
  assetId: string,
  courseId: string,
  slideNumber: number,
  slideTitle: string
): Promise<void> {
  try {
    await logAssetUsage(userId, assetId, courseId, slideNumber, slideTitle);
  } catch (error) {
    // Silently fail - don't interrupt pipeline
    console.error('Failed to log asset usage:', error);
  }
}

/**
 * Example of how to modify image generation in pipeline
 * This is pseudo-code showing the pattern to follow
 */
export const imageGenerationWithAssets = `
// IN useAgentPipeline.ts, modify runPipeline function:

const runPipeline = useCallback(async (
  courseTitle: string,
  inputText: string,
  toggles: Record<string, boolean>,
  params?: any,
  selectedAssets?: SelectedAsset[]  // NEW PARAMETER
) => {
  // ... existing code ...

  // When generating images for narrative scenes:
  for (let si = 0; si < scenes.length; si++) {
    const scene = narrative.scenes[si];

    try {
      // NEW: Check for matching asset first
      const assetCheck = await checkAndPrepareAsset(
        scene.title,
        scene.imagePrompt,
        selectedAssets || []
      );

      if (assetCheck.hasMatch && assetCheck.dataUrl) {
        // Use custom asset
        scene.imageDataUrl = assetCheck.dataUrl;
        addLog(\`Visual Design Agent: Using custom asset for "\${scene.title}"\`);

        // Record usage for analytics
        if (assetCheck.assetId) {
          await recordAssetUsage(
            userId,
            assetCheck.assetId,
            courseId,
            si + 1,
            scene.title
          );
        }
      } else {
        // Fallback to Flux generation
        const { data: imageData, error: imageError } = await supabase.functions.invoke(
          'generate-slide-image',
          {
            body: {
              prompt: scene.imagePrompt,
              style: params?.imageStyleVariant || 'illustrated',
              // ... rest of params
            },
          }
        );

        if (!imageError && imageData?.imageDataUrl) {
          scene.imageDataUrl = imageData.imageDataUrl;
        }
      }
    } catch (error) {
      addLog(\`Error processing image for scene: \${error}\`);
    }
  }

  // ... rest of pipeline ...
});
`;

/**
 * Helper to inject asset support into image generation calls
 * Usage pattern for Flux fallback image generation:
 *
 * // Check for asset first
 * const assetResult = await checkAndPrepareAsset(topicTitle, content, selectedAssets);
 *
 * if (assetResult.hasMatch) {
 *   // Use asset
 *   topicVisual.generated_image_data_url = assetResult.dataUrl;
 *   topicVisual.generated_image_mime_type = assetResult.mimeType;
 *   await recordAssetUsage(userId, assetResult.assetId, courseId, slideNum, topicTitle);
 * } else {
 *   // Use Flux
 *   const { data } = await supabase.functions.invoke('generate-slide-image', {...});
 *   topicVisual.generated_image_data_url = data.imageDataUrl;
 * }
 */
