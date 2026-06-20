import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContentForge } from "@/hooks/ContentForgeContext";
import type { CourseParameters } from "@/components/contentforge/CourseParametersDialog";
import { estimateMinutesFromText } from "@/components/contentforge/Sidebar";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import type { InsertedVideo } from "@/components/contentforge/VideosTab";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import type { OutputData, RawAgentOutputs } from "@/types/agents";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";
import { Plus, Play, Clock3, Loader2, Save, FolderOpen, Trash2 } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
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
import { spendCredits } from "@/lib/edgeFunctions";

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
  const learningType = (location.state as any)?.learningType || "static";
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
    } else {
      // heygen is video-only
      base.heygen = false;
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
  } = useAgentPipeline();

  const refreshDrafts = async () => {
    const nextDrafts = await listCourseDraftsCloudFirst();
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    void refreshDrafts();
  }, []);

  // Sync learningMode from learningType on mount
  useEffect(() => {
    if (learningType === "video" && learningMode === "static_elearning") {
      setLearningMode("video_learning");
    }
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

  const handleParamsConfirm = async (params: CourseParameters) => {
    setCourseParams(params);
    setShowParamsDialog(false);

    // Update agent toggles based on assessment requirement and learning type
    if (!params.assessmentRequired) {
      setAgentToggles((prev) => ({ ...prev, assessment: false }));
    } else {
      setAgentToggles((prev) => ({ ...prev, assessment: true }));
    }

    // Re-sync agent toggles based on confirmed learning type
    if (params.learningType === "video" || params.learningType === "image") {
      setAgentToggles((prev) => ({ ...prev, animation: false, youtube: false, compliance: false, heygen: true }));
    } else {
      setAgentToggles((prev) => ({ ...prev, animation: true, youtube: true, compliance: true, heygen: false }));
    }

    // For video and image modes: verify HeyGen is configured (auto-seeded on app boot)
    if (params.learningType === "video" || params.learningType === "image") {
      const { getHeyGenSettings } = await import("@/lib/heygenDefaults");
      const heygenConfig = getHeyGenSettings();
      if (!heygenConfig?.apiKey) {
        toast.warning("Video generation not configured. Contact admin to set up HeyGen API.");
        return;
      }
    }

    const estimated = estimateMinutesFromText(inputText);

    // Build effective video settings from params for video mode
    const effectiveVideoSettings =
      params.learningType === "video"
        ? {
            selectedAvatar: params.avatarTrainerId || "rachel",
            videoQuality: params.videoQuality,
            backgroundStyle: params.backgroundStyle,
          }
        : undefined;

    // Admins bypass credit checks and deductions (for internal testing).
    if (isAdmin) {
      runPipeline(courseTitle, inputText, agentToggles, {
        ...params,
        learningMode: learningMode,
        videoSettings: effectiveVideoSettings,
      });
      toast.success("Admin run — credits not deducted");
      return;
    }

    const availableCredits = (profile?.credits_total ?? 0) - (profile?.credits_used ?? 0);

    if (estimated > availableCredits) {
      setRequiredCredits(estimated);
      setShowInsufficientCredits(true);
      return;
    }

    try {
      await spendCredits(estimated, "course_generation");
      await refreshProfile();
      runPipeline(courseTitle, inputText, agentToggles, {
        ...params,
        learningMode: learningMode,
        videoSettings: effectiveVideoSettings,
      });
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
      <InsufficientCreditsModal
        open={showInsufficientCredits}
        requiredCredits={requiredCredits}
        onClose={() => setShowInsufficientCredits(false)}
      />
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
          />
        </Suspense>
      )}

      {showParamsDialog && (
        <Suspense fallback={null}>
          <CourseParametersDialog
            open={showParamsDialog}
            courseTitle={courseTitle}
            estimatedMinutes={estimateMinutesFromText(inputText)}
            youtubeAgentEnabled={agentToggles.youtube}
            initialLearningType={learningType as "static" | "video" | "image"}
            onConfirm={handleParamsConfirm}
            onCancel={() => setShowParamsDialog(false)}
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

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <Sidebar
            courseTitle={courseTitle}
            setCourseTitle={setCourseTitle}
            inputText={inputText}
            setInputText={setInputText}
            onGenerate={handleGenerateClick}
            onStop={stopPipeline}
            isRunning={isRunning}
            agentToggles={agentToggles}
            setAgentToggles={setAgentToggles}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
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

                  <div className="inline-flex items-center gap-2 rounded-full border border-[#bfd3fb] bg-white px-3 py-1.5 text-[13px] font-bold text-[#1e3a8a]">
                    <Clock3 className="h-4 w-4" />
                    <span>{elapsedLabel}</span>
                  </div>
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
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={15} maxSize={45}>
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
            onUpdateVisualTopic={updateVisualTopicAsset}
            onUpdateCourseContent={updateCourseContent}
            onOpenLearnerPreview={() => setShowLearnerPreview(true)}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;

