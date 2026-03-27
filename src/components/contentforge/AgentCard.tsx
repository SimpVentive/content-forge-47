import React from "react";
import { AgentInfo, AgentStatus } from "@/types/agents";
import { Check } from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  research: "#3b82f6",
  architect: "#0891b2",
  writer: "#0e7490",
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
  enabled: boolean;
  onToggle: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isLast, enabled, onToggle }) => {
  const status = statusConfig[agent.status];
  const color = AGENT_COLORS[agent.id] || "#64748b";
  const initial = AGENT_INITIALS[agent.id] || "?";

  return (
    <div className="relative">
      <div
        className={`bg-card rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-[180ms] flex items-center gap-4 px-5 py-4 ${!enabled ? "opacity-50" : ""}`}
      >
        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="relative shrink-0 w-[44px] h-[24px] rounded-full transition-colors duration-200 cursor-pointer"
          style={{ backgroundColor: enabled ? "hsl(192, 91%, 36%)" : "#cbd5e1" }}
          type="button"
          role="switch"
          aria-checked={enabled}
        >
          <span
            className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-200"
            style={{ left: enabled ? "23px" : "3px" }}
          />
        </button>

        {/* Circle icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: enabled ? color : '#94a3b8' }}
        >
          <span className="text-white text-[17px] font-bold">{initial}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold text-foreground leading-tight">{agent.name}</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{agent.description}</p>
        </div>

        {/* Status badge */}
        <span
          className="text-[13px] font-semibold px-3 py-1 rounded-full shrink-0 flex items-center gap-1.5"
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

        {/* Progress bar when running */}
        {agent.status === "running" && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary/10 rounded-b-xl overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-progress" />
          </div>
        )}
      </div>

      {/* Connector */}
      {!isLast && (
        <div className="flex justify-center">
          <div className="w-px h-2.5 border-l-2 border-dashed border-border" />
        </div>
      )}
    </div>
  );
};
