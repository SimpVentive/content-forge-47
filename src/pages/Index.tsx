import { useState } from "react";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";
import { Plus } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import contentForgeLogo from "@/assets/contentforge-logo.png";

const Index = () => {
  const [courseTitle, setCourseTitle] = useState(SAMPLE_TITLE);
  const [inputText, setInputText] = useState(SAMPLE_NOTES);
  const [agentToggles, setAgentToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(AGENTS.map((a) => [a.id, true]))
  );

  const { agents, outputData, rawOutputs, logs, isRunning, runPipeline } = useAgentPipeline();

  const handleGenerate = () => {
    runPipeline(courseTitle, inputText, agentToggles);
  };

  const hasRun = logs.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="h-[68px] shrink-0 bg-card border-b border-border flex items-center justify-between px-6 relative">
        <div className="flex items-center gap-2.5">
          <img src={contentForgeLogo} alt="ContentForge" className="w-9 h-9 rounded-lg" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[28px] font-[800] text-foreground tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
          ContentForge
        </span>
        <button className="h-[44px] px-5 bg-primary text-primary-foreground rounded-lg text-[15px] font-bold shadow-btn-primary hover:brightness-110 transition-all duration-[180ms] flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Course
        </button>
      </header>

      {/* 3-column resizable layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left — Course Input */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
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
