import React from "react";
import { AgentCard } from "./AgentCard";
import { AgentInfo } from "@/types/agents";
import { Zap } from "lucide-react";

interface AgentPipelineProps {
  agents: AgentInfo[];
  isRunning?: boolean;
  agentToggles: Record<string, boolean>;
  setAgentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents, isRunning, agentToggles, setAgentToggles }) => {
  return (
    <div className="max-w-[720px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[28px] font-[800] text-foreground">Pipeline Agents</h2>
          <p className="text-[14px] text-muted-foreground mt-0.5">Toggle agents on/off · Watch them work in real-time</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2 shadow-card">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-status-complete animate-pulse-dot" : "bg-muted-foreground/30"}`}
          />
          <span className="text-[13px] font-bold text-muted-foreground">
            {isRunning ? "Running" : "Ready"}
          </span>
        </div>
      </div>

      {/* Orchestrator bar */}
      <div className="bg-card rounded-xl shadow-card mb-5 px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-primary" />
          <span className="text-[16px] font-[700] text-foreground">Orchestrator</span>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          The E-Learning Content is now orchestrated using multiple agents. You can manage the Pipeline flow by selecting the tools you want to use for the development of the E-Learning content.
        </p>
      </div>

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
