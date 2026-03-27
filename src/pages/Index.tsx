import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";
import { Plus, Play } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import contentForgeLogo from "@/assets/contentforge-logo.png";
import { LearnerPreview } from "@/components/contentforge/LearnerPreview";
import { CourseParametersDialog, CourseParameters } from "@/components/contentforge/CourseParametersDialog";
import { VideoClipWorkflow } from "@/components/contentforge/VideoClipWorkflow";

const Index = () => {
  const [courseTitle, setCourseTitle] = useState(SAMPLE_TITLE);
  const [inputText, setInputText] = useState(SAMPLE_NOTES);
  const [agentToggles, setAgentToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(AGENTS.map((a) => [a.id, true]))
  );
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [courseParams, setCourseParams] = useState<CourseParameters | null>(null);
  const [showVideoWorkflow, setShowVideoWorkflow] = useState(false);
  const prevIsRunning = useRef(false);

  const { agents, outputData, rawOutputs, logs, isRunning, runPipeline, stopPipeline } = useAgentPipeline();

  // Detect pipeline completion → trigger video workflow
  useEffect(() => {
    if (prevIsRunning.current && !isRunning && rawOutputs.youtube) {
      // Pipeline just finished and has youtube data
      setTimeout(() => setShowVideoWorkflow(true), 800);
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, rawOutputs.youtube]);

  // Extract module names from architect output
  const getModuleNames = (): string[] => {
    try {
      const parsed = JSON.parse(rawOutputs.architect || "{}");
      const mods = parsed.modules || parsed.course_structure?.modules || parsed.course_modules || [];
      return mods.map((m: any) => m.module_title || m.title || m.name || "").filter(Boolean);
    } catch {
      return [courseTitle];
    }
  };

  const handleGenerateClick = () => {
    // Show parameters dialog before generating
    setShowParamsDialog(true);
  };

  const handleParamsConfirm = (params: CourseParameters) => {
    setCourseParams(params);
    setShowParamsDialog(false);
    // Disable assessment agent if not required
    if (!params.assessmentRequired) {
      setAgentToggles(prev => ({ ...prev, assessment: false }));
    } else {
      setAgentToggles(prev => ({ ...prev, assessment: true }));
    }
    runPipeline(courseTitle, inputText, agentToggles, params);
  };

  const hasRun = logs.length > 0;
  const hasOutput = Object.values(rawOutputs).some(v => v);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="h-[68px] shrink-0 bg-card border-b border-border flex items-center justify-between px-6 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-md">
            <img src={contentForgeLogo} alt="ContentForge" className="w-11 h-11 object-contain" />
          </div>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 select-none">
          <span className="text-[38px] font-[900] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: '#1e3a5f' }}>
            Content
          </span>
          <span className="relative text-[38px] font-[900] tracking-tight" style={{
            fontFamily: "'Outfit', sans-serif",
            background: 'linear-gradient(135deg, #0e7490 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 4px rgba(14,116,144,0.3))',
          }}>
            Forge
            {/* Spark icon */}
            <svg className="absolute -top-2.5 -right-4 w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="url(#spark-grad)" />
              <defs>
                <linearGradient id="spark-grad" x1="4" y1="2" x2="20" y2="18">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasOutput && (
            <button
              onClick={() => setShowLearnerPreview(true)}
              className="h-[44px] px-5 rounded-lg text-[15px] font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all duration-[180ms] flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Preview as Learner
            </button>
          )}
          <button className="h-[44px] px-5 bg-primary text-primary-foreground rounded-lg text-[15px] font-bold shadow-btn-primary hover:brightness-110 transition-all duration-[180ms] flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Course
          </button>
        </div>
      </header>

      {/* Learner Preview Modal */}
      {showLearnerPreview && (
        <LearnerPreview
          courseTitle={courseTitle}
          rawOutputs={rawOutputs}
          onClose={() => setShowLearnerPreview(false)}
        />
      )}

      {/* Course Parameters Dialog */}
      <CourseParametersDialog
        open={showParamsDialog}
        courseTitle={courseTitle}
        onConfirm={handleParamsConfirm}
        onCancel={() => setShowParamsDialog(false)}
      />

      {/* YouTube Clip Workflow — triggered after pipeline completes */}
      {showVideoWorkflow && rawOutputs.youtube && (
        <VideoClipWorkflow
          youtubeRaw={rawOutputs.youtube}
          modules={getModuleNames()}
          courseTitle={courseTitle}
          language={courseParams?.language}
          level={courseParams?.level}
          duration={courseParams?.duration}
          onComplete={(clips) => {
            setShowVideoWorkflow(false);
          }}
          onSkip={() => setShowVideoWorkflow(false)}
        />
      )}

      {/* 3-column resizable layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left — Course Input */}
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

        {/* Center — Agent Pipeline (hero) */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full overflow-y-auto p-6" style={{ background: '#f0f2f7' }}>
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

        {/* Right — Output */}
        <ResizablePanel defaultSize={30} minSize={15} maxSize={45}>
          <OutputPanel outputData={outputData} rawOutputs={rawOutputs} courseTitle={courseTitle} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;
