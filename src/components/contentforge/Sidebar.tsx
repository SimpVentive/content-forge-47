import React, { useRef, useState } from "react";
import { Zap, Upload, Square, FileText, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Estimate e-learning minutes from word count (~150 words/min narrated) */
export function estimateMinutesFromText(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 150));
}

interface SidebarProps {
  courseTitle: string;
  setCourseTitle: (v: string) => void;
  inputText: string;
  setInputText: (v: string) => void;
  onGenerate: () => void;
  onStop: () => void;
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

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string || "";
      // Remove data URL prefix to get raw base64
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

/** Extract a clean course name from filename */
const titleFromFilename = (filename: string): string => {
  // Remove extension
  let name = filename.replace(/\.[^/.]+$/, "");
  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]/g, " ");
  // Remove common prefixes/suffixes
  name = name.replace(/^\d+\s*/, ""); // leading numbers
  // Title case
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return name.trim();
};

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

export const Sidebar: React.FC<SidebarProps> = ({
  courseTitle, setCourseTitle, inputText, setInputText,
  onGenerate, onStop, isRunning,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showTitleConfirm, setShowTitleConfirm] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState("");

  const handleFile = async (file: File) => {
    setUploadedFileName(file.name);

    // Auto-detect course title from filename
    const detectedTitle = titleFromFilename(file.name);
    
    if (isBinaryFile(file.name)) {
      // Show extracting state
      setIsExtracting(true);
      setInputText(`[Document] Extracting content from ${file.name}...`);

      try {
        const base64 = await readFileAsBase64(file);
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        const mimeType = MIME_MAP[ext] || file.type || "application/octet-stream";

        const { data, error } = await supabase.functions.invoke("extract-document", {
          body: { fileBase64: base64, fileName: file.name, mimeType },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        if (data?.unsupported) {
          setInputText(`[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nWarning: ${data.message || "Please paste the content directly."}`);
        } else if (data?.text && data.text.length > 0) {
          setInputText(data.text);
        } else {
          setInputText(`[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nCould not extract text. You can paste additional notes below.`);
        }
      } catch (err) {
        console.error("Document extraction error:", err);
        setInputText(`[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nWarning: Could not extract content automatically. Please paste the key topics and notes manually below.`);
      } finally {
        setIsExtracting(false);
      }
    } else {
      const text = await readFileAsText(file);
      if (text && text.length > 0) {
        setInputText(text);
      } else {
        setInputText(`[Document] Uploaded: ${file.name} - Could not extract text. Try pasting content directly.`);
      }
    }

    // Show title confirmation if title is still default or empty
    setSuggestedTitle(detectedTitle);
    setShowTitleConfirm(true);
  };

  const handleConfirmTitle = (useDetected: boolean) => {
    if (useDetected) {
      setCourseTitle(suggestedTitle);
    }
    setShowTitleConfirm(false);
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
            className="w-full h-11 border-[1.5px] border-border rounded-xl px-3.5 text-[14px] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all duration-200"
            style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.7)" }}
            placeholder="Enter course title..."
          />
        </div>

        {/* Title Confirmation Dialog */}
        {showTitleConfirm && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-fade-in">
            <p className="text-[13px] font-semibold text-foreground mb-2">
              Is this the course you are creating?
            </p>
            <p className="text-[15px] font-bold text-primary mb-3">"{suggestedTitle}"</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmTitle(true)}
                type="button"
                className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-1.5 bg-primary hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                style={{ boxShadow: "0 2px 0 rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)" }}
              >
                <Check className="w-3.5 h-3.5" /> Yes, use this title
              </button>
              <button
                onClick={() => handleConfirmTitle(false)}
                type="button"
                className="flex-1 h-9 rounded-lg text-[13px] font-bold text-foreground flex items-center justify-center gap-1.5 border border-border hover:bg-secondary hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                style={{ boxShadow: "0 2px 0 rgba(0,0,0,0.06), 0 3px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)" }}
              >
                <X className="w-3.5 h-3.5" /> No, I'll change it
              </button>
            </div>
          </div>
        )}

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
            className="border-2 border-dashed border-primary/25 rounded-xl p-4 text-center cursor-pointer hover:bg-primary/[0.04] hover:border-primary hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mb-3"
            style={{ boxShadow: "0 2px 0 rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)" }}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-primary" />
            <p className="text-[13px] font-semibold text-foreground">Drop PPT, PDF or DOCX</p>
            <span className="text-primary text-[12px] font-semibold underline underline-offset-2">Browse files</span>
          </div>

          {/* Uploaded file indicator */}
          {uploadedFileName && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-secondary/50 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[12px] text-foreground truncate flex-1">{uploadedFileName}</span>
              {isExtracting && (
                <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
              )}
              {!isExtracting && (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
            </div>
          )}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="w-full border-[1.5px] border-border rounded-xl px-3.5 py-3 text-[13px] leading-[1.6] text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-all duration-200"
            style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.7)" }}
            placeholder="Paste subject matter notes..."
          />
        </div>

        {isRunning ? (
          <button
            onClick={onStop}
            type="button"
            className="w-full h-[48px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 bg-destructive hover:bg-destructive/90 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200"
            style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.15), 0 6px 12px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.2)" }}
          >
            <Square className="w-4 h-4" />
            Stop Generating
          </button>
        ) : (
          <button
            onClick={onGenerate}
            type="button"
            disabled={!courseTitle.trim() || isExtracting || showTitleConfirm}
            className="w-full h-[48px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 shadow-btn-primary hover:brightness-[1.08] hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            style={{ background: '#2563EB' }}
          >
            {isExtracting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Extracting...
              </>
            ) : showTitleConfirm ? (
              <>
                <X className="w-4 h-4" />
                Confirm Title Choice
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate Course
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

