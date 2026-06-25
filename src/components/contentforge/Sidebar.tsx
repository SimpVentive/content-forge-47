import React, { useRef, useState } from "react";
import { Zap, Upload, Square, FileText, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TitleFormatter } from "./TitleFormatter";
import { RichTitleEditor, type TitleSpan } from "./RichTitleEditor";
import { LogoUploader } from "./LogoUploader";
import { SOPFormatDialog } from "./SOPFormatDialog";

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
  isStartingGeneration?: boolean;
  agentToggles: Record<string, boolean>;
  setAgentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  contentType?: "learning-course" | "work-instruction";
  setContentType?: (v: "learning-course" | "work-instruction") => void;
  titleSpans?: TitleSpan[];
  setTitleSpans?: (v: TitleSpan[]) => void;
  companyLogo?: string | null;
  setCompanyLogo?: (v: string | null) => void;
}

const BINARY_EXTENSIONS = ['.pptx', '.ppt', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.zip'];

const isBinaryFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return BINARY_EXTENSIONS.includes(ext);
};

const detectSOP = (text: string): boolean => {
  if (!text) return false;
  const sopKeywords = /\b(standard operating procedure|SOP|work instruction|procedure|step-by-step|how to|step \d+|procedure:|instructions:|steps:)\b/i;
  const procedureMarkers = /^\s*step\s+\d+:|^\s*\d+\.\s+/m;
  const sopScore = (sopKeywords.test(text) ? 1 : 0) + (procedureMarkers.test(text) ? 1 : 0);
  return sopScore >= 1;
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

const stripHtmlToReadableText = (html: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, svg, noscript").forEach((node) => node.remove());
    const title = doc.querySelector("title")?.textContent?.trim() || "";
    const bodyText = doc.body?.textContent || doc.documentElement.textContent || "";
    return [title, bodyText]
      .filter(Boolean)
      .join("\n\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();
  } catch {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
};

const isHtmlUpload = (filename: string, text: string): boolean => {
  const lower = filename.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
  isStartingGeneration = false,
  contentType = "learning-course",
  setContentType,
  titleSpans = [],
  setTitleSpans,
  companyLogo,
  setCompanyLogo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showTitleConfirm, setShowTitleConfirm] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [showFormatSelection, setShowFormatSelection] = useState(false);
  const [detectedSOP, setDetectedSOP] = useState(false);
  const [showCourseOutline, setShowCourseOutline] = useState(false);
  const [contentMode, setContentMode] = useState<"upload" | "paste" | null>(null);

  const isStep1Complete = courseTitle.trim().length > 0;
  const isStep2Complete = contentMode !== null && inputText.trim().length > 0;

  const handleFile = async (file: File) => {
    setUploadedFileName(file.name);

    // Auto-detect course title from filename
    const detectedTitle = titleFromFilename(file.name);
    // Apply the title immediately so Generate is never blocked while extraction runs.
    if (!courseTitle.trim()) {
      setCourseTitle(detectedTitle);
    }

    let extractedText = "";

    if (isBinaryFile(file.name)) {
      // Show extracting state
      setIsExtracting(true);
      setInputText(`[Document] Extracting content from ${file.name}...`);

      try {
        const base64 = await readFileAsBase64(file);
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        const mimeType = MIME_MAP[ext] || file.type || "application/octet-stream";

        const { data, error } = await withTimeout(
          supabase.functions.invoke("extract-document", {
            body: { fileBase64: base64, fileName: file.name, mimeType },
          }),
          25000,
          "Document extraction timed out"
        );

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        if (data?.unsupported) {
          extractedText = `[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nWarning: ${data.message || "Please paste the content directly."}`;
          setInputText(extractedText);
        } else if (data?.text && data.text.length > 0) {
          extractedText = data.text;
          setInputText(extractedText);
        } else {
          extractedText = `[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nCould not extract text. You can paste additional notes below.`;
          setInputText(extractedText);
        }
      } catch (err) {
        console.error("Document extraction error:", err);
        extractedText = `[Document] Uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\nWarning: Could not extract content automatically. Please paste the key topics and notes manually below.`;
        setInputText(extractedText);
      } finally {
        setIsExtracting(false);
      }
    } else {
      const text = await readFileAsText(file);
      if (text && text.length > 0) {
        extractedText = isHtmlUpload(file.name, text) ? stripHtmlToReadableText(text) : text;
        setInputText(extractedText);
      } else {
        extractedText = `[Document] Uploaded: ${file.name} - Could not extract text. Try pasting content directly.`;
        setInputText(extractedText);
      }
    }

    // Detect if this is an SOP and show format selection
    const isSOP = detectSOP(extractedText);
    if (isSOP) {
      setDetectedSOP(true);
      setShowFormatSelection(true);
    }

    // Always show title confirmation after file upload
    setSuggestedTitle(detectedTitle);
    setShowTitleConfirm(true);
  };

  const handleConfirmTitle = (useDetected: boolean) => {
    if (useDetected) {
      setCourseTitle(suggestedTitle);
    }
    setShowTitleConfirm(false);
  };

  const handleFormatSelection = (format: "learning-course" | "work-instruction") => {
    if (setContentType) {
      setContentType(format);
    }
    setShowFormatSelection(false);
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
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {/* Progress Breadcrumbs */}
        <div className="flex items-start gap-3 mb-6">
          {/* Step 1 */}
          <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-bold transition-all ${isStep1Complete ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
              1
            </div>
            <p className="text-[10px] font-semibold text-slate-600 mt-1.5 text-center whitespace-nowrap">Course<br />Title</p>
          </div>

          {/* Connector Line 1 */}
          <div className="flex-1 h-1 rounded-full transition-all mt-1 self-start" style={{ marginTop: '4px', height: '2px', background: isStep1Complete ? '#2563eb' : '#e2e8f0' }} />

          {/* Step 2 */}
          <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-bold transition-all ${isStep2Complete ? "bg-blue-600 text-white" : isStep1Complete ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-400"}`}>
              2
            </div>
            <p className="text-[10px] font-semibold text-slate-600 mt-1.5 text-center whitespace-nowrap">Course<br />Content</p>
          </div>

          {/* Connector Line 2 */}
          <div className="flex-1 h-1 rounded-full transition-all mt-1 self-start" style={{ marginTop: '4px', height: '2px', background: isStep2Complete ? '#2563eb' : isStep1Complete ? '#dbeafe' : '#e2e8f0' }} />

          {/* Step 3 */}
          <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-bold transition-all ${isStep2Complete ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>
              3
            </div>
            <p className="text-[10px] font-semibold text-slate-600 mt-1.5 text-center whitespace-nowrap">Branding</p>
          </div>
        </div>

        <p className="text-[11px] font-bold text-blue-600 tracking-[0.15em] uppercase opacity-80">
          Step 1: Course Title
        </p>

        <div>
          <label className="text-[13px] font-bold text-slate-900 mb-1.5 block">Course Title</label>
          <textarea
            ref={titleInputRef}
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => setIsTitleFocused(false)}
            placeholder="Enter an engaging course title..."
            className={`w-full border-[1.5px] border-slate-300 rounded-lg px-4 py-3 text-[14px] text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 resize-none font-medium ${
              isTitleFocused ? "min-h-24" : "min-h-11"
            }`}
          />

          {/* Title Formatting Panel */}
          <TitleFormatter
            title={courseTitle}
            setTitle={setCourseTitle}
            isOpen={isTitleFocused}
          />

          {/* Rich Text Editor for per-section formatting */}
          {isTitleFocused && setTitleSpans && (
            <RichTitleEditor
              title={courseTitle}
              spans={titleSpans}
              onTitleChange={(text, spans) => {
                setCourseTitle(text);
                setTitleSpans(spans);
              }}
              isOpen={isTitleFocused}
            />
          )}
        </div>

        {/* Step 2: Course Content */}
        <div className={`pt-2 ${!isStep1Complete ? "opacity-50 pointer-events-none" : ""}`}>
          <p className="text-[11px] font-bold text-blue-600 tracking-[0.15em] uppercase opacity-80 mb-3">
            Step 2: Course Content
          </p>
          <p className="text-[13px] text-slate-700 font-medium mb-3">How would you like to provide the course content?</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => {
                setContentMode("upload");
                setShowCourseOutline(false);
              }}
              className={`p-3 rounded-lg border-2 transition-all font-semibold text-[12px] ${
                contentMode === "upload"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"
              }`}
            >
              📤 Upload File
            </button>
            <button
              onClick={() => {
                setContentMode("paste");
                setShowCourseOutline(true);
              }}
              className={`p-3 rounded-lg border-2 transition-all font-semibold text-[12px] ${
                contentMode === "paste"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"
              }`}
            >
              ✏️ Enter Outline
            </button>
          </div>
        </div>

        {/* SOP Format Dialog - Modal */}
        <SOPFormatDialog
          open={showFormatSelection && detectedSOP}
          onFormatSelect={handleFormatSelection}
        />

        {/* Upload/Paste Section */}
        {isStep1Complete && contentMode && (
          <div>
            {contentMode === "upload" && (
              <>
                <p className="text-[12px] text-slate-500 mb-2">Upload your course materials</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json,.xml,.html,.htm,.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}

            {contentMode === "paste" && (
              <>
                <p className="text-[12px] text-slate-500 mb-2">Enter your course outline</p>
              </>
            )}

            {/* Uploaded file indicator */}
            {uploadedFileName && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[12px] text-slate-900 truncate flex-1 font-medium">{uploadedFileName}</span>
                {isExtracting && (
                  <span className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
                )}
                {!isExtracting && (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
              </div>
            )}

            {contentMode === "upload" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all mb-3"
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="text-[13px] font-semibold text-slate-900">Drop PPT, PDF or DOCX</p>
                <span className="text-blue-600 text-[12px] font-semibold underline underline-offset-2">Browse files</span>
              </div>
            )}

            {contentMode === "paste" && (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={6}
                className="w-full border-[1.5px] border-slate-300 rounded-lg px-4 py-3 text-[13px] leading-[1.6] text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none transition-all duration-200"
                placeholder="Paste subject matter notes..."
              />
            )}
          </div>
        )}

        {/* Step 3: Logo Upload */}
        {isStep2Complete && setCompanyLogo && (
          <div className="pt-2">
            <p className="text-[11px] font-bold text-blue-600 tracking-[0.15em] uppercase opacity-80 mb-3">
              Step 3: Brand Customization
            </p>
            <LogoUploader
              logoDataUrl={companyLogo || undefined}
              onLogoChange={setCompanyLogo}
            />
          </div>
        )}

        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-white/80 border-t border-slate-200/50 pt-5 -mx-6 px-6 pb-6 z-10 shadow-2xl backdrop-blur-sm">
          {isRunning ? (
            <button
              onClick={onStop}
              type="button"
              className="w-full h-12 rounded-lg text-[14px] font-bold text-white flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Square className="w-4 h-4" />
              Stop Generating
            </button>
          ) : (
            <button
              onClick={onGenerate}
              type="button"
              disabled={isExtracting || isStartingGeneration}
              className="w-full h-12 rounded-lg text-[14px] font-bold text-white flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isExtracting || isStartingGeneration ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isExtracting ? "Extracting..." : "Starting..."}
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
    </div>
  );
};

