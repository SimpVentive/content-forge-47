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
      <div className="bg-card rounded-xl shadow-card mb-4 px-5 py-3 flex items-center gap-2" style={{ borderLeft: '4px solid #4f46e5' }}>
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-[13px] font-bold text-primary tracking-wide">ORCHESTRATOR</span>
        <span className="text-[13px] text-muted-foreground ml-1">— Managing pipeline flow</span>
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
