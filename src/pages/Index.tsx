import { useState } from "react";
import { Sidebar } from "@/components/contentforge/Sidebar";
import { AgentPipeline } from "@/components/contentforge/AgentPipeline";
import { OutputPanel } from "@/components/contentforge/OutputPanel";
import { OrchestratorLog } from "@/components/contentforge/OrchestratorLog";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex overflow-hidden">
          <AgentPipeline agents={agents} />
          <OutputPanel outputData={outputData} />
        </div>
        <OrchestratorLog logs={logs} />
      </div>
    </div>
  );
};

export default Index;
