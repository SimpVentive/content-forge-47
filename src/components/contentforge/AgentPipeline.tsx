import React from "react";
import { AgentCard } from "./AgentCard";
import { AgentInfo } from "@/types/agents";
import { Zap } from "lucide-react";

interface AgentPipelineProps {
  agents: AgentInfo[];
  isRunning?: boolean;
}

export const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents, isRunning }) => {
  return (
    <div className="bg-card rounded-2xl shadow-card p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[24px] font-[800] text-foreground">Agent Pipeline</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-status-complete animate-pulse-dot" : "bg-muted-foreground/40"}`}
          />
          <span className="text-[13px] font-semibold text-muted-foreground">
            {isRunning ? "Live" : "Ready"}
          </span>
        </div>
      </div>

      {/* Orchestrator bar */}
      <div className="w-full h-9 rounded-lg flex items-center justify-center mb-5" style={{ background: 'rgba(79,70,229,0.08)' }}>
        <span className="text-[12px] font-bold text-primary tracking-wide flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          ORCHESTRATOR — Managing pipeline flow
        </span>
      </div>

      {/* Agent cards */}
      <div className="space-y-0">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} isLast={i === agents.length - 1} />
        ))}
      </div>
    </div>
  );
};
