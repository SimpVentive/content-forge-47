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
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[22px] font-[800] text-foreground tracking-tight">ContentForge</span>
        </div>
        <button className="h-[44px] px-5 bg-primary text-primary-foreground rounded-lg text-[15px] font-bold shadow-btn-primary hover:brightness-110 transition-all duration-[180ms] flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Course
        </button>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left — Course Input (compact) */}
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

        {/* Center — Agent Pipeline (hero) */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: '#f0f2f7' }}>
          {!hasRun ? (
            <AgentPipeline agents={agents} isRunning={isRunning} agentToggles={agentToggles} setAgentToggles={setAgentToggles} />
          ) : (
            <div className="space-y-6 max-w-[720px] mx-auto">
              <AgentPipeline agents={agents} isRunning={isRunning} agentToggles={agentToggles} setAgentToggles={setAgentToggles} />
              <OrchestratorLog logs={logs} />
            </div>
          )}
        </div>

        {/* Right — Output */}
        <OutputPanel outputData={outputData} />
      </div>
    </div>
  );
};

export default Index;
