import React from "react";
import { Zap, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENTS, SAMPLE_TITLE, SAMPLE_NOTES } from "@/types/agents";

interface SidebarProps {
  courseTitle: string;
  setCourseTitle: (v: string) => void;
  inputText: string;
  setInputText: (v: string) => void;
  onGenerate: () => void;
  isRunning: boolean;
  agentToggles: Record<string, boolean>;
  setAgentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  courseTitle, setCourseTitle, inputText, setInputText,
  onGenerate, isRunning, agentToggles, setAgentToggles,
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setInputText(`[Uploaded: ${file.name}] — File parsing coming soon. Paste text content below instead.`);
    }
  };

  return (
    <aside className="w-[260px] shrink-0 border-r border-border flex flex-col bg-card">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">ContentForge</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Drop PPT, PDF, DOCX or paste text below</p>
        </div>

        {/* Course title */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Course Title
          </label>
          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Enter course title..."
          />
        </div>

        {/* SME Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            SME Notes / Content
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={6}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder="Paste subject matter notes..."
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={onGenerate}
          disabled={isRunning || !courseTitle.trim()}
          className="w-full h-10 font-semibold"
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Generating...
            </span>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Course
            </>
          )}
        </Button>

        {/* Pipeline Settings */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Pipeline Settings
          </h3>
          <div className="space-y-2">
            {AGENTS.map((agent) => (
              <label key={agent.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground/80 truncate mr-2">{agent.name}</span>
                <button
                  onClick={() => setAgentToggles(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    agentToggles[agent.id] ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                      agentToggles[agent.id] ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
