import React from "react";
import { AgentCard } from "./AgentCard";
import { AgentInfo } from "@/types/agents";
import { Activity } from "lucide-react";

interface AgentPipelineProps {
  agents: AgentInfo[];
}

export const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents }) => {
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6">
      <h2 className="text-lg font-semibold text-foreground mb-5">Agent Pipeline</h2>

      {/* Orchestrator background layer */}
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-xl border border-dashed border-primary/20 bg-primary/[0.03]" />
        <div className="absolute -top-1 left-4 px-2 py-0.5 bg-background text-[10px] font-medium text-primary/60 uppercase tracking-widest">
          Orchestrator — managing flow
        </div>

        <div className="relative pt-5 pb-3 px-1 space-y-0">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} isLast={i === agents.length - 1} />
          ))}
        </div>
      </div>

      {/* Feedback & Analytics Agent */}
      <div className="mt-6 border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Feedback & Analytics Agent</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-idle/20 text-status-idle ml-auto">
            Idle
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Collects learner feedback and generates performance analytics</p>
      </div>
    </div>
  );
};
