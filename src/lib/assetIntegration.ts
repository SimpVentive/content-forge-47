/**
 * Asset Integration Guide
 * How to integrate AssetMatchingModal into the generation flow
 */

/**
 * INTEGRATION STEPS:
 *
 * 1. In your Studio/Generation component:
 *
 *    import { AssetMatchingModal } from '@/components/AssetMatchingModal';
 *    import { useAssetMatching } from '@/hooks/useAssetMatching';
 *    import { extractSlidesFromCourseData, detectCourseType } from '@/lib/slideExtraction';
 *
 * 2. In the component:
 *
 *    const { selectedAssets, isModalOpen, openModal, closeModal, handleAssetsSelected } = useAssetMatching();
 *
 * 3. When user clicks "Proceed to Generation":
 *
 *    - Extract slides from course data
 *    - Open asset matching modal
 *    - Wait for user selection
 *    - Pass selected assets to pipeline
 *
 * 4. Show modal:
 *
 *    <AssetMatchingModal
 *      isOpen={isModalOpen}
 *      onClose={closeModal}
 *      onProceed={async (selectedAssetIds) => {
 *        const selected = await handleAssetsSelected(
 *          selectedAssetIds,
 *          userAssets,
 *          courseId,
 *          userId,
 *          courseContent,
 *          detectedCourseType
 *        );
 *        // Pass selected assets to pipeline
 *        proceedWithGeneration(selected);
 *      }}
 *      courseContent={courseContent}
 *      slides={extractedSlides}
 *      userId={userId}
 *      courseType={detectedCourseType}
 *    />
 *
 * 5. Modify pipeline call:
 *
 *    // BEFORE:
 *    const result = await runAIPipeline({ content, courseParams });
 *
 *    // AFTER:
 *    const result = await runAIPipeline({
 *      content,
 *      courseParams,
 *      selectedAssets: selectedAssets.map(asset => ({
 *        id: asset.id,
 *        storageUrl: asset.storage_url,
 *        tags: asset.tags,
 *        description: asset.description
 *      }))
 *    });
 */

export interface GenerationWithAssetsOptions {
  courseContent: string;
  courseParams: any;
  selectedAssets?: Array<{
    id: string;
    storageUrl: string;
    tags: string[];
    description?: string;
  }>;
}

/**
 * Mock pipeline call showing asset integration
 * This is what the actual runAIPipeline will look like with assets
 */
export async function runAIPipelineWithAssets(
  options: GenerationWithAssetsOptions
): Promise<any> {
  const { courseContent, courseParams, selectedAssets = [] } = options;

  // TODO: Update useAgentPipeline.ts to accept selectedAssets parameter
  // The actual implementation will:
  // 1. Pass selectedAssets to the pipeline
  // 2. During image generation, check for matching assets
  // 3. Use custom assets where matched
  // 4. Generate with Flux for unmatched slides
  // 5. Log asset usage

  console.log('Running pipeline with assets:', {
    contentLength: courseContent.length,
    assetsCount: selectedAssets.length,
    assets: selectedAssets.map((a) => ({
      id: a.id,
      tags: a.tags,
    })),
  });

  // Return mock result for now
  return {
    success: true,
    message: 'Generation will proceed with selected assets',
  };
}

/**
 * Example Studio component integration
 * This shows how to integrate asset matching into your existing flow
 */
export const StudioIntegrationExample = `
import { useState } from 'react';
import { AssetMatchingModal } from '@/components/AssetMatchingModal';
import { useAssetMatching } from '@/hooks/useAssetMatching';
import { extractSlidesFromCourseData, detectCourseType } from '@/lib/slideExtraction';
import { getUserAssets } from '@/lib/assetStorage';

export function Studio() {
  const { selectedAssets, isModalOpen, openModal, closeModal, handleAssetsSelected } = useAssetMatching();
  const [userAssets, setUserAssets] = useState([]);

  const handleProceedToGeneration = async () => {
    // 1. Load user's assets
    const assets = await getUserAssets(userId);
    setUserAssets(assets);

    // 2. Extract slide data
    const slides = extractSlidesFromCourseData(courseData);

    // 3. Detect course type
    const courseType = detectCourseType(courseContent);

    // 4. Open modal
    openModal();
  };

  const handleAssetsConfirmed = async (selectedAssetIds: string[]) => {
    // 5. Process selection and save preference
    const selected = await handleAssetsSelected(
      selectedAssetIds,
      userAssets,
      courseId,
      userId,
      courseContent,
      courseType
    );

    // 6. Proceed with generation using selected assets
    await proceedWithGeneration(selected);
  };

  return (
    <>
      {/* Your existing UI */}
      <button onClick={handleProceedToGeneration}>
        Proceed to Generation
      </button>

      {/* Asset Matching Modal */}
      <AssetMatchingModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onProceed={handleAssetsConfirmed}
        courseContent={courseContent}
        slides={slides}
        userId={userId}
        courseType={courseType}
      />
    </>
  );
}
`;
