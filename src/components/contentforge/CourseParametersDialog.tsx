import React, { useState } from "react";
import { X, Settings2 } from "lucide-react";

export interface CourseParameters {
  level: "basic" | "intermediate" | "advanced";
  language: string;
  voiceAccent: string;
  duration: string;
  assessmentRequired: boolean;
}

interface CourseParametersDialogProps {
  open: boolean;
  courseTitle: string;
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
  { value: "15min", label: "15 minutes" },
  { value: "30min", label: "30 minutes" },
  { value: "1hr", label: "1 hour" },
  { value: "2hr", label: "2 hours" },
  { value: "4hr", label: "4 hours" },
  { value: "8hr", label: "8 hours (full day)" },
];

export const CourseParametersDialog: React.FC<CourseParametersDialogProps> = ({
  open, courseTitle, onConfirm, onCancel,
}) => {
  const [level, setLevel] = useState<CourseParameters["level"]>("intermediate");
  const [language, setLanguage] = useState("English");
  const [voiceAccent, setVoiceAccent] = useState("Rachel");
  const [duration, setDuration] = useState("1hr");
  const [assessmentRequired, setAssessmentRequired] = useState(true);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({ level, language, voiceAccent, duration, assessmentRequired });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[520px] max-w-[95vw] max-h-[90vh] bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              <Settings2 className="w-4.5 h-4.5 text-white" />
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

          {/* Language */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-1.5 block">Course Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-10 border-[1.5px] border-border rounded-xl px-3 text-[13px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Voice Accent */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-1.5 block">Narration Voice</label>
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

          {/* Duration */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-2 block">Target Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`h-9 px-4 rounded-lg text-[12px] font-bold transition-all ${
                    duration === d.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-border"
                  }`}
                >
                  {d.label}
                </button>
              ))}
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
