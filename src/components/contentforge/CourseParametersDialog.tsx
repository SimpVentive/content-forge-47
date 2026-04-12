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
  { value: "Hindi", label: "Hindi (a�a�+a�a��a�a��)" },
  { value: "Tamil", label: "Tamil (a��a��a�+a��a��)" },
  { value: "Telugu", label: "Telugu (a��a��a��a��a��a��)" },
  { value: "Kannada", label: "Kannada (a��a��a��a��a��)" },
  { value: "Malayalam", label: "Malayalam (a��a��a��a�+a��a��)" },
  { value: "Bengali", label: "Bengali (a��a�+a��a��a�+)" },
  { value: "Marathi", label: "Marathi (a�a�a�+a��a��)" },
  { value: "Gujarati", label: "Gujarati (a��a��a��a��a�+a��a��)" },
  { value: "Punjabi", label: "Punjabi (a��a��a��a�+a��a��)" },
  { value: "Urdu", label: "Urdu (+�+�+�+�)" },
];

const VOICE_ACCENTS = [
  { value: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel G�� American Female (Professional)" },
  { value: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam G�� American Male (Authoritative)" },
  { value: "Elli", voiceId: "MF3mGyEYCl7XYWbV9V6O", label: "Elli G�� American Female (Warm)" },
  { value: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL", label: "Sarah G�� American Female (Soft)" },
  { value: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD", label: "Charlie G�� Australian Male (Casual)" },
  { value: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb", label: "George G�� British Male (Formal)" },
  { value: "Matilda", voiceId: "XrExE9yKIg1WjnnlVkGX", label: "Matilda G�� American Female (Friendly)" },
  { value: "Brian", voiceId: "nPczCjzI2devNBz1zQrb", label: "Brian G�� American Male (Deep)" },
  { value: "Lily", voiceId: "pFZP5JQG7iQjIQuC4Bku", label: "Lily G�� British Female (Narrative)" },
  { value: "Daniel", voiceId: "onwK4e9ZLuTAKqWW03F9", label: "Daniel G�� British Male (Warm)" },
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
  const displayFont = '"Plus Jakarta Sans", "Manrope", sans-serif';
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
            style={{ fontFamily: displayFont }}
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
                  ? " The selected duration is longer than what the content supports G�� the AI may need to pad with supplementary material."
                  : " The selected duration is shorter G�� the AI will need to condense and prioritize key topics."}
              </p>
              <p className="text-[14px] font-semibold text-foreground mb-5">What would you like to do?</p>

              <div className="space-y-3">
                <button
                  onClick={handleProceedWithContent}
                  className="w-full h-[52px] rounded-xl text-[14px] font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  =��� Proceed based on the content outline uploaded (~{estimatedMinutes} min)
                </button>
                <button
                  onClick={handleProceedWithSelected}
                  className="w-full h-[52px] rounded-xl text-[14px] font-bold text-foreground border-2 border-border hover:bg-secondary/60 transition-all flex items-center justify-center gap-2"
                >
                  GŦn+� Go with the duration I have selected ({selectedMinutes} min)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative w-[1080px] max-w-[96vw] max-h-[92vh] rounded-[28px] shadow-2xl overflow-hidden animate-fade-in border border-white/30"
        style={{ fontFamily: displayFont }}
        onClick={(e) => e.stopPropagation()}
      >
        <TooltipProvider delayDuration={150}>
          <div className="grid h-full lg:grid-cols-[1.03fr_0.97fr]">
            <div className="flex min-h-0 flex-col bg-[linear-gradient(180deg,#f7f9ff_0%,#f1f4fb_100%)]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#d9dfef] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #0e8ca8, #1f5a89)" }}>
                    <Settings2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[35px] leading-none font-[900] tracking-tight text-[#1d2f57]">Course Setup</h2>
                    <p className="text-[12px] text-[#51648e] truncate max-w-[330px] mt-0.5">{courseTitle}</p>
                  </div>
                </div>
                <button onClick={onCancel} className="w-8 h-8 rounded-lg hover:bg-[#e8edf8] flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-[#6a7da5]" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Course Level */}
          <div>
            <label className="text-[13px] font-bold text-foreground mb-2 flex items-center gap-1.5">
              Course Level
              <InfoHint text="Controls how basic or advanced the generated explanations should be." />
            </label>
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
              <p className="text-[11px] font-medium text-foreground/70 mb-2">Choose the language used for slide content and written course material.</p>
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
              <p className="text-[11px] font-medium text-foreground/70 mb-2">Choose the spoken language for narration, then select the narrator voice.</p>
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

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-bold text-foreground">Select Your Instructor</p>
                    <InfoHint text="Choose the virtual trainer shown to learners. Indian languages default to Indian trainers in auto mode." />
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {trainerAutoMode ? "Auto" : "Manual"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                          className={`overflow-hidden rounded-xl border-2 bg-card text-left transition-all ${
                            selected ? "border-primary shadow-[0_0_0_2px_rgba(14,140,168,0.15)]" : "border-border hover:border-primary/40"
                          }`}
                          type="button"
                        >
                          <div className="relative h-[78px] w-full overflow-hidden bg-[#dfe8f6]">
                            <img
                              src={trainerMedia.imageUrl}
                              alt={trainer.name}
                              className={`h-full w-full object-cover transition-transform duration-300 ${selected ? "scale-[1.08]" : "scale-100"}`}
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                            {selected ? (
                              <span className="absolute bottom-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0ea5c8] text-[12px] font-black text-white shadow">
                                ✓
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
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <label className="text-[13px] font-bold text-foreground">Target Duration</label>
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

          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-foreground">Video Time Handling</p>
                <InfoHint text="Choose whether video clips should consume course duration or be extra runtime." />
              </div>
              <p className="text-[11px] font-medium text-foreground/70 mt-0.5">
                Decide whether inserted YouTube clips should count inside the selected course duration or be added on top of it.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setVideoDurationHandling("within-course")}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  videoDurationHandling === "within-course"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
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
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  videoDurationHandling === "additional-to-course"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
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

          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
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

          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
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
                      {option.label} -+ {option.desc}
                    </button>
                  ))}
                </div>
              ) : null}
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
              <div className="px-6 py-4 border-t border-[#d9dfef] flex justify-between gap-3 bg-white/75">
                <button
                  onClick={onCancel}
                  className="h-10 min-w-[120px] px-5 rounded-full text-[14px] font-[800] tracking-tight text-[#2a3f67] border border-[#cfd7ea] bg-[#f5f7fd] hover:bg-[#ecf0fa] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="h-10 px-6 rounded-full text-[14px] font-extrabold tracking-tight text-white shadow-lg hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #6b4fd8)" }}
                >
                  Launch Course
                </button>
              </div>
            </div>

            <aside className="hidden lg:flex min-h-0 flex-col justify-between p-7 text-white border-l border-white/20"
              style={{ background: "radial-gradient(circle at 18% 18%, #6f76d9 0%, #483f9e 42%, #2e296c 100%)" }}>
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-[34px] leading-none font-[900] tracking-tight">Course Summary</h3>
                  <span className="text-white/80 text-[20px]">G��G��G��</span>
                </div>
                <div className="mt-4 h-px bg-white/25" />

                <div className="mt-5 rounded-2xl bg-white/95 text-[#1f2e55] p-5 shadow-[0_18px_32px_rgba(7,8,32,0.28)]">
                  <p className="text-[26px] leading-none font-[900] mb-3">{selectedLevelLabel} Level</p>
                  <div className="space-y-2.5 text-[14px]">
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#0e8ca8]" /> <span className="font-[800]">Text Language:</span> {textLanguage}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#0e8ca8]" /> <span className="font-[800]">Narration Language:</span> {narratorLanguage}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#0e8ca8]" /> <span className="font-[800]">Narrator Voice:</span> {selectedVoiceLabel}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#0e8ca8]" /> <span className="font-[800]">Instructor:</span> {selectedTrainer.name}</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#0e8ca8]" /> <span className="font-[800]">Duration:</span> {selectedDurationLabel}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-white/30 bg-white/10 backdrop-blur-sm">
                  <div className="relative h-[230px] w-full overflow-hidden">
                    <img
                      key={selectedTrainer.id}
                      src={selectedTrainerImage}
                      alt={`${selectedTrainer.name} preview`}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/80">Instructor Preview</p>
                      <p className="text-[22px] font-[900] leading-none text-white mt-1">{selectedTrainer.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/12 border border-white/20 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTrainerImage}
                    alt={selectedTrainer.name}
                    className="h-16 w-16 rounded-xl object-cover border border-white/45"
                  />
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.16em] text-white/70 font-[800]">Selected Instructor</p>
                    <p className="text-[22px] leading-none font-[900] mt-1">{selectedTrainer.name}</p>
                    <p className="text-[13px] text-white/75 mt-1">{learnerNotesEnabled ? "Notes enabled" : "Notes disabled"} -+ {assessmentRequired ? "Assessment enabled" : "Assessment off"}</p>
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
