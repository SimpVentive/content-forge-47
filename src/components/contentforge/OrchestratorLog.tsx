import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface OrchestratorLogProps {
  logs: string[];
}

export const OrchestratorLog: React.FC<OrchestratorLogProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-expand when logs start coming in
  useEffect(() => {
    if (logs.length > 0) setIsOpen(true);
  }, [logs.length]);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[14px] font-semibold text-primary flex items-center gap-1 hover:underline transition-all duration-200 mb-2"
      >
        {isOpen ? "Hide" : "Show"} Orchestrator Log
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="bg-card rounded-2xl shadow-card p-5 animate-fade-in">
          <div
            ref={containerRef}
            className="max-h-48 overflow-y-auto font-mono text-[13px] leading-relaxed space-y-1"
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground italic">Waiting for pipeline to start...</p>
            ) : (
              logs.map((log, i) => {
                const isLatest = i === logs.length - 1;
                return (
                  <div
                    key={i}
                    className={`py-0.5 animate-fade-in ${isLatest ? "border-l-2 border-primary pl-3" : "pl-[18px]"}`}
                  >
                    <span className="text-muted-foreground">{log.slice(0, log.indexOf(']') + 1)}</span>
                    <span className="text-foreground">{log.slice(log.indexOf(']') + 1)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
