import { useState } from "react";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";
import { Zap, Plus } from "lucide-react";

const Index = () => {
  const [courseTitle, setCourseTitle] = useState(SAMPLE_TITLE);
  const [inputText, setInputText] = useState(SAMPLE_NOTES);
  const [agentToggles, setAgentToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(AGENTS.map((a) => [a.id, true]))
  );

  const { agents, outputData, logs, isRunning, runPipeline } = useAgentPipeline();

  const handleGenerate = () => {
    runPipeline(courseTitle, inputText, agentToggles);
  };

  const hasOutput = !!(outputData.outline || outputData.script || outputData.assessment || outputData.package);
  const hasRun = logs.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="h-[68px] shrink-0 bg-card border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <Zap className="w-[22px] h-[22px] text-primary" strokeWidth={2.5} />
          <span className="text-[22px] font-[800] text-foreground tracking-tight">ContentForge</span>
        </div>
        <button className="h-[44px] px-5 bg-primary text-primary-foreground rounded-lg text-[15px] font-bold shadow-btn-primary hover:brightness-110 transition-all duration-[180ms] flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Course
        </button>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        <Sidebar
          courseTitle={courseTitle}
          setCourseTitle={setCourseTitle}
          inputText={inputText}
          setInputText={setInputText}
          onGenerate={handleGenerate}
          isRunning={isRunning}
          agentToggles={agentToggles}
          setAgentToggles={setAgentToggles}
        />

        {/* Right Panel */}
        <div className="flex-1 overflow-y-auto p-8" style={{ background: '#f0f2f7' }}>
          {!hasRun && !hasOutput ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              {/* Geometric illustration */}
              <div className="mb-8 relative w-48 h-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div className="absolute top-2 left-6 w-10 h-10 rounded-full bg-[#8b5cf6]/15" />
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#ec4899]/15" />
                <div className="absolute bottom-6 left-4 w-7 h-7 rounded-full bg-[#10b981]/15" />
                <div className="absolute bottom-2 right-8 w-12 h-12 rounded-full bg-[#f97316]/10" />
                <div className="absolute top-1/2 left-0 w-6 h-6 rounded-full bg-[#06b6d4]/15" />
                <div className="absolute bottom-12 right-0 w-5 h-5 rounded-full bg-[#f59e0b]/15" />
              </div>
              <h2 className="text-[28px] font-[800] text-foreground mb-3">Ready to forge your course</h2>
              <p className="text-[16px] text-muted-foreground mb-4">Fill in your course details on the left and hit Generate</p>
              <button
                onClick={() => {
                  setCourseTitle(SAMPLE_TITLE);
                  setInputText(SAMPLE_NOTES);
                }}
                className="text-primary text-[15px] font-semibold hover:underline transition-all duration-[180ms]"
              >
                → Start with a sample
              </button>
            </div>
          ) : (
            <div className="space-y-6 max-w-[960px] mx-auto">
              {/* Agent Pipeline */}
              <AgentPipeline agents={agents} isRunning={isRunning} />

              {/* Output */}
              <OutputPanel outputData={outputData} />

              {/* Orchestrator Log */}
              <OrchestratorLog logs={logs} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
