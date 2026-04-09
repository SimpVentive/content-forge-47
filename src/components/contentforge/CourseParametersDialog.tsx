import React, { useState, useMemo } from "react";
import { X, Settings2, AlertTriangle } from "lucide-react";

export interface CourseParameters {
  level: "basic" | "intermediate" | "advanced";
  language: string;
  textLanguage: string;
  narratorLanguage: string;
  voiceAccent: string;
  duration: string;
  assessmentRequired: boolean;
  slideLayout: {
    maxLines: number;
    minFontSize: number;
    lineSpacing: number;
  };
}

interface CourseParametersDialogProps {
  open: boolean;
  courseTitle: string;
  estimatedMinutes?: number | null;
  onConfirm: (params: CourseParameters) => void;
  onCancel: () => void;
}

const LEVELS = [
  { value: "basic", label: "Basic", desc: "Foundational concepts, no prior knowledge needed" },
  { value: "intermediate", label: "Intermediate", desc: "Builds on basic understanding" },
  { value: "advanced", label: "Advanced", desc: "Deep-dive for experienced learners" },
] as const;

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi (हिन्दी)" },
  { value: "Tamil", label: "Tamil (தமிழ்)" },
  { value: "Telugu", label: "Telugu (తెలుగు)" },
  { value: "Kannada", label: "Kannada (ಕನ್ನಡ)" },
  { value: "Malayalam", label: "Malayalam (മലയാളം)" },
  { value: "Bengali", label: "Bengali (বাংলা)" },
  { value: "Marathi", label: "Marathi (मराठी)" },
  { value: "Gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "Punjabi", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { value: "Urdu", label: "Urdu (اردو)" },
];

const VOICE_ACCENTS = [
  { value: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — American Female (Professional)" },
  { value: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam — American Male (Authoritative)" },
  { value: "Elli", voiceId: "MF3mGyEYCl7XYWbV9V6O", label: "Elli — American Female (Warm)" },
  { value: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — American Female (Soft)" },
  { value: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD", label: "Charlie — Australian Male (Casual)" },
  { value: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb", label: "George — British Male (Formal)" },
  { value: "Matilda", voiceId: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — American Female (Friendly)" },
  { value: "Brian", voiceId: "nPczCjzI2devNBz1zQrb", label: "Brian — American Male (Deep)" },
  { value: "Lily", voiceId: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — British Female (Narrative)" },
  { value: "Daniel", voiceId: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — British Male (Warm)" },
];

const DURATIONS = [
  { value: "3min", label: "3 min", minutes: 3 },
  { value: "5min", label: "5 min", minutes: 5 },
  { value: "10min", label: "10 min", minutes: 10 },
  { value: "15min", label: "15 min", minutes: 15 },
  { value: "20min", label: "20 min", minutes: 20 },
  { value: "30min", label: "30 min", minutes: 30 },
  { value: "45min", label: "45 min", minutes: 45 },
  { value: "60min", label: "60 min", minutes: 60 },
];

const MAX_LINE_OPTIONS = [8, 9, 10] as const;
const LINE_SPACING_OPTIONS = [1.5, 2, 2.5] as const;

// Map duration to YouTube video count
export const DURATION_VIDEO_COUNT: Record<string, number> = {
  "3min": 3,
  "5min": 5,
  "10min": 8,
  "15min": 10,
  "20min": 15,
  "30min": 20,
  "45min": 30,
  "60min": 50,
};

function getDurationMinutes(val: string): number {
  return DURATIONS.find(d => d.value === val)?.minutes ?? 15;
}

export const CourseParametersDialog: React.FC<CourseParametersDialogProps> = ({
  open, courseTitle, estimatedMinutes, onConfirm, onCancel,
}) => {
  const [level, setLevel] = useState<CourseParameters["level"]>("intermediate");
  const [textLanguage, setTextLanguage] = useState("English");
  const [narratorLanguage, setNarratorLanguage] = useState("English");
  const [voiceAccent, setVoiceAccent] = useState("Rachel");
  const [duration, setDuration] = useState("15min");
  const [assessmentRequired, setAssessmentRequired] = useState(true);
  const [maxLines, setMaxLines] = useState<CourseParameters["slideLayout"]["maxLines"]>(10);
  const [minFontSize, setMinFontSize] = useState<CourseParameters["slideLayout"]["minFontSize"]>(12.5);
  const [lineSpacing, setLineSpacing] = useState<CourseParameters["slideLayout"]["lineSpacing"]>(2);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const [mismatchType, setMismatchType] = useState<"more" | "less">("more");

  const selectedMinutes = getDurationMinutes(duration);

  // Check for mismatch when user tries to generate
  const mismatchInfo = useMemo(() => {
    if (!estimatedMinutes || estimatedMinutes <= 0) return null;
    const diff = Math.abs(selectedMinutes - estimatedMinutes) / estimatedMinutes;
    if (diff > 0.2) {
      return {
        type: selectedMinutes > estimatedMinutes ? "more" as const : "less" as const,
        estimatedMin: estimatedMinutes,
        selectedMin: selectedMinutes,
      };
    }
    return null;
  }, [estimatedMinutes, selectedMinutes]);

  if (!open) return null;

  const handleConfirm = () => {
    if (mismatchInfo) {
      setMismatchType(mismatchInfo.type);
      setShowMismatchWarning(true);
      return;
    }
    onConfirm({
      level,
      language: textLanguage,
      textLanguage,
      narratorLanguage,
      voiceAccent,
      duration,
      assessmentRequired,
      slideLayout: { maxLines, minFontSize, lineSpacing },
    });
  };

  const handleProceedWithContent = () => {
    // Find the closest duration to estimated minutes
    const closest = DURATIONS.reduce((prev, curr) =>
      Math.abs(curr.minutes - (estimatedMinutes || 15)) < Math.abs(prev.minutes - (estimatedMinutes || 15)) ? curr : prev
    );
    setDuration(closest.value);
    setShowMismatchWarning(false);
    onConfirm({
      level,
      language: textLanguage,
      textLanguage,
      narratorLanguage,
      voiceAccent,
      duration: closest.value,
      assessmentRequired,
      slideLayout: { maxLines, minFontSize, lineSpacing },
    });
  };

  const handleProceedWithSelected = () => {
    setShowMismatchWarning(false);
    onConfirm({
      level,
      language: textLanguage,
      textLanguage,
      narratorLanguage,
      voiceAccent,
      duration,
      assessmentRequired,
      slideLayout: { maxLines, minFontSize, lineSpacing },
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Mismatch Warning Dialog */}
      {showMismatchWarning && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-[500px] max-w-[92vw] bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="h-1.5 w-full bg-amber-500" />
            <div className="px-8 pt-7 pb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-[18px] font-extrabold text-foreground leading-tight">
                  Duration Mismatch
                </h3>
              </div>

              <p className="text-[14px] text-foreground leading-relaxed mb-6">
                You have uploaded content that would require approximately{" "}
                <span className="font-bold text-primary">{estimatedMinutes} min</span> of e-learning,
                whereas you are asking for a{" "}
                <span className="font-bold text-primary">{selectedMinutes} min</span> e-learning course.
                {mismatchType === "more"
                  ? " The selected duration is longer than what the content supports — the AI may need to pad with supplementary material."
                  : " The selected duration is shorter — the AI will need to condense and prioritize key topics."}
              </p>
              <p className="text-[14px] font-semibold text-foreground mb-5">What would you like to do?</p>

              <div className="space-y-3">
                <button
                  onClick={handleProceedWithContent}
                  className="w-full h-[52px] rounded-xl text-[14px] font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  📄 Proceed based on the content outline uploaded (~{estimatedMinutes} min)
                </button>
                <button
                  onClick={handleProceedWithSelected}
                  className="w-full h-[52px] rounded-xl text-[14px] font-bold text-foreground border-2 border-border hover:bg-secondary/60 transition-all flex items-center justify-center gap-2"
                >
                  ⏱️ Go with the duration I have selected ({selectedMinutes} min)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative w-[520px] max-w-[95vw] max-h-[90vh] bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #0d7a5f, #1e3a5f)" }}>
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-foreground">Course Parameters</h2>
              <p className="text-[12px] text-muted-foreground truncate max-w-[300px]">{courseTitle}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Course Level */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-2 block">Course Level</label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    level === l.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className={`text-[13px] font-bold ${level === l.value ? "text-primary" : "text-foreground"}`}>{l.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
            <div>
              <label className="text-[13px] font-bold text-foreground mb-1.5 block">For Text on Screen</label>
              <p className="text-[11px] text-muted-foreground mb-2">Choose the language used for slide content and written course material.</p>
              <select
                value={textLanguage}
                onChange={(e) => setTextLanguage(e.target.value)}
                className="w-full h-10 border-[1.5px] border-border rounded-xl px-3 text-[13px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-bold text-foreground mb-1.5 block">For Voice of Narrator</label>
              <p className="text-[11px] text-muted-foreground mb-2">Choose the spoken language for narration, then select the narrator voice.</p>
              <div className="space-y-3">
                <select
                  value={narratorLanguage}
                  onChange={(e) => setNarratorLanguage(e.target.value)}
                  className="w-full h-10 border-[1.5px] border-border rounded-xl px-3 text-[13px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>

                <select
                  value={voiceAccent}
                  onChange={(e) => setVoiceAccent(e.target.value)}
                  className="w-full h-10 border-[1.5px] border-border rounded-xl px-3 text-[13px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  {VOICE_ACCENTS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-2 block">
              Target Duration
              {estimatedMinutes && estimatedMinutes > 0 && (
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  (Content estimate: ~{estimatedMinutes} min)
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`h-9 px-4 rounded-full text-[13px] font-semibold border-2 transition-all ${
                    duration === d.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
            <div>
              <p className="text-[13px] font-bold text-foreground">Slide Layout Rules</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Apply readability constraints during course generation and learner slide rendering.
              </p>
            </div>

            <div>
              <label className="text-[12px] font-bold text-foreground mb-2 block">Max lines per slide</label>
              <div className="flex flex-wrap gap-2">
                {MAX_LINE_OPTIONS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setMaxLines(value)}
                    className={`h-9 px-4 rounded-full text-[13px] font-semibold border-2 transition-all ${
                      maxLines === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/30"
                    }`}
                  >
                    {value} lines
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-bold text-foreground mb-2 block">Minimum font size</label>
                <input
                  type="number"
                  min={12.5}
                  step={0.5}
                  value={minFontSize}
                  onChange={(e) => setMinFontSize(Math.max(12.5, Number(e.target.value) || 12.5))}
                  className="w-full h-10 border-[1.5px] border-border rounded-xl px-3 text-[13px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-foreground mb-2 block">Line spacing</label>
                <div className="flex flex-wrap gap-2">
                  {LINE_SPACING_OPTIONS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setLineSpacing(value)}
                      className={`h-10 px-3 rounded-xl text-[13px] font-semibold border-2 transition-all ${
                        lineSpacing === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:border-primary/30"
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Assessment Toggle */}
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-4">
            <div>
              <p className="text-[13px] font-bold text-foreground">Assessment</p>
              <p className="text-[11px] text-muted-foreground">Generate quizzes and scenario-based questions</p>
            </div>
            <button
              onClick={() => setAssessmentRequired(!assessmentRequired)}
              className={`w-12 h-7 rounded-full transition-all relative ${
                assessmentRequired ? "bg-primary" : "bg-border"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${
                assessmentRequired ? "left-6" : "left-1"
              }`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="h-10 px-5 rounded-xl text-[13px] font-bold text-foreground border border-border hover:bg-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="h-10 px-6 rounded-xl text-[14px] font-bold text-white shadow-lg hover:brightness-110 transition-all"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            Generate Course
          </button>
        </div>
      </div>
    </div>
  );
};
