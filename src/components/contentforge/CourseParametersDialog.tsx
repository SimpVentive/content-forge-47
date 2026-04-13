import React, { useState, useMemo, useEffect } from "react";
import { X, Settings2, AlertTriangle, Info, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AVATAR_TRAINERS, getDefaultTrainerIdForLanguage, getTrainerMedia, isIndianLanguage } from "@/lib/avatarTrainers";

export interface CourseParameters {
  level: "basic" | "intermediate" | "advanced";
  language: string;
  textLanguage: string;
  narratorLanguage: string;
  voiceAccent: string;
  avatarTrainerId: string;
  duration: string;
  videoDurationHandling: "within-course" | "additional-to-course";
  assessmentRequired: boolean;
  learnerNotesEnabled: boolean;
  resourcesPanelEnabled: boolean;
  glossaryEnabled: boolean;
  discussionEnabled: boolean;
  assessmentIntensity: "light" | "standard" | "deep";
  flipStyle: "dramatic" | "subtle" | "bound";
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
  { value: "Hindi", label: "Hindi" },
  { value: "Tamil", label: "Tamil" },
  { value: "Telugu", label: "Telugu" },
  { value: "Kannada", label: "Kannada" },
  { value: "Malayalam", label: "Malayalam" },
  { value: "Bengali", label: "Bengali" },
  { value: "Marathi", label: "Marathi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Punjabi", label: "Punjabi" },
  { value: "Urdu", label: "Urdu" },
];

const VOICE_ACCENTS = [
  { value: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel - American Female (Professional)" },
  { value: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam - American Male (Authoritative)" },
  { value: "Elli", voiceId: "MF3mGyEYCl7XYWbV9V6O", label: "Elli - American Female (Warm)" },
  { value: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL", label: "Sarah - American Female (Soft)" },
  { value: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD", label: "Charlie - Australian Male (Casual)" },
  { value: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb", label: "George - British Male (Formal)" },
  { value: "Matilda", voiceId: "XrExE9yKIg1WjnnlVkGX", label: "Matilda - American Female (Friendly)" },
  { value: "Brian", voiceId: "nPczCjzI2devNBz1zQrb", label: "Brian - American Male (Deep)" },
  { value: "Lily", voiceId: "pFZP5JQG7iQjIQuC4Bku", label: "Lily - British Female (Narrative)" },
  { value: "Daniel", voiceId: "onwK4e9ZLuTAKqWW03F9", label: "Daniel - British Male (Warm)" },
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
const ASSESSMENT_INTENSITY_OPTIONS = [
  { value: "light", label: "Light", desc: "Fewer checks" },
  { value: "standard", label: "Standard", desc: "Balanced" },
  { value: "deep", label: "Deep", desc: "More checks" },
] as const;

const FLIP_STYLE_OPTIONS = [
  { value: "dramatic", label: "Physical Flip" },
  { value: "subtle", label: "Subtle Flip" },
  { value: "bound", label: "Bound Flipchart" },
] as const;

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

const InfoHint: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        aria-label="More information"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-[260px] text-[11px] leading-relaxed">{text}</TooltipContent>
  </Tooltip>
);

export const CourseParametersDialog: React.FC<CourseParametersDialogProps> = ({
  open, courseTitle, estimatedMinutes, onConfirm, onCancel,
}) => {
  const headingFont = '"Poppins", sans-serif';
  const bodyFont = '"Inter", sans-serif';
  const buttonFont = '"Poppins", sans-serif';
  const [level, setLevel] = useState<CourseParameters["level"]>("intermediate");
  const [textLanguage, setTextLanguage] = useState("English");
  const [narratorLanguage, setNarratorLanguage] = useState("English");
  const [voiceAccent, setVoiceAccent] = useState("Rachel");
  const [avatarTrainerId, setAvatarTrainerId] = useState(() => getDefaultTrainerIdForLanguage("English"));
  const [trainerAutoMode, setTrainerAutoMode] = useState(true);
  const [duration, setDuration] = useState("15min");
  const [videoDurationHandling, setVideoDurationHandling] = useState<CourseParameters["videoDurationHandling"]>("within-course");
  const [assessmentRequired, setAssessmentRequired] = useState(true);
  const [learnerNotesEnabled, setLearnerNotesEnabled] = useState(false);
  const [resourcesPanelEnabled, setResourcesPanelEnabled] = useState(true);
  const [glossaryEnabled, setGlossaryEnabled] = useState(true);
  const [discussionEnabled, setDiscussionEnabled] = useState(true);
  const [assessmentIntensity, setAssessmentIntensity] = useState<CourseParameters["assessmentIntensity"]>("standard");
  const [flipStyle, setFlipStyle] = useState<CourseParameters["flipStyle"]>("bound");
  const [maxLines, setMaxLines] = useState<CourseParameters["slideLayout"]["maxLines"]>(10);
  const [minFontSize, setMinFontSize] = useState<CourseParameters["slideLayout"]["minFontSize"]>(12.5);
  const [lineSpacing, setLineSpacing] = useState<CourseParameters["slideLayout"]["lineSpacing"]>(2);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const [mismatchType, setMismatchType] = useState<"more" | "less">("more");
  const avatarEnv = import.meta.env as Record<string, string | undefined>;

  const selectedMinutes = getDurationMinutes(duration);
  const selectedLevelLabel = LEVELS.find((item) => item.value === level)?.label || "Intermediate";
  const selectedVoiceLabel = VOICE_ACCENTS.find((voice) => voice.value === voiceAccent)?.label || voiceAccent;
  const selectedDurationLabel = DURATIONS.find((item) => item.value === duration)?.label || "15 min";
  const selectedTrainer = AVATAR_TRAINERS.find((trainer) => trainer.id === avatarTrainerId) || AVATAR_TRAINERS[0];
  const selectedTrainerImage = getTrainerMedia(selectedTrainer.id, avatarEnv).imageUrl;

  useEffect(() => {
    if (!trainerAutoMode) return;
    setAvatarTrainerId(getDefaultTrainerIdForLanguage(narratorLanguage));
  }, [narratorLanguage, trainerAutoMode]);

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

  const surfaceCardClass = "rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-[0_8px_20px_rgba(181,126,220,0.2)]";

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
      avatarTrainerId,
      duration,
      videoDurationHandling,
      assessmentRequired,
      learnerNotesEnabled,
      resourcesPanelEnabled,
      glossaryEnabled,
      discussionEnabled,
      assessmentIntensity,
      flipStyle,
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
      avatarTrainerId,
      duration: closest.value,
      videoDurationHandling,
      assessmentRequired,
      learnerNotesEnabled,
      resourcesPanelEnabled,
      glossaryEnabled,
      discussionEnabled,
      assessmentIntensity,
      flipStyle,
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
      avatarTrainerId,
      duration,
      videoDurationHandling,
      assessmentRequired,
      learnerNotesEnabled,
      resourcesPanelEnabled,
      glossaryEnabled,
      discussionEnabled,
      assessmentIntensity,
      flipStyle,
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
          <div
            className="relative w-[500px] max-w-[92vw] bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            style={{ fontFamily: bodyFont }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-amber-500" />
            <div className="px-8 pt-7 pb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-[18px] font-extrabold tracking-tight text-foreground leading-tight">
                  Duration Mismatch
                </h3>
              </div>

              <p className="text-[14px] text-foreground leading-relaxed mb-6">
                You have uploaded content that would require approximately{" "}
                <span className="font-bold text-primary">{estimatedMinutes} min</span> of e-learning,
                whereas you are asking for a{" "}
                <span className="font-bold text-primary">{selectedMinutes} min</span> e-learning course.
                {mismatchType === "more"
                  ? " The selected duration is longer than what the content supports - the AI may need to add supplementary material."
                  : " The selected duration is shorter - the AI will need to condense and prioritize key topics."}
              </p>
              <p className="text-[14px] font-semibold text-foreground mb-5">What would you like to do?</p>

              <div className="space-y-3">
                <button
                  onClick={handleProceedWithContent}
                  className="w-full h-[52px] rounded-lg text-[14px] font-medium text-white transition-all duration-200 ease-in-out flex items-center justify-center gap-2 shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:brightness-110"
                  style={{ background: "#2563EB", fontFamily: buttonFont }}
                >
                  Use suggested duration based on content (~{estimatedMinutes} min)
                </button>
                <button
                  onClick={handleProceedWithSelected}
                  className="w-full h-[52px] rounded-lg text-[14px] font-medium border transition-all duration-200 ease-in-out flex items-center justify-center gap-2"
                  style={{ fontFamily: buttonFont, color: "#2563EB", borderColor: "#2563EB", backgroundColor: "#FFFFFF" }}
                >
                  Keep my selected duration ({selectedMinutes} min)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative w-[1080px] max-w-[96vw] h-[92vh] max-h-[92vh] rounded-[28px] shadow-2xl overflow-hidden animate-fade-in border border-white/30"
        style={{ fontFamily: bodyFont, backgroundColor: "#F9FAFB" }}
        onClick={(e) => e.stopPropagation()}
      >
        <TooltipProvider delayDuration={150}>
          <div className="grid h-full lg:grid-cols-[1.03fr_0.97fr]">
            <div className="flex min-h-0 flex-col" style={{ backgroundColor: "#F9FAFB" }}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md" style={{ background: "#2563EB" }}>
                    <Settings2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[35px] leading-none font-[700] tracking-tight text-[#2E2E2E]" style={{ fontFamily: headingFont }}>Course Setup</h2>
                    <p className="text-[12px] text-[#6B7280] truncate max-w-[330px] mt-0.5">{courseTitle}</p>
                  </div>
                </div>
                <button onClick={onCancel} className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center transition-colors duration-200 ease-in-out">
                  <X className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto [scrollbar-gutter:stable] pr-4 flex-1">
          {/* Course Level */}
          <div className={surfaceCardClass}>
            <label className="text-[13px] text-[#2E2E2E] mb-2 flex items-center gap-1.5" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
              Course Level
              <InfoHint text="Controls how basic or advanced the generated explanations should be." />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`p-3 rounded-[12px] border text-left transition-all duration-200 ease-in-out ${
                    level === l.value
                      ? "text-white"
                      : "border-[#E5E7EB] bg-white hover:border-[#6EC1E4]"
                  }`}
                  style={level === l.value ? { background: "#2563EB", borderColor: "transparent" } : undefined}
                >
                  <p className="text-[13px]" style={{ fontFamily: bodyFont, fontWeight: 600 }}>{l.label}</p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${level === l.value ? "text-white/90" : "text-[#6B7280]"}`}>{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className={surfaceCardClass}>
            <div>
              <label className="text-[13px] text-[#2E2E2E] mb-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>For Text on Screen</label>
              <p className="text-[11px] mb-2 text-[#6B7280]">Choose the language used for slide content and written course material.</p>
              <select
                value={textLanguage}
                onChange={(e) => setTextLanguage(e.target.value)}
                className="w-full h-10 border border-[#E5E7EB] rounded-[20px] px-4 text-[13px] bg-[#F3F4F6] text-[#2E2E2E] focus:outline-none focus:border-[#6EC1E4] transition-colors duration-200 ease-in-out appearance-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] text-[#2E2E2E] mb-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>For Voice of Narrator</label>
              <p className="text-[11px] mb-2 text-[#6B7280]">Choose the spoken language for narration, then select the narrator voice.</p>
              <div className="space-y-3">
                <select
                  value={narratorLanguage}
                  onChange={(e) => setNarratorLanguage(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-[20px] px-4 text-[13px] bg-[#F3F4F6] text-[#2E2E2E] focus:outline-none focus:border-[#6EC1E4] transition-colors duration-200 ease-in-out appearance-none cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>

                <select
                  value={voiceAccent}
                  onChange={(e) => setVoiceAccent(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-[20px] px-4 text-[13px] bg-[#F3F4F6] text-[#2E2E2E] focus:outline-none focus:border-[#6EC1E4] transition-colors duration-200 ease-in-out appearance-none cursor-pointer"
                >
                  {VOICE_ACCENTS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-bold text-foreground">Select Your Instructor</p>
                    <InfoHint text="Choose the virtual trainer shown to learners. Indian languages default to Indian trainers in auto mode." />
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {trainerAutoMode ? "Auto" : "Manual"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {AVATAR_TRAINERS.map((trainer) => {
                      const selected = avatarTrainerId === trainer.id;
                      const trainerMedia = getTrainerMedia(trainer.id, avatarEnv);

                      return (
                        <button
                          key={trainer.id}
                          onClick={() => {
                            setAvatarTrainerId(trainer.id);
                            setTrainerAutoMode(false);
                          }}
                          className={`overflow-hidden rounded-[12px] border bg-white text-left transition-all duration-200 ease-in-out ${
                            selected ? "border-transparent shadow-[0_8px_20px_rgba(181,126,220,0.2)]" : "border-[#E5E7EB] hover:border-[#6EC1E4]"
                          }`}
                          style={selected ? { boxShadow: "0 0 0 2px rgba(37,99,235,0.25), 0 8px 20px rgba(37,99,235,0.2)" } : undefined}
                          type="button"
                        >
                          <div className="relative flex h-[112px] items-center justify-center bg-[#F3F4F6]">
                            <img
                              src={trainerMedia.imageUrl}
                              alt={trainer.name}
                              className={`h-24 w-24 rounded-full border-2 border-[#E5E7EB] object-cover transition-transform duration-300 ${selected ? "scale-[1.05]" : "scale-100"}`}
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                            {selected ? (
                              <span className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-black text-white shadow"
                                style={{ background: "#2563EB" }}>
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                          <div className="px-2 py-1.5">
                            <p className={`truncate text-[12px] font-bold ${selected ? "text-primary" : "text-foreground"}`}>{trainer.name}</p>
                            <p className="text-[10px] text-muted-foreground">{trainer.region === "india" ? "India trainer" : "Global trainer"}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-semibold text-[#3f8f73]">
                    {isIndianLanguage(narratorLanguage)
                      ? `Recommended for ${narratorLanguage}: India trainers`
                      : `Recommended for ${narratorLanguage}: Global trainers`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className={surfaceCardClass}>
            <div className="mb-2 flex items-center gap-1.5">
              <label className="text-[13px] text-[#2E2E2E]" style={{ fontFamily: bodyFont, fontWeight: 600 }}>Target Duration</label>
              <InfoHint text="Sets the overall learner seat-time target for the generated course." />
              {estimatedMinutes && estimatedMinutes > 0 && (
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  (Content estimate: ~{estimatedMinutes} min)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`h-9 px-4 rounded-full text-[13px] border transition-all duration-200 ease-in-out ${
                    duration === d.value
                      ? "text-white"
                      : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#6EC1E4]"
                  }`}
                  style={duration === d.value ? { background: "#2563EB", borderColor: "transparent", fontWeight: 600 } : { fontWeight: 600 }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className={surfaceCardClass}>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground">Video Time Handling</p>
                <InfoHint text="Choose whether video clips should consume course duration or be extra runtime." />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Decide whether inserted YouTube clips should count inside the selected course duration or be added on top of it.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setVideoDurationHandling("within-course")}
                className={`rounded-[12px] border p-3 text-left transition-all duration-200 ease-in-out ${
                  videoDurationHandling === "within-course"
                    ? "border-[#6EC1E4] bg-[#F0FBFF]"
                    : "border-[#E5E7EB] hover:border-[#6EC1E4]"
                }`}
                type="button"
              >
                <p className={`text-[13px] font-bold ${videoDurationHandling === "within-course" ? "text-primary" : "text-foreground"}`}>
                  Videos are part of the {selectedMinutes}-minute course
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Use this when the learner's total seat time must stay within the selected duration.
                </p>
              </button>

              <button
                onClick={() => setVideoDurationHandling("additional-to-course")}
                className={`rounded-[12px] border p-3 text-left transition-all duration-200 ease-in-out ${
                  videoDurationHandling === "additional-to-course"
                    ? "border-[#6EC1E4] bg-[#F0FBFF]"
                    : "border-[#E5E7EB] hover:border-[#6EC1E4]"
                }`}
                type="button"
              >
                <p className={`text-[13px] font-bold ${videoDurationHandling === "additional-to-course" ? "text-primary" : "text-foreground"}`}>
                  Videos are extra, over and above the {selectedMinutes}-minute course
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Use this when videos are optional enrichment or should not reduce the base teaching time.
                </p>
              </button>
            </div>
          </div>

          <div className={surfaceCardClass}>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground">Learner Tools</p>
                <InfoHint text="Enable or disable learner-facing helpers like Notes and quick-action shortcuts." />
              </div>
              <p className="text-[11px] font-medium text-foreground/70 mt-0.5">
                Decide which learner-side tools appear in the course player preview.
              </p>
            </div>

            <button
              onClick={() => setLearnerNotesEnabled((prev) => !prev)}
              className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                learnerNotesEnabled
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-[13px] font-bold ${learnerNotesEnabled ? "text-primary" : "text-foreground"}`}>
                      Enable learner notes
                    </p>
                    <InfoHint text="Adds a Notes tab where learners can capture personal notes while taking the course." />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Shows a note-taking panel inside the learner experience.
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${learnerNotesEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {learnerNotesEnabled ? "On" : "Off"}
                </span>
              </div>
            </button>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                onClick={() => setResourcesPanelEnabled((prev) => !prev)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  resourcesPanelEnabled
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[13px] font-bold ${resourcesPanelEnabled ? "text-primary" : "text-foreground"}`}>Resources panel</p>
                      <InfoHint text="Learner-facing panel: shows resources to the learner during playback, not to course creators." />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Navigation visibility</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${resourcesPanelEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {resourcesPanelEnabled ? "On" : "Off"}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setGlossaryEnabled((prev) => !prev)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  glossaryEnabled
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[13px] font-bold ${glossaryEnabled ? "text-primary" : "text-foreground"}`}>Glossary shortcut</p>
                      <InfoHint text="Shows or hides the Glossary action button in the learner header." />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Header action button</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${glossaryEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {glossaryEnabled ? "On" : "Off"}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setDiscussionEnabled((prev) => !prev)}
                className={`rounded-xl border-2 p-3 text-left transition-all md:col-span-2 ${
                  discussionEnabled
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[13px] font-bold ${discussionEnabled ? "text-primary" : "text-foreground"}`}>Discussion shortcut</p>
                      <InfoHint text="Shows or hides the Discussion action button in the learner header." />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Header action button</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${discussionEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {discussionEnabled ? "On" : "Off"}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className={surfaceCardClass}>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground">Slide Layout Rules</p>
                <InfoHint text="Readability limits to keep generated slide text legible on learner screens." />
              </div>
              <p className="text-[11px] font-medium text-foreground/70 mt-0.5">
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
                    className={`h-9 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                      maxLines === value
                          ? "text-white"
                          : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#6EC1E4]"
                    }`}
                      style={maxLines === value ? { background: "#2563EB", borderColor: "transparent" } : undefined}
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
                  className="w-full h-10 border border-[#E5E7EB] rounded-[20px] px-4 text-[13px] bg-[#F3F4F6] text-[#2E2E2E] focus:outline-none focus:border-[#6EC1E4] transition-colors duration-200 ease-in-out"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-foreground mb-2 block">Line spacing</label>
                <div className="flex flex-wrap gap-2">
                  {LINE_SPACING_OPTIONS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setLineSpacing(value)}
                      className={`h-10 px-3 rounded-[12px] text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                        lineSpacing === value
                          ? "text-white"
                          : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#6EC1E4]"
                      }`}
                      style={lineSpacing === value ? { background: "#2563EB", borderColor: "transparent" } : undefined}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <label className="text-[12px] font-bold text-foreground">Flip Animation Style</label>
                <InfoHint text="Controls flip-chart page transition style in the learner view. This is applied before generation." />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {FLIP_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFlipStyle(option.value)}
                    className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-all duration-200 ease-in-out ${
                      flipStyle === option.value
                        ? "text-white"
                        : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#6EC1E4]"
                    }`}
                    style={flipStyle === option.value ? { background: "#2563EB", borderColor: "transparent" } : undefined}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assessment Toggle */}
          <div className={surfaceCardClass + " flex items-center justify-between"}>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground">Assessment</p>
                <InfoHint text="Adds quiz and scenario checks to evaluate learner understanding." />
              </div>
              <p className="text-[11px] text-muted-foreground">Generate quizzes and scenario-based questions</p>
              {assessmentRequired ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ASSESSMENT_INTENSITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAssessmentIntensity(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                        assessmentIntensity === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                      type="button"
                    >
                      {option.label} - {option.desc}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => setAssessmentRequired(!assessmentRequired)}
              className={`w-12 h-6 rounded-full transition-all duration-200 ease-in-out relative ${
                assessmentRequired ? "bg-[#34D399]" : "bg-[#D1D5DB]"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-200 ease-in-out ${
                assessmentRequired ? "left-[26px]" : "left-[2px]"
              }`} />
            </button>
          </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#E5E7EB] flex justify-between gap-3 bg-white">
                <button
                  onClick={onCancel}
                  className="h-10 min-w-[120px] px-5 rounded-lg text-[14px] tracking-tight border transition-all duration-200 ease-in-out"
                  style={{ fontFamily: buttonFont, fontWeight: 500, color: "#2563EB", borderColor: "#2563EB", backgroundColor: "#FFFFFF" }}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="h-10 px-6 rounded-lg text-[14px] tracking-tight text-white shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:brightness-110 transition-all duration-200 ease-in-out"
                  style={{ fontFamily: buttonFont, fontWeight: 500, background: "#2563EB" }}
                >
                  Launch Course
                </button>
              </div>
            </div>

            <aside className="hidden lg:flex min-h-0 flex-col justify-between p-7 border-l border-[#E5E7EB]"
              style={{ background: "#F8FAFC" }}>
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-[34px] leading-none font-[700] tracking-tight text-[#2E2E2E]" style={{ fontFamily: headingFont }}>Course Summary</h3>
                  <span className="text-[#6B7280] text-[20px]">...</span>
                </div>
                <div className="mt-4 h-px bg-[#E5E7EB]" />

                <div className="mt-5 rounded-[12px] bg-white text-[#2E2E2E] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-[#E5E7EB]">
                  <p className="text-[26px] leading-none mb-3" style={{ fontFamily: headingFont, fontWeight: 700 }}>{selectedLevelLabel} Level</p>
                  <div className="space-y-2.5 text-[14px]">
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Text Language:</span> {textLanguage}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Narration Language:</span> {narratorLanguage}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Narrator Voice:</span> {selectedVoiceLabel}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Instructor:</span> {selectedTrainer.name}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Duration:</span> {selectedDurationLabel}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Flip Style:</span> {FLIP_STYLE_OPTIONS.find((option) => option.value === flipStyle)?.label || "Bound Flipchart"}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                  <div className="relative h-[280px] w-full overflow-hidden bg-[#F3F4F6]">
                    <img
                      key={selectedTrainer.id}
                      src={selectedTrainerImage}
                      alt={`${selectedTrainer.name} preview`}
                      className="h-full w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.18)] transition-all duration-300 hover:scale-[1.02]"
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 px-4 pb-3 pt-10">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/80">Instructor Preview</p>
                      <p className="text-[22px] leading-none text-white mt-1" style={{ fontFamily: headingFont, fontWeight: 700 }}>{selectedTrainer.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[12px] bg-white border border-[#E5E7EB] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTrainerImage}
                    alt={selectedTrainer.name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-[#E5E7EB]"
                  />
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#6B7280]" style={{ fontWeight: 600 }}>Selected Instructor</p>
                    <p className="text-[22px] leading-none mt-1 text-[#2E2E2E]" style={{ fontFamily: headingFont, fontWeight: 700 }}>{selectedTrainer.name}</p>
                    <p className="text-[13px] text-[#6B7280] mt-1">{learnerNotesEnabled ? "Notes enabled" : "Notes disabled"} - {assessmentRequired ? "Assessment enabled" : "Assessment off"}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

