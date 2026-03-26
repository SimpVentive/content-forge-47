import React from "react";
import { AgentInfo, AgentStatus } from "@/types/agents";

const statusConfig: Record<AgentStatus, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-status-idle/20 text-status-idle" },
  running: { label: "Running", className: "bg-status-running/20 text-status-running animate-pulse-blue" },
  complete: { label: "Complete", className: "bg-status-complete/20 text-status-complete" },
  queued: { label: "Queued", className: "bg-status-queued/20 text-status-queued" },
  error: { label: "Error", className: "bg-status-error/20 text-status-error" },
};

interface AgentCardProps {
  agent: AgentInfo;
  isLast?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isLast }) => {
  const status = statusConfig[agent.status];

  return (
    <div className="relative">
      <div
        className={`relative bg-card border rounded-lg p-4 transition-all ${
          agent.status === "running" ? "border-primary shadow-lg shadow-primary/10" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{agent.description}</p>

        {agent.status === "running" && (
          <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-progress" />
          </div>
        )}

        {agent.status === "queued" && (
          <p className="mt-2 text-[10px] text-status-queued italic">Coming in next build</p>
        )}
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex justify-center py-1">
          <div className="w-px h-5 border-l-2 border-dashed border-border" />
        </div>
      )}
    </div>
  );
};
