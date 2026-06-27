/**
 * Studio Integration Guide
 * How to integrate AssetMatchingModal into Index.tsx generation flow
 */

/**
 * INTEGRATION STEPS FOR Index.tsx:
 *
 * 1. ADD IMPORTS:
 *    import { AssetMatchingModal } from '@/components/AssetMatchingModal';
 *    import { useAssetMatching } from '@/hooks/useAssetMatching';
 *    import { extractSlidesFromCourseData, detectCourseType, extractCourseText } from '@/lib/slideExtraction';
 *    import { getUserAssets } from '@/lib/assetStorage';
 *
 * 2. ADD STATE IN Index COMPONENT:
 *    const { selectedAssets, isModalOpen, openModal, closeModal, handleAssetsSelected } = useAssetMatching();
 *    const [userAssets, setUserAssets] = useState([]);
 *    const [pendingGenerationParams, setPendingGenerationParams] = useState(null);
 *
 * 3. MODIFY startGeneration FUNCTION:
 *    const startGeneration = async (params: CourseParameters) => {
 *      // Load user's assets
 *      const assets = await getUserAssets(profile?.id || '');
 *      setUserAssets(assets);
 *
 *      // Extract course metadata
 *      const courseContent = extractCourseText({ courseTitle, inputText });
 *      const courseType = detectCourseType(courseContent);
 *
 *      // Store params for later
 *      setPendingGenerationParams({ params, courseContent, courseType });
 *
 *      // Open modal only if there are assets, otherwise proceed directly
 *      if (assets.length > 0) {
 *        openModal();
 *      } else {
 *        proceedWithGeneration([], params);
 *      }
 *    };
 *
 * 4. CREATE proceedWithGeneration FUNCTION:
 *    const proceedWithGeneration = async (selectedAssetIds: string[], params: CourseParameters) => {
 *      if (!pendingGenerationParams) return;
 *
 *      const { courseContent, courseType } = pendingGenerationParams;
 *
 *      // Handle asset selection
 *      const selected = await handleAssetsSelected(
 *        selectedAssetIds,
 *        userAssets,
 *        courseId, // Generate or get from state
 *        profile?.id || '',
 *        courseContent,
 *        courseType
 *      );

 *      // Proceed with pipeline, passing selected assets
 *      setIsStartingGeneration(true);
 *      window.setTimeout(() => {
 *        try {
 *          void runPipeline(courseTitle, inputText, effectiveToggles, {
 *            ...params,
 *            contentType,
 *            titleSpans,
 *            companyLogo,
 *            learningMode: pipelineLearningMode,
 *            videoSettings: effectiveVideoSettings,
 *          }, selected, courseId, profile?.id).catch((err) => {
 *            toast.error(err instanceof Error ? err.message : "Generation failed");
 *          });
 *        } finally {
 *          window.setTimeout(() => setIsStartingGeneration(false), 400);
 *        }
 *      }, 0);

 *      setPendingGenerationParams(null);
 *    };
 *
 * 5. ADD MODAL TO JSX:
 *    {pendingGenerationParams && (
 *      <AssetMatchingModal
 *        isOpen={isModalOpen}
 *        onClose={() => {
 *          closeModal();
 *          setPendingGenerationParams(null);
 *        }}
 *        onProceed={(selectedAssetIds) => {
 *          proceedWithGeneration(selectedAssetIds, pendingGenerationParams.params);
 *        }}
 *        courseContent={pendingGenerationParams.courseContent}
 *        slides={[]} // Will be populated by modal based on content
 *        userId={profile?.id || ''}
 *        courseType={pendingGenerationParams.courseType}
 *      />
 *    )}
 *
 * 6. UPDATE BUTTON onClick HANDLER:
 *    onClick={() => {
 *      if (!isRunning && courseParams) startGeneration(courseParams);
 *    }}
 */

/**
 * INTEGRATION FLOW DIAGRAM:
 *
 *  User clicks "Proceed to Generation"
 *           ↓
 *  startGeneration(courseParams)
 *      ├─ Load user assets
 *      ├─ Extract course content
 *      ├─ Detect course type
 *      ├─ Store params
 *      └─ Open AssetMatchingModal (if assets exist)
 *           ↓
 *  User selects which assets to use
 *      ├─ Modal shows matches
 *      ├─ User selects/deselects
 *      └─ User clicks "Generate with Selected"
 *           ↓
 *  proceedWithGeneration(selectedAssetIds, params)
 *      ├─ Save preferences to DB
 *      ├─ Pass selectedAssets to runPipeline
 *      └─ Start generation
 *           ↓
 *  runPipeline with asset support
 *      ├─ For each image needed:
 *      │  ├─ Check selectedAssets for match
 *      │  ├─ If match: Use asset, log usage
 *      │  └─ If no match: Generate with Flux
 *      └─ Complete course
 */

/**
 * MINIMAL CODE PATCH FOR Index.tsx
 * Shows only the changes needed (simplified)
 */
export const minimalIntegrationPatch = `
// Add these imports at the top
import { AssetMatchingModal } from '@/components/AssetMatchingModal';
import { useAssetMatching } from '@/hooks/useAssetMatching';

// In Index component, add state after existing useState hooks
const { selectedAssets, isModalOpen, openModal, closeModal, handleAssetsSelected } = useAssetMatching();
const [showAssetModal, setShowAssetModal] = useState(false);
const [pendingGenParams, setPendingGenParams] = useState(null);

// Modify startGeneration to show modal
const startGeneration = async (params) => {
  if (params.learningType === 'video') {
    // Video mode: skip assets, proceed directly
    handleProceedWithGeneration(params);
  } else {
    // Static/Image mode: show asset modal
    setPendingGenParams(params);
    setShowAssetModal(true);
  }
};

// Add new handler for when user confirms asset selection
const handleProceedWithAssets = async (selectedAssetIds) => {
  if (!pendingGenParams) return;

  // Get selected assets and proceed
  const selected = selectedAssets.filter(a => selectedAssetIds.includes(a.id));

  // Call pipeline with assets
  void runPipeline(
    courseTitle,
    inputText,
    effectiveToggles,
    { ...pendingGenParams, /* other params */ },
    selected,  // NEW: selected assets
    courseId,  // NEW: for analytics
    profile?.id // NEW: for analytics
  );

  setShowAssetModal(false);
  setPendingGenParams(null);
};

// Add modal to JSX
{showAssetModal && pendingGenParams && (
  <AssetMatchingModal
    isOpen={showAssetModal}
    onClose={() => setShowAssetModal(false)}
    onProceed={handleProceedWithAssets}
    courseContent={inputText}
    slides={[]}
    userId={profile?.id || ''}
    courseType="general"
  />
)}
`;
