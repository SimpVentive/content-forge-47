import React from "react";
import { AgentCard } from "./AgentCard";
import { AgentInfo } from "@/types/agents";
import { Loader2, Zap } from "lucide-react";

interface AgentPipelineProps {
  agents: AgentInfo[];
  isRunning?: boolean;
  agentToggles: Record<string, boolean>;
  setAgentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents, isRunning, agentToggles, setAgentToggles }) => {
  const enabledAgents = agents.filter((agent) => agentToggles[agent.id] ?? true).length;

  return (
    <div className="max-w-[720px] mx-auto relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-[700] text-foreground">Pipeline Agents</h2>
          <p className="text-[14px] text-muted-foreground mt-0.5">Toggle agents on/off · Watch them work in real-time</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-card">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          )}
          <span className="text-[13px] font-bold text-muted-foreground">
            {isRunning ? `Running · ${enabledAgents} active` : `${enabledAgents} active`}
          </span>
        </div>
      </div>

      {/* Orchestrator bar */}
      <div className={`rounded-xl shadow-card mb-5 px-5 py-4 transition-colors ${isRunning ? "border border-primary/15 bg-primary/[0.05]" : "bg-card"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-primary" />
          <span className="text-[16px] font-[700] text-foreground">Orchestrator</span>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {isRunning
            ? "AI is building the course now. You can still monitor agent progress here while the main workspace keeps updating."
            : "Choose which agents participate in the build, then start generation when the course input is ready."}
        </p>
      </div>

      {isRunning && (
        <div className="mb-6 overflow-hidden rounded-[20px] shadow-[0_14px_34px_rgba(15,23,42,0.14)]">
          <img
            src="/orchestration-waiting.svg"
            alt="Hang on tight orchestration panel"
            className="w-full object-contain"
          />
        </div>
      )}

      {/* Agent cards */}
      <div className="space-y-0">
        {agents.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isLast={i === agents.length - 1}
            enabled={agentToggles[agent.id] ?? true}
            onToggle={() => setAgentToggles(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
          />
        ))}
      </div>
    </div>
  );
};
