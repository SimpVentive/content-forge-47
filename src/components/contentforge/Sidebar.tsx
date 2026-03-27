import React from "react";
import { Zap, Upload } from "lucide-react";
import { AGENTS } from "@/types/agents";

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
    <aside className="w-[420px] shrink-0 border-r border-border flex flex-col bg-card">
      <div className="flex-1 overflow-y-auto px-7 py-8 space-y-7">
        {/* Section label */}
        <p className="text-[13px] font-bold text-primary tracking-[0.1em] uppercase">
          Build Your Course
        </p>

        {/* Course Title */}
        <div>
          <label className="text-[15px] font-bold text-foreground mb-2 block">
            Course Title
          </label>
          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="w-full h-12 border-[1.5px] border-border rounded-xl px-4 text-[17px] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors duration-[180ms]"
            placeholder="Enter course title..."
          />
        </div>

        {/* Source Material */}
        <div>
          <label className="text-[15px] font-bold text-foreground mb-1 block">
            Source Material
          </label>
          <p className="text-[13px] text-muted-foreground mb-3">
            Upload a file or paste your SME notes below
          </p>

          {/* Drag-drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-primary/25 rounded-2xl p-6 text-center cursor-pointer hover:bg-primary/[0.04] hover:border-primary transition-all duration-[180ms] mb-4"
          >
            <Upload className="w-9 h-9 mx-auto mb-3 text-primary" />
            <p className="text-[15px] font-semibold text-foreground mb-1">Drop PPT, PDF or DOCX here</p>
            <div className="flex items-center gap-3 justify-center my-2">
              <div className="h-px w-8 bg-border" />
              <span className="text-[13px] text-muted-foreground">or</span>
              <div className="h-px w-8 bg-border" />
            </div>
            <span className="text-primary text-[14px] font-semibold underline underline-offset-2">Browse files</span>
          </div>

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={10}
            className="w-full border-[1.5px] border-border rounded-xl px-4 py-3.5 text-[15px] leading-[1.6] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors duration-[180ms]"
            placeholder="Paste subject matter notes..."
          />
        </div>

        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={isRunning || !courseTitle.trim()}
          className="w-full h-14 rounded-xl text-[17px] font-bold text-white flex items-center justify-center gap-2.5 shadow-btn-primary hover:brightness-[1.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[180ms]"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          {isRunning ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Generate Course
            </>
          )}
        </button>

        {/* Pipeline Toggles */}
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-3">Pipeline Agents</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {AGENTS.map((agent) => (
              <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                <button
                  onClick={() => setAgentToggles(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                  className={`w-10 h-[22px] rounded-full transition-colors duration-[180ms] relative shrink-0 ${
                    agentToggles[agent.id] ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-[180ms] ${
                      agentToggles[agent.id] ? "translate-x-[22px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
                <span className="text-[14px] font-semibold text-foreground truncate">{agent.name.replace(' Agent', '')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
