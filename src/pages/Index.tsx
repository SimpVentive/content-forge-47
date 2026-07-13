import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { v4 as uuidv4 } from "uuid";
import { useLocation, useNavigate } from "react-router-dom";
import { useContentForge } from "@/hooks/ContentForgeContext";
import type { CourseParameters } from "@/components/contentforge/CourseParametersDialog";
import { estimateMinutesFromText } from "@/components/contentforge/Sidebar";
import type { TitleSpan } from "@/components/contentforge/RichTitleEditor";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import type { InsertedVideo } from "@/components/contentforge/VideosTab";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import type { OutputData, RawAgentOutputs } from "@/types/agents";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";
import { Plus, Play, Clock3, Loader2, Save, FolderOpen, Trash2, FileText, Zap, BarChart3, Settings } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TabContainer } from "@/components/contentforge/TabContainer";
import contentForgeLogo from "@/assets/contentforge-logo.png";
import {
  createDraftId,
  deleteCourseDraftCloudFirst,
  listCourseDraftsCloudFirst,
  saveCourseDraftCloudFirst,
  type CourseDraft,
} from "@/lib/courseDrafts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { CreditConfirmationModal } from "@/components/CreditConfirmationModal";
import { QAResultsDialog } from "@/components/contentforge/QAResultsDialog";
import { QAConfirmationDialog } from "@/components/contentforge/QAConfirmationDialog";
import { spendCredits } from "@/lib/edgeFunctions";
import { estimateCredits, type CreditEstimate } from "@/lib/creditEstimator";
import { AssetMatchingModal } from "@/components/AssetMatchingModal";
import { AssetLibraryPanel } from "@/components/AssetLibraryPanel";
import { useAssetMatching } from "@/hooks/useAssetMatching";
import { extractCourseText, detectCourseType, extractSlidesFromCourseData } from "@/lib/slideExtraction";
import { getUserAssets } from "@/lib/assetStorage";
import type { SelectedAsset } from "@/lib/pipelineAssetIntegration";

const LearnerPreview = lazy(() =>
  import("@/components/contentforge/LearnerPreview").then((module) => ({
    default: module.LearnerPreview,
  }))
);

const CourseParametersDialog = lazy(() =>
  import("@/components/contentforge/CourseParametersDialog").then((module) => ({
    default: module.CourseParametersDialog,
  }))
);

const VideoClipWorkflow = lazy(() =>
  import("@/components/contentforge/VideoClipWorkflow").then((module) => ({
    default: module.VideoClipWorkflow,
  }))
);

const Index = () => {
  const { profile, refreshProfile, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Try location.state first, fall back to localStorage, then default to "static"
  const learningType = (location.state as any)?.learningType || localStorage.getItem("selectedLearningType") || "static";
  const { videoSettings, learningMode, setLearningMode } = useContentForge();
  const [courseTitle, setCourseTitle] = useState(SAMPLE_TITLE);
  const [inputText, setInputText] = useState(SAMPLE_NOTES);
  const [agentToggles, setAgentToggles] = useState<Record<string, boolean>>(() => {
    const base = Object.fromEntries(AGENTS.map((a) => [a.id, true]));
    if (learningType === "video") {
      // animation, youtube, compliance are static-only
      base.animation = false;
      base.youtube = false;
      base.compliance = false;
      // visual-narrative is image-only
      base["visual-narrative"] = false;
    } else if (learningType === "static") {
      // heygen is video-only, visual-narrative is image-only
      base.heygen = false;
      base["visual-narrative"] = false;
    } else if (learningType === "image") {
      // heygen is video-only, animation/youtube/compliance are static-only
      base.heygen = false;
      base.animation = false;
      base.youtube = false;
      base.compliance = false;
    }
    return base;
  });
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [courseParams, setCourseParams] = useState<CourseParameters | null>(null);
  const [showVideoWorkflow, setShowVideoWorkflow] = useState(false);
  const [workflowClips, setWorkflowClips] = useState<any[]>([]);
  const [runElapsedSeconds, setRunElapsedSeconds] = useState(0);
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CourseDraft[]>([]);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [creditEstimate, setCreditEstimate] = useState<CreditEstimate | null>(null);
  const [pendingParams, setPendingParams] = useState<CourseParameters | null>(null);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [contentType, setContentType] = useState<"learning-course" | "work-instruction">("learning-course");
  const [titleSpans, setTitleSpans] = useState<TitleSpan[]>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("input");
  const [showGenerationComplete, setShowGenerationComplete] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [courseIdRef, setCourseIdRef] = useState<string>("");
  const [pendingGenerationParams, setPendingGenerationParams] = useState<{ params: CourseParameters; courseContent: string; courseType: string } | null>(null);
  const { selectedAssets, handleAssetsSelected } = useAssetMatching();
  const hasProcessedAssetNav = useRef(false);
  const prevIsRunning = useRef(false);

  const {
    agents,
    outputData,
    rawOutputs,
    logs,
    isRunning,
    runPipeline,
    stopPipeline,
    updateVisualTopicAsset,
    updateCourseContent,
    loadPersistedState,
    clearPipelineState,
    showQAConfirmation,
    proceedWithQA,
    proceedWithoutQA,
    isRunningQA,
    showQADialog,
    qaResult,
    applyQAFixes,
    skipQAFixes,
    isApplyingQAFixes,
  } = useAgentPipeline();

  const refreshDrafts = async () => {
    const nextDrafts = await listCourseDraftsCloudFirst();
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    void refreshDrafts();
  }, []);

  // Handle navigation from Dashboard to Asset Library
  useEffect(() => {
    if (!hasProcessedAssetNav.current) {
      const openAssetLibrary = (location.state as any)?.openAssetLibrary;
      if (openAssetLibrary) {
        setShowAssetLibrary(true);
        setActiveTab("setup");
        hasProcessedAssetNav.current = true;
      }
    }
  }, [location.key]);

  // Sync learningMode from learningType on mount
  useEffect(() => {
    if (learningType === "video" && learningMode === "static_elearning") {
      setLearningMode("video_learning");
    } else if (learningType === "image" && learningMode === "static_elearning") {
      setLearningMode("image_based_learning");
    }
  }, [learningType, learningMode, setLearningMode]);

  // Persist learningType to localStorage
  useEffect(() => {
    localStorage.setItem("selectedLearningType", learningType);
  }, [learningType]);

  useEffect(() => {
    if (prevIsRunning.current && !isRunning) {
      if (rawOutputs.heygenVideos) {
        // Video mode complete — route to preview
        try {
          const videos = JSON.parse(rawOutputs.heygenVideos);
          navigate("/preview/videos", { state: { videos, courseTitle } });
        } catch {
          // parse failed; stay on page
        }
      } else if (rawOutputs.youtube && courseParams?.learningType !== "image") {
        setTimeout(() => setShowVideoWorkflow(true), 800);
      } else {
        // Standard elearning completion — show completion dialog
        setTimeout(() => setShowGenerationComplete(true), 500);
      }
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, rawOutputs.youtube, rawOutputs.heygenVideos]);

  useEffect(() => {
    if (!isRunning) {
      setRunElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRunElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Update agent toggles when learning type changes via course params
  useEffect(() => {
    if (!courseParams) return;

    setAgentToggles((prev) => {
      const updated = { ...prev };
      const learningType = courseParams.learningType;

      if (learningType === "video") {
        updated.animation = false;
        updated.youtube = false;
        updated.compliance = false;
        updated["visual-narrative"] = false;
      } else if (learningType === "static") {
        updated.heygen = false;
        updated["visual-narrative"] = false;
        // Re-enable static-only agents
        updated.animation = true;
        updated.youtube = true;
        updated.compliance = true;
      } else if (learningType === "image") {
        updated.heygen = false;
        updated.animation = false;
        updated.youtube = false;
        updated.compliance = false;
        // Enable visual-narrative for image mode
        updated["visual-narrative"] = true;
      }

      return updated;
    });
  }, [courseParams?.learningType]);

  // Update learningMode when courseParams learning type changes
  useEffect(() => {
    if (!courseParams) return;

    if (courseParams.learningType === "video") {
      console.log("Setting learningMode to video_learning");
      setLearningMode("video_learning");
    } else if (courseParams.learningType === "image") {
      console.log("Setting learningMode to image_based_learning");
      setLearningMode("image_based_learning");
    } else {
      console.log("Setting learningMode to static_elearning");
      setLearningMode("static_elearning");
    }
  }, [courseParams?.learningType, setLearningMode]);

  const elapsedLabel = useMemo(() => {
    const mins = Math.floor(runElapsedSeconds / 60);
    const secs = runElapsedSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [runElapsedSeconds]);

  const getModuleNames = (): string[] => {
    try {
      const parsed = JSON.parse(rawOutputs.architect || "{}");
      const mods = parsed.modules || parsed.course_structure?.modules || parsed.course_modules || [];
      return mods.map((m: any) => m.module_title || m.title || m.name || "").filter(Boolean);
    } catch {
      return [courseTitle];
    }
  };

  const getModuleSections = (): { title: string; sections: string[] }[] => {
    try {
      const parsed = JSON.parse(rawOutputs.architect || "{}");
      const mods = parsed.modules || parsed.course_structure?.modules || parsed.course_modules || [];
      return mods.map((m: any) => ({
        title: m.module_title || m.title || m.name || "",
        sections: (m.topics || m.sections || m.lessons || []).map((t: any) =>
          typeof t === "string" ? t : t.topic_title || t.title || t.name || ""
        ).filter(Boolean),
      })).filter((m: any) => m.title);
    } catch {
      return [{ title: courseTitle, sections: [] }];
    }
  };

  const handleGenerateClick = () => {
    setShowParamsDialog(true);
    setActiveTab("setup");
  };

  const handleSaveDraft = async () => {
    const draftId = currentDraftId || createDraftId();
    const title = (courseTitle || "Untitled Course").trim() || "Untitled Course";

    await saveCourseDraftCloudFirst({
      id: draftId,
      title,
      inputText,
      courseParams,
      workflowClips,
      rawOutputs: rawOutputs as RawAgentOutputs,
      outputData: outputData as OutputData,
    });

    setCurrentDraftId(draftId);
    await refreshDrafts();
    toast.success("Draft saved");
  };

  const handleLoadDraft = (draft: CourseDraft) => {
    setCurrentDraftId(draft.id);
    setCourseTitle(draft.title || "");
    setInputText(draft.inputText || "");
    setCourseParams(draft.courseParams || null);
    setWorkflowClips(Array.isArray(draft.workflowClips) ? draft.workflowClips : []);
    loadPersistedState(draft.rawOutputs, draft.outputData, []);
    setShowDraftsPanel(false);
    toast.success("Draft loaded");
  };

  const handleDeleteDraft = async (draftId: string) => {
    await deleteCourseDraftCloudFirst(draftId);
    if (currentDraftId === draftId) setCurrentDraftId(null);
    await refreshDrafts();
    toast.success("Draft deleted");
  };

  const handleNewCourse = () => {
    navigate("/new-course");
  };

  const handleNewCourseHere = () => {
    setCurrentDraftId(null);
    setCourseTitle("");
    setInputText("");
    setCourseParams(null);
    setWorkflowClips([]);
    clearPipelineState();
    toast.success("Started a new course");
  };

  const getEffectiveAgentToggles = (params: CourseParameters, baseToggles = agentToggles) => {
    const updated = { ...baseToggles };

    updated.assessment = params.assessmentRequired;

    if (params.learningType === "video") {
      updated.animation = false;
      updated.youtube = false;
      updated.compliance = false;
      updated.heygen = true;
      updated["visual-narrative"] = false;
    } else if (params.learningType === "image") {
      updated.animation = false;
      updated.youtube = false;
      updated.compliance = false;
      updated.heygen = false;
      updated["visual-narrative"] = true;
    } else {
      updated.animation = true;
      updated.youtube = true;
      updated.compliance = true;
      updated.heygen = false;
      updated["visual-narrative"] = false;
    }

    return updated;
  };

  const startGeneration = async (params: CourseParameters, baseToggles = agentToggles) => {
    if (isRunning || isStartingGeneration) return;

    // Generate a unique courseId for this generation
    const generatedCourseId = uuidv4();
    setCourseIdRef(generatedCourseId);

    // For video mode, skip assets and proceed directly
    if (params.learningType === "video") {
      proceedWithGeneration([], params, baseToggles, generatedCourseId);
      return;
    }

    // For static/image mode, load assets and show modal
    try {
      const assets = await getUserAssets(profile?.id || '');
      setUserAssets(assets);

      const courseContent = extractCourseText({ courseTitle, inputText });
      const courseType = detectCourseType(courseContent);

      setPendingGenerationParams({
        params,
        courseContent,
        courseType,
      });

      // Only show modal if user has assets
      if (assets.length > 0) {
        setShowAssetModal(true);
      } else {
        // No assets, proceed directly
        proceedWithGeneration([], params, baseToggles, generatedCourseId);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
      // Proceed without assets on error
      proceedWithGeneration([], params, baseToggles, generatedCourseId);
    }
  };

  const proceedWithGeneration = (selectedAssetIds: string[], params: CourseParameters, baseToggles = agentToggles, courseId = courseIdRef) => {
    if (isRunning || isStartingGeneration) return;

    const effectiveToggles = getEffectiveAgentToggles(params, baseToggles);
    const pipelineLearningMode = params.learningType === "video"
      ? "video_learning"
      : params.learningType === "image"
        ? "image_based_learning"
        : "static_elearning";
    const effectiveVideoSettings =
      params.learningType === "video"
        ? {
            selectedAvatar: params.avatarTrainerId || "rachel",
            videoQuality: params.videoQuality,
            backgroundStyle: params.backgroundStyle,
          }
        : undefined;

    setAgentToggles(effectiveToggles);
    setIsStartingGeneration(true);
    setActiveTab("creation");

    // Get the selected assets for pipeline
    const selectedAssetsData = userAssets.filter(a => selectedAssetIds.includes(a.id));

    window.setTimeout(() => {
      try {
        void runPipeline(courseTitle, inputText, effectiveToggles, {
          ...params,
          contentType,
          titleSpans,
          companyLogo,
          learningMode: pipelineLearningMode,
          videoSettings: effectiveVideoSettings,
        }, selectedAssetsData, courseId, profile?.id).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Generation failed to start");
        });
      } finally {
        window.setTimeout(() => setIsStartingGeneration(false), 400);
      }
    }, 0);

    setShowAssetModal(false);
    setPendingGenerationParams(null);
  };

  const handleParamsConfirm = async (params: CourseParameters) => {
    setCourseParams(params);
    setShowParamsDialog(false);
    setAgentToggles((prev) => getEffectiveAgentToggles(params, prev));

    // For video mode: verify HeyGen is configured (auto-seeded on app boot)
    if (params.learningType === "video") {
      const { getHeyGenSettings } = await import("@/lib/heygenDefaults");
      const heygenConfig = getHeyGenSettings();
      if (!heygenConfig?.apiKey) {
        toast.warning("Video generation not configured. Contact admin to set up HeyGen API.");
        return;
      }
    }

    // Estimate credits based on learning type, duration, and requirement text
    // (Shown to everyone — admins still see the estimate, but deduction is skipped on confirm.)
    const durationMinutes = parseInt(params.duration.match(/\d+/)?.[0] || "15", 10);
    const estimate = estimateCredits(inputText, params.learningType, durationMinutes);
    setCreditEstimate(estimate);
    setPendingParams(params);
    setShowCreditConfirmation(true);
  };

  const handleCreditConfirmation = async () => {
    if (!creditEstimate || !pendingParams) return;

    const params = pendingParams;
    const estimated = creditEstimate.totalCredits;

    const availableCredits = (profile?.credits_total ?? 0) - (profile?.credits_used ?? 0);

    // Admins skip the deduction but still see the estimate first.
    if (isAdmin) {
      setShowCreditConfirmation(false);
      setCreditEstimate(null);
      setPendingParams(null);
      startGeneration(params);
      toast.success("Admin run — credits not deducted");
      return;
    }

    if (estimated > availableCredits) {
      setShowCreditConfirmation(false);
      setRequiredCredits(estimated);
      setShowInsufficientCredits(true);
      return;
    }

    try {
      await spendCredits(estimated, "course_generation");
      await refreshProfile();
      setShowCreditConfirmation(false);
      setCreditEstimate(null);
      setPendingParams(null);
      startGeneration(params);
      toast.success(`${estimated} credits deducted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deduct credits");
    }
  };


  const hasRun = logs.length > 0;
  const hasOutput = Object.values(rawOutputs).some((v) => v);
  const previewVideos = useMemo<InsertedVideo[]>(() => workflowClips.map((clip) => ({
    videoId: clip.videoId,
    title: clip.title,
    channelTitle: clip.channelTitle,
    thumbnail: clip.thumbnail,
    duration: clip.duration,
    startTime: clip.startTime || "",
    endTime: clip.endTime || "",
    customName: clip.customName || clip.title,
    moduleTitle: clip.insertAfterModule || "",
    afterSlide: -1,
  })), [workflowClips]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <CreditConfirmationModal
        open={showCreditConfirmation}
        estimate={creditEstimate}
        availableCredits={(profile?.credits_total ?? 0) - (profile?.credits_used ?? 0)}
        onConfirm={handleCreditConfirmation}
        onCancel={() => {
          setShowCreditConfirmation(false);
          setCreditEstimate(null);
          setPendingParams(null);
        }}
        onPurchase={() => {
          setShowCreditConfirmation(false);
          setCreditEstimate(null);
          setPendingParams(null);
          navigate("/#pricing");
        }}
      />
      <InsufficientCreditsModal
        open={showInsufficientCredits}
        requiredCredits={requiredCredits}
        onClose={() => setShowInsufficientCredits(false)}
      />
      <QAConfirmationDialog
        open={showQAConfirmation}
        onProceedWithQA={proceedWithQA}
        onProceedWithout={proceedWithoutQA}
        isLoading={isRunningQA}
      />
      {qaResult && (
        <QAResultsDialog
          open={showQADialog}
          qaResult={qaResult}
          onApply={applyQAFixes}
          onSkip={skipQAFixes}
          isApplying={isApplyingQAFixes}
        />
      )}

      {/* Asset Matching Modal */}
      {showAssetModal && pendingGenerationParams && (
        <AssetMatchingModal
          isOpen={showAssetModal}
          onClose={() => {
            setShowAssetModal(false);
            setPendingGenerationParams(null);
          }}
          onProceed={(selectedAssetIds) => {
            if (pendingGenerationParams) {
              void handleAssetsSelected(
                selectedAssetIds,
                userAssets,
                courseIdRef,
                profile?.id || '',
                pendingGenerationParams.courseContent,
                pendingGenerationParams.courseType
              ).then(() => {
                proceedWithGeneration(selectedAssetIds, pendingGenerationParams.params, agentToggles, courseIdRef);
              });
            }
          }}
          courseContent={pendingGenerationParams.courseContent}
          slides={[]}
          userId={profile?.id || ''}
          courseType={pendingGenerationParams.courseType}
        />
      )}

      {/* Generation Complete Modal */}
      {showGenerationComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in scale-95 duration-300">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">
              {learningType === "video" ? "Video Course" : learningType === "image" ? "Image-Based Course" : "Learning Course"} creation completed 🎉
            </h2>

            <p className="text-center text-slate-600 mb-8">
              <span className="font-semibold text-slate-900">"{courseTitle}"</span> is ready. Do you want to proceed to <span className="font-semibold">Course Output</span>?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowGenerationComplete(false);
                  setActiveTab("output");
                }}
                className="w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Yes, take me to Course Output
              </button>
              <button
                onClick={() => setShowGenerationComplete(false)}
                className="w-full px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="h-[68px] shrink-0 bg-card border-b border-border flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={contentForgeLogo} alt="ContentForge" className="w-12 h-12 object-contain drop-shadow-lg shrink-0" />
          <div className="flex items-center gap-1 select-none shrink-0">
            <span className="text-[24px] font-[900] tracking-tight text-[#1e3a5f]">
              Content
            </span>
            <span
              className="relative text-[24px] font-[900] tracking-tight"
              style={{
                textShadow: '0 1px 2px rgba(184,134,11,0.4)',
                backgroundImage: "linear-gradient(135deg, #b8860b 0%, #daa520 40%, #ffd700 60%, #b8860b 100%)",
                backgroundSize: "220% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Forge
              <svg className="absolute -top-2 -right-3 w-3.5 h-3.5 animate-pulse" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#b8860b" />
              </svg>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-sm font-medium text-blue-700 border border-blue-200">
            <span className="capitalize text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-200">
              {learningType === "video" ? "🎥 Video" : learningType === "image" ? "🖼️ Image" : "📊 Static"}
            </span>
          </div>
          {learningType === "video" && courseParams && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 leading-tight">
              <span className="font-semibold">Q:</span> {courseParams.videoQuality} ·{" "}
              <span className="font-semibold">BG:</span> {courseParams.backgroundStyle}
              <button onClick={() => setShowParamsDialog(true)} className="underline text-cyan-600 ml-2 hover:text-cyan-700 transition-colors">Change</button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700">
            <Clock3 className="w-4 h-4" />
            <span>{(profile?.credits_total ?? 0) - (profile?.credits_used ?? 0)} credits</span>
          </div>
          {hasOutput && (
            <button
              onClick={() => setShowLearnerPreview(true)}
              className="h-[44px] px-5 rounded-lg text-[15px] font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all duration-200 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Preview as Learner
            </button>
          )}
          <button
            onClick={() => void handleSaveDraft()}
            className="h-[44px] px-4 rounded-lg text-[14px] font-bold border-2 border-border text-foreground hover:bg-secondary transition-all duration-200 flex items-center gap-2"
            type="button"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => {
              void refreshDrafts();
              setShowDraftsPanel((prev) => !prev);
            }}
            className="h-[44px] px-4 rounded-lg text-[14px] font-bold border-2 border-border text-foreground hover:bg-secondary transition-all duration-200 flex items-center gap-2"
            type="button"
          >
            <FolderOpen className="w-4 h-4" />
            Drafts
          </button>
          <button
            onClick={handleNewCourse}
            className="h-[44px] px-5 bg-primary text-primary-foreground rounded-lg text-[15px] font-bold shadow-btn-primary hover:brightness-110 transition-all duration-200 flex items-center gap-2"
            type="button"
          >
            <Plus className="w-4 h-4" />
            New Course
          </button>
        </div>
      </header>

      {showDraftsPanel && (
        <div className="absolute right-6 top-[74px] z-40 w-[420px] max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-foreground">Saved Drafts</h3>
            <button
              onClick={() => setShowDraftsPanel(false)}
              className="rounded-md px-2 py-1 text-[12px] font-bold text-muted-foreground hover:bg-secondary"
              type="button"
            >
              Close
            </button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No drafts saved yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-xl border border-border bg-background px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-bold text-foreground">{draft.title || "Untitled Course"}</p>
                      <p className="text-[11px] text-muted-foreground">Saved {new Date(draft.savedAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => void handleDeleteDraft(draft.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      type="button"
                      aria-label="Delete draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => handleLoadDraft(draft)}
                      className="h-8 rounded-lg bg-primary px-3 text-[12px] font-bold text-primary-foreground"
                      type="button"
                    >
                      Load Draft
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showLearnerPreview && (
        <Suspense fallback={null}>
          <LearnerPreview
            courseTitle={courseTitle}
            rawOutputs={rawOutputs}
            onClose={() => setShowLearnerPreview(false)}
            insertedVideos={previewVideos}
            courseDuration={courseParams?.duration}
            learnerNotesEnabled={courseParams?.learnerNotesEnabled}
            resourcesPanelEnabled={courseParams?.resourcesPanelEnabled}
            glossaryEnabled={courseParams?.glossaryEnabled}
            discussionEnabled={courseParams?.discussionEnabled}
            assessmentIntensity={courseParams?.assessmentIntensity}
            avatarTrainerId={courseParams?.avatarTrainerId}
            flipStylePreference={courseParams?.flipStyle}
            slideLayout={courseParams?.slideLayout}
            textLanguage={courseParams?.textLanguage || courseParams?.language}
            narratorLanguage={courseParams?.narratorLanguage}
            onUpdateVisualTopic={updateVisualTopicAsset}
            captionsEnabled={courseParams?.captionsEnabled}
          />
        </Suspense>
      )}

      {showVideoWorkflow && rawOutputs.youtube && (
        <Suspense fallback={null}>
          <VideoClipWorkflow
            youtubeRaw={rawOutputs.youtube}
            modules={getModuleNames()}
            moduleSections={getModuleSections()}
            courseTitle={courseTitle}
            language={courseParams?.textLanguage || courseParams?.language}
            level={courseParams?.level}
            duration={courseParams?.duration}
            videoDurationHandling={courseParams?.videoDurationHandling}
            onComplete={(clips) => {
              setWorkflowClips(clips);
              setShowVideoWorkflow(false);
            }}
            onSkip={() => setShowVideoWorkflow(false)}
          />
        </Suspense>
      )}

      <TabContainer
        tabs={[
          { id: "input", label: "Course Input", icon: <FileText className="w-4 h-4" /> },
          { id: "setup", label: "Course Setup", icon: <Settings className="w-4 h-4" /> },
          { id: "creation", label: "Course Creation", icon: <Zap className="w-4 h-4" /> },
          { id: "output", label: "Course Output", icon: <BarChart3 className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* Tab 1: Course Input */}
        {activeTab === "input" && (
          <div className="h-full overflow-y-auto">
            <Sidebar
              courseTitle={courseTitle}
              setCourseTitle={setCourseTitle}
              inputText={inputText}
              setInputText={setInputText}
              onGenerate={handleGenerateClick}
              onStop={stopPipeline}
              isRunning={isRunning}
              isStartingGeneration={isStartingGeneration}
              agentToggles={agentToggles}
              setAgentToggles={setAgentToggles}
              contentType={contentType}
              setContentType={setContentType}
              titleSpans={titleSpans}
              setTitleSpans={setTitleSpans}
              companyLogo={companyLogo}
              setCompanyLogo={setCompanyLogo}
            />
          </div>
        )}

        {/* Tab 2: Course Creation */}
        {activeTab === "creation" && (
          <div className="h-full overflow-y-auto p-6" style={{ background: '#f0f2f7' }}>
            {isRunning && (
              <div className="sticky top-4 z-20 mb-5 rounded-2xl border px-5 py-4 shadow-2xl"
                style={{
                  background: "rgba(255,255,255,0.98)",
                  borderColor: "rgba(59,130,246,0.28)",
                  boxShadow: "0 16px 40px rgba(37, 99, 235, 0.18)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#e0ebff] p-2.5">
                      <Loader2 className="h-5 w-5 animate-spin text-[#1d4ed8]" />
                    </div>
                    <div>
                      <p className="text-[14px] font-[900] uppercase tracking-[0.16em] text-[#315a9b]">Orchestration In Progress</p>
                      <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#1f3557]">
                        Multiple AI Agents are orchestrating the content of your {learningType === "video" ? "Video Learning" : learningType === "image" ? "Image-Based Learning" : "E-Learning"}. This may take a minute or two.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#bfd3fb] bg-white px-3 py-1.5 text-[13px] font-bold text-[#1e3a8a]">
                      <Clock3 className="h-4 w-4" />
                      <span>{elapsedLabel}</span>
                    </div>
                    <button
                      onClick={stopPipeline}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-all text-[13px]"
                    >
                      Stop Generation
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!isRunning && !hasRun && courseParams && (
              <div className="mx-auto mb-5 max-w-[720px] rounded-xl border border-border bg-card px-5 py-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-extrabold text-foreground">Course is configured</p>
                    <p className="mt-1 text-[13px] font-semibold text-muted-foreground">Start the orchestration pipeline when you are ready.</p>
                  </div>
                  <button
                    onClick={() => startGeneration(courseParams)}
                    disabled={isStartingGeneration}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-bold text-primary-foreground shadow-btn-primary transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                  >
                    {isStartingGeneration ? "Starting..." : "Start Generation"}
                  </button>
                </div>
              </div>
            )}
            {!hasRun ? (
              <AgentPipeline agents={agents} isRunning={isRunning} agentToggles={agentToggles} setAgentToggles={setAgentToggles} />
            ) : (
              <div className="space-y-6 max-w-[720px] mx-auto">
                <AgentPipeline agents={agents} isRunning={isRunning} agentToggles={agentToggles} setAgentToggles={setAgentToggles} />
                <OrchestratorLog logs={logs} />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Course Setup */}
        {activeTab === "setup" && (
          <div className="h-full overflow-y-auto p-8">
            {showParamsDialog && (
              <Suspense fallback={null}>
                <CourseParametersDialog
                  open={showParamsDialog}
                  courseTitle={courseTitle}
                  estimatedMinutes={estimateMinutesFromText(inputText)}
                  youtubeAgentEnabled={agentToggles.youtube}
                  initialLearningType={learningType as "static" | "video" | "image"}
                  contentType={contentType}
                  onConfirm={handleParamsConfirm}
                  onCancel={() => setShowParamsDialog(false)}
                />
              </Suspense>
            )}
            {!showAssetLibrary ? (
              courseParams ? (
              <div className="max-w-2xl">
                <h2 className="text-[24px] font-bold text-slate-900 mb-2">Course Configuration</h2>
                <p className="text-[14px] text-slate-600 mb-8">Your course is ready to generate. Review settings below.</p>

                <div className="grid gap-6">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Learning Type</p>
                    <p className="text-[16px] font-semibold text-slate-900">{courseParams.learningType}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Level</p>
                    <p className="text-[16px] font-semibold text-slate-900">{courseParams.level}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Duration</p>
                    <p className="text-[16px] font-semibold text-slate-900">{courseParams.duration}</p>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setShowParamsDialog(true)}
                    className="px-6 py-3 rounded-lg bg-slate-200 text-slate-900 font-semibold hover:bg-slate-300 transition-all"
                  >
                    Modify Settings
                  </button>
                  <button
                    onClick={() => {
                      if (!isRunning && courseParams) startGeneration(courseParams);
                    }}
                    disabled={isRunning || isStartingGeneration}
                    className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isRunning ? "Generating..." : isStartingGeneration ? "Starting..." : "Proceed to Generation"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[16px] text-slate-600 mb-4">Click "Generate" in the Input tab to configure your course</p>
                <button
                  onClick={() => setActiveTab("input")}
                  className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
                >
                  Go to Input
                </button>
              </div>
            )
            ) : (
              <div className="w-full">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-[24px] font-bold text-slate-900">Asset Library</h2>
                  <button
                    onClick={() => setShowAssetLibrary(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    ← Back to Setup
                  </button>
                </div>
                <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
                  <AssetLibraryPanel userId={profile?.id || ''} />
                </Suspense>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Course Output */}
        {activeTab === "output" && (
          <OutputPanel
            outputData={outputData}
            rawOutputs={rawOutputs}
            courseTitle={courseTitle}
            workflowClips={workflowClips}
            courseDuration={courseParams?.duration}
            avatarTrainerId={courseParams?.avatarTrainerId}
            isRunning={isRunning}
            slideLayout={courseParams?.slideLayout}
            learnerNotesEnabled={courseParams?.learnerNotesEnabled}
            resourcesPanelEnabled={courseParams?.resourcesPanelEnabled}
            glossaryEnabled={courseParams?.glossaryEnabled}
            discussionEnabled={courseParams?.discussionEnabled}
            assessmentIntensity={courseParams?.assessmentIntensity}
            flipStylePreference={courseParams?.flipStyle}
            textLanguage={courseParams?.textLanguage || courseParams?.language}
            narratorLanguage={courseParams?.narratorLanguage}
            learningType={courseParams?.learningType}
            onUpdateVisualTopic={updateVisualTopicAsset}
            onUpdateCourseContent={updateCourseContent}
            onOpenLearnerPreview={() => setShowLearnerPreview(true)}
          />
        )}
      </TabContainer>
    </div>
  );
};

export default Index;

