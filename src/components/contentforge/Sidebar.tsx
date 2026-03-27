import React, { useRef } from "react";
import { Zap, Upload } from "lucide-react";

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

const BINARY_EXTENSIONS = ['.pptx', '.ppt', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.zip'];

const isBinaryFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return BINARY_EXTENSIONS.includes(ext);
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || "");
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
};

export const Sidebar: React.FC<SidebarProps> = ({
  courseTitle, setCourseTitle, inputText, setInputText,
  onGenerate, isRunning,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await readFileAsText(file);
    if (text && text.length > 0) {
      setInputText(text);
    } else {
      setInputText(`[Uploaded: ${file.name}] — Could not extract text. Try pasting content directly.`);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        <p className="text-[12px] font-bold text-primary tracking-[0.12em] uppercase">
          Course Input
        </p>

        <div>
          <label className="text-[14px] font-semibold text-foreground mb-1.5 block">Course Title</label>
          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="w-full h-11 border-[1.5px] border-border rounded-xl px-3.5 text-[14px] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors duration-[180ms]"
            placeholder="Enter course title..."
          />
        </div>

        <div>
          <label className="text-[14px] font-semibold text-foreground mb-1 block">Source Material</label>
          <p className="text-[12px] text-muted-foreground mb-2">Upload or paste SME notes</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.xml,.html,.doc,.docx,.ppt,.pptx,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-primary/25 rounded-xl p-4 text-center cursor-pointer hover:bg-primary/[0.04] hover:border-primary transition-all duration-[180ms] mb-3"
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-primary" />
            <p className="text-[13px] font-semibold text-foreground">Drop PPT, PDF or DOCX</p>
            <span className="text-primary text-[12px] font-semibold underline underline-offset-2">Browse files</span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="w-full border-[1.5px] border-border rounded-xl px-3.5 py-3 text-[13px] leading-[1.6] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors duration-[180ms]"
            placeholder="Paste subject matter notes..."
          />
        </div>

        <button
          onClick={onGenerate}
          disabled={isRunning || !courseTitle.trim()}
          className="w-full h-[48px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 shadow-btn-primary hover:brightness-[1.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[180ms]"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          {isRunning ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Course
            </>
          )}
        </button>
      </div>
    </div>
  );
};
