import React from "react";
import { AgentInfo, AgentStatus } from "@/types/agents";
import { Check } from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  research: "#3b82f6",
  architect: "#8b5cf6",
  writer: "#4f46e5",
  visual: "#ec4899",
  animation: "#f97316",
  compliance: "#f59e0b",
  assessment: "#10b981",
  voice: "#06b6d4",
  assembly: "#64748b",
};

const AGENT_INITIALS: Record<string, string> = {
  research: "R",
  architect: "A",
  writer: "W",
  visual: "V",
  animation: "M",
  compliance: "C",
  assessment: "Q",
  voice: "N",
  assembly: "F",
};

const statusConfig: Record<AgentStatus, { label: string; bg: string; text: string }> = {
  idle: { label: "Idle", bg: "#f1f5f9", text: "#64748b" },
  running: { label: "Running", bg: "#4f46e5", text: "#ffffff" },
  complete: { label: "Complete", bg: "#ecfdf5", text: "#059669" },
  queued: { label: "Queued", bg: "#fffbeb", text: "#d97706" },
  error: { label: "Error", bg: "#fef2f2", text: "#dc2626" },
};

interface AgentCardProps {
  agent: AgentInfo;
  isLast?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isLast }) => {
  const status = statusConfig[agent.status];
  const color = AGENT_COLORS[agent.id] || "#64748b";
  const initial = AGENT_INITIALS[agent.id] || "?";

  const leftBorder =
    agent.status === "running" ? `4px solid #4f46e5` :
    agent.status === "complete" ? `4px solid #059669` : "4px solid transparent";

  return (
    <div className="relative">
      <div
        className="bg-card rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-[180ms] flex items-center gap-4 px-6 py-5"
        style={{ borderLeft: leftBorder, background: agent.status === "running" ? "rgba(79,70,229,0.02)" : undefined }}
      >
        {/* Circle icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          <span className="text-white text-[18px] font-bold">{initial}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold text-foreground">{agent.name}</h3>
          <p className="text-[14px] text-muted-foreground truncate">{agent.description}</p>
        </div>

        {/* Status badge */}
        <span
          className="text-[14px] font-semibold px-3 py-1 rounded-full shrink-0 flex items-center gap-1.5"
          style={{ backgroundColor: status.bg, color: status.text }}
        >
          {agent.status === "running" && (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot" />
          )}
          {agent.status === "complete" && (
            <Check className="w-3.5 h-3.5" />
          )}
          {status.label}
        </span>
      </div>

      {/* Connector */}
      {!isLast && (
        <div className="flex justify-center py-0">
          <div className="w-px h-3 border-l-2 border-dashed border-border" />
        </div>
      )}
    </div>
  );
};
