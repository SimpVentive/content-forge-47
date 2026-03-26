import React, { useEffect, useRef } from "react";

interface OrchestratorLogProps {
  logs: string[];
}

export const OrchestratorLog: React.FC<OrchestratorLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="border-t border-border bg-surface-deep">
      <div className="px-4 py-2 border-b border-border/50">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Orchestrator Log</h3>
      </div>
      <div
        ref={containerRef}
        className="h-32 overflow-y-auto px-4 py-2 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-muted-foreground italic">Waiting for pipeline to start...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-terminal-text animate-fade-in">{log}</div>
          ))
        )}
      </div>
    </div>
  );
};
