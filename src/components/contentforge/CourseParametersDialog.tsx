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
  maxYoutubeVideos: number;
  slideLayout: {
    maxLines: number;
    minFontSize: number;
    lineSpacing: number;
  };
  learningType: "static" | "video" | "image";
  videoQuality: "720p" | "1080p" | "4k";
  backgroundStyle: "simple" | "office" | "classroom";
  imageStyleVariant?: "realistic" | "illustrated" | "flat-design" | "cartoon";
  imageCount?: 1 | 2 | 3;
  imageAspectRatio?: "landscape" | "portrait" | "square";
  showAvatarNarrator?: boolean;
  showCaption?: boolean;
  voiceoverPace?: "slow" | "normal" | "fast";
  imageNarrativeSceneCount?: 3 | 4 | 5 | 6;
  flipbookDisplayStyle?: "page-flip" | "smooth-slide" | "step-reveal";
  imageOutputFormat?: "interactive-html" | "video" | "pdf";
}

interface CourseParametersDialogProps {
  open: boolean;
  courseTitle: string;
  estimatedMinutes?: number | null;
  /** Whether the YouTube agent is enabled in the orchestrator. Hides YouTube-only setup sections when false. */
  youtubeAgentEnabled?: boolean;
  /** Pre-selected learning mode (static, video, or image). Defaults to "static". */
  initialLearningType?: "static" | "video" | "image";
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
  { value: "1min", label: "1 min", minutes: 1 }, // Testing
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

const VIDEO_QUALITIES = [
  { id: "720p", label: "720p - Fast", desc: "Faster generation (3-5 min per video)" },
  { id: "1080p", label: "1080p - Standard", desc: "Standard HD (5-8 min per video)" },
  { id: "4k", label: "4K - Premium", desc: "Highest quality (10-15 min per video)" },
] as const;

const BACKGROUND_STYLES = [
  { id: "simple", label: "Simple - Plain Color", desc: "Minimalist, distraction-free" },
  { id: "office", label: "Office - Professional Setting", desc: "Modern office background" },
  { id: "classroom", label: "Classroom - Educational", desc: "Classroom or training room" },
] as const;

const IMAGE_STYLES = [
  { id: "realistic", label: "Realistic" },
  { id: "illustrated", label: "Illustrated" },
  { id: "flat-design", label: "Flat Design" },
  { id: "cartoon", label: "Cartoon" },
] as const;

const IMAGE_COUNTS = [1, 2, 3] as const;

const IMAGE_ASPECT_RATIOS = [
  { id: "landscape", label: "Landscape" },
  { id: "portrait", label: "Portrait" },
  { id: "square", label: "Square" },
] as const;

const VOICEOVER_PACES = [
  { id: "slow", label: "Slow" },
  { id: "normal", label: "Normal" },
  { id: "fast", label: "Fast" },
] as const;

const IMAGE_NARRATIVE_SCENE_COUNTS = [3, 4, 5, 6] as const;

const FLIPBOOK_DISPLAY_STYLES = [
  { id: "page-flip", label: "Page Flip", desc: "Realistic page-turning animation" },
  { id: "smooth-slide", label: "Smooth Slide", desc: "Smooth carousel transition" },
  { id: "step-reveal", label: "Step Reveal", desc: "Progressive reveal with captions" },
] as const;

const IMAGE_OUTPUT_FORMATS = [
  { id: "interactive-html", label: "Interactive HTML", desc: "Web-ready flipbook for LMS/browser" },
  { id: "video", label: "Video", desc: "Stitched video sequence with narration" },
  { id: "pdf", label: "PDF Flipbook", desc: "PDF with flip effect and captions" },
] as const;

// Map duration to YouTube video count
export const DURATION_VIDEO_COUNT: Record<string, number> = {
  "1min": 1,  // Testing
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
  open, courseTitle, estimatedMinutes, youtubeAgentEnabled = true, initialLearningType = "static", onConfirm, onCancel,
}) => {
  const headingFont = '"Poppins", sans-serif';
  const bodyFont = '"Inter", sans-serif';
  const buttonFont = '"Poppins", sans-serif';
  const [localLearningType, setLocalLearningType] = useState<CourseParameters["learningType"]>(initialLearningType);
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
  const [maxYoutubeVideos, setMaxYoutubeVideos] = useState(20);
  const [maxLines, setMaxLines] = useState<CourseParameters["slideLayout"]["maxLines"]>(10);
  const [minFontSize, setMinFontSize] = useState<CourseParameters["slideLayout"]["minFontSize"]>(12.5);
  const [lineSpacing, setLineSpacing] = useState<CourseParameters["slideLayout"]["lineSpacing"]>(2);
  const [videoQuality, setVideoQuality] = useState<CourseParameters["videoQuality"]>("1080p");
  const [backgroundStyle, setBackgroundStyle] = useState<CourseParameters["backgroundStyle"]>("office");
  const [imageStyleVariant, setImageStyleVariant] = useState<CourseParameters["imageStyleVariant"]>("illustrated");
  const [imageCount, setImageCount] = useState<CourseParameters["imageCount"]>(1);
  const [imageAspectRatio, setImageAspectRatio] = useState<CourseParameters["imageAspectRatio"]>("landscape");
  const [showAvatarNarrator, setShowAvatarNarrator] = useState(false);
  const [showCaption, setShowCaption] = useState(true);
  const [voiceoverPace, setVoiceoverPace] = useState<CourseParameters["voiceoverPace"]>("normal");
  const [imageNarrativeSceneCount, setImageNarrativeSceneCount] = useState<CourseParameters["imageNarrativeSceneCount"]>(4);
  const [flipbookDisplayStyle, setFlipbookDisplayStyle] = useState<CourseParameters["flipbookDisplayStyle"]>("smooth-slide");
  const [imageOutputFormat, setImageOutputFormat] = useState<CourseParameters["imageOutputFormat"]>("interactive-html");
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const [mismatchType, setMismatchType] = useState<"more" | "less">("more");
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [pendingLearningType, setPendingLearningType] = useState<CourseParameters["learningType"] | null>(null);
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
      maxYoutubeVideos,
      slideLayout: { maxLines, minFontSize, lineSpacing },
      learningType: localLearningType,
      videoQuality,
      backgroundStyle,
      imageStyleVariant,
      imageCount,
      imageAspectRatio,
      showAvatarNarrator,
      showCaption,
      voiceoverPace,
      imageNarrativeSceneCount,
      flipbookDisplayStyle,
      imageOutputFormat,
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
      maxYoutubeVideos,
      slideLayout: { maxLines, minFontSize, lineSpacing },
      learningType: localLearningType,
      videoQuality,
      backgroundStyle,
      imageStyleVariant,
      imageCount,
      imageAspectRatio,
      showAvatarNarrator,
      showCaption,
      voiceoverPace,
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
      maxYoutubeVideos,
      slideLayout: { maxLines, minFontSize, lineSpacing },
      learningType: localLearningType,
      videoQuality,
      backgroundStyle,
      imageStyleVariant,
      imageCount,
      imageAspectRatio,
      showAvatarNarrator,
      showCaption,
      voiceoverPace,
      imageNarrativeSceneCount,
      flipbookDisplayStyle,
      imageOutputFormat,
    });
  };

  const handleDismissMismatch = () => {
    setShowMismatchWarning(false);
  };

  const handleModeToggleClick = (newType: CourseParameters["learningType"]) => {
    if (newType === localLearningType) return; // No change
    setPendingLearningType(newType);
    setShowModeConfirm(true);
  };

  const handleConfirmModeSwitch = () => {
    if (pendingLearningType) {
      setLocalLearningType(pendingLearningType);
      setShowModeConfirm(false);
      setPendingLearningType(null);
    }
  };

  const handleCancelModeSwitch = () => {
    setShowModeConfirm(false);
    setPendingLearningType(null);
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
                <button
                  onClick={handleDismissMismatch}
                  className="w-full h-[44px] rounded-lg text-[13px] font-medium transition-all duration-200 ease-in-out hover:bg-secondary"
                  style={{ fontFamily: buttonFont, color: "#475569", backgroundColor: "#F8FAFC" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode Switch Confirmation Dialog */}
      {showModeConfirm && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-[500px] max-w-[92vw] bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            style={{ fontFamily: bodyFont }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-blue-500" />
            <div className="px-8 pt-7 pb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-[18px] font-extrabold tracking-tight text-foreground leading-tight">
                  Change Learning Format?
                </h3>
              </div>

              <p className="text-[14px] text-foreground leading-relaxed mb-6">
                You selected <span className="font-bold">{localLearningType === "static" ? "Static E-Learning" : localLearningType === "video" ? "Video Course" : "Image Course"}</span>.
                Switch to <span className="font-bold">{pendingLearningType === "static" ? "Static E-Learning" : pendingLearningType === "video" ? "Video Course" : "Image Course"}</span>?
              </p>
              <p className="text-[13px] text-muted-foreground mb-5">
                This will change which agents run during generation and the available course settings.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmModeSwitch}
                  className="w-full h-[52px] rounded-lg text-[14px] font-medium text-white transition-all duration-200 ease-in-out flex items-center justify-center gap-2 shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:brightness-110"
                  style={{ background: "#2563EB", fontFamily: buttonFont }}
                >
                  Yes, switch to {pendingLearningType === "static" ? "Static E-Learning" : pendingLearningType === "video" ? "Video Course" : "Image Course"}
                </button>
                <button
                  onClick={handleCancelModeSwitch}
                  className="w-full h-[52px] rounded-lg text-[14px] font-medium border transition-all duration-200 ease-in-out flex items-center justify-center gap-2"
                  style={{ fontFamily: buttonFont, color: "#2563EB", borderColor: "#2563EB", backgroundColor: "#FFFFFF" }}
                >
                  No, keep {localLearningType === "static" ? "Static E-Learning" : localLearningType === "video" ? "Video Course" : "Image Course"}
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
          {/* Learning Mode Toggle */}
          <div className={surfaceCardClass}>
            <label className="text-[13px] text-[#2E2E2E] mb-3 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
              Learning Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeToggleClick("image")}
                className={`flex-1 px-4 py-2.5 rounded-[12px] border text-[13px] font-semibold transition-all duration-200 ease-in-out ${
                  localLearningType === "image"
                    ? "text-white border-transparent"
                    : "border-[#E5E7EB] bg-white text-[#2E2E2E] hover:border-[#6EC1E4]"
                }`}
                style={localLearningType === "image" ? { background: "#b45309" } : undefined}
              >
                Image Course
              </button>
              <button
                onClick={() => handleModeToggleClick("static")}
                className={`flex-1 px-4 py-2.5 rounded-[12px] border text-[13px] font-semibold transition-all duration-200 ease-in-out ${
                  localLearningType === "static"
                    ? "text-white border-transparent"
                    : "border-[#E5E7EB] bg-white text-[#2E2E2E] hover:border-[#6EC1E4]"
                }`}
                style={localLearningType === "static" ? { background: "#2563EB" } : undefined}
              >
                Static E-Learning
              </button>
              <button
                onClick={() => handleModeToggleClick("video")}
                className={`flex-1 px-4 py-2.5 rounded-[12px] border text-[13px] font-semibold transition-all duration-200 ease-in-out ${
                  localLearningType === "video"
                    ? "text-white border-transparent"
                    : "border-[#E5E7EB] bg-white text-[#2E2E2E] hover:border-[#6EC1E4]"
                }`}
                style={localLearningType === "video" ? { background: "#0891b2" } : undefined}
              >
                Video Course
              </button>
            </div>
          </div>

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

          {/* Image Course Sections */}
          {localLearningType === "image" && (
          <div className="space-y-5">
            {/* Avatar Narrator */}
            <div className={surfaceCardClass + " flex items-center justify-between"}>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-bold text-foreground">Show Avatar Narrator</p>
                  <InfoHint text="An animated avatar will appear alongside each image explaining the content." />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Display an animated instructor with images</p>
              </div>
              <button
                onClick={() => setShowAvatarNarrator(!showAvatarNarrator)}
                className={`w-12 h-6 rounded-full transition-all duration-200 ease-in-out relative ${
                  showAvatarNarrator ? "bg-[#34D399]" : "bg-[#D1D5DB]"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-200 ease-in-out ${
                  showAvatarNarrator ? "left-[26px]" : "left-[2px]"
                }`} />
              </button>
            </div>

            {/* Show instructor grid when avatar narrator is enabled */}
            {showAvatarNarrator && (
            <div className={surfaceCardClass}>
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
              </div>
            </div>
            )}

            {/* Image Style */}
            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Image Visual Style
                <InfoHint text="Choose the visual style for all generated images." />
              </label>
              <div className="flex flex-wrap gap-2">
                {IMAGE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setImageStyleVariant(style.id as CourseParameters["imageStyleVariant"])}
                    className={`h-10 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                      imageStyleVariant === style.id
                        ? "text-white"
                        : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#b45309]"
                    }`}
                    style={imageStyleVariant === style.id ? { background: "#b45309", borderColor: "transparent" } : undefined}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Images per Step */}
            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Images per SOP Step
                <InfoHint text="How many images to generate per step of the procedure." />
              </label>
              <div className="flex flex-wrap gap-2">
                {IMAGE_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setImageCount(count as CourseParameters["imageCount"])}
                    className={`h-10 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                      imageCount === count
                        ? "text-white"
                        : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#b45309]"
                    }`}
                    style={imageCount === count ? { background: "#b45309", borderColor: "transparent" } : undefined}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Aspect Ratio */}
            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Image Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {IMAGE_ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setImageAspectRatio(ratio.id as CourseParameters["imageAspectRatio"])}
                    className={`h-10 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                      imageAspectRatio === ratio.id
                        ? "text-white"
                        : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#b45309]"
                    }`}
                    style={imageAspectRatio === ratio.id ? { background: "#b45309", borderColor: "transparent" } : undefined}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption Below Image */}
            <div className={surfaceCardClass + " flex items-center justify-between"}>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-bold text-foreground">Show Caption Below Image</p>
                  <InfoHint text="Displays a short text caption under each image during playback." />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Display text beneath images</p>
              </div>
              <button
                onClick={() => setShowCaption(!showCaption)}
                className={`w-12 h-6 rounded-full transition-all duration-200 ease-in-out relative ${
                  showCaption ? "bg-[#34D399]" : "bg-[#D1D5DB]"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-200 ease-in-out ${
                  showCaption ? "left-[26px]" : "left-[2px]"
                }`} />
              </button>
            </div>

            {/* Voiceover Pace - Only for Static E-Learning */}
            {localLearningType !== "image" && (
              <div className={surfaceCardClass}>
                <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                  Voiceover Pace
                </label>
                <div className="flex flex-wrap gap-2">
                  {VOICEOVER_PACES.map((pace) => (
                    <button
                      key={pace.id}
                      onClick={() => setVoiceoverPace(pace.id as CourseParameters["voiceoverPace"])}
                      className={`h-10 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                        voiceoverPace === pace.id
                          ? "text-white"
                          : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#b45309]"
                      }`}
                      style={voiceoverPace === pace.id ? { background: "#b45309", borderColor: "transparent" } : undefined}
                    >
                      {pace.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image Narrative Scene Count - Only for Image Course */}
            {localLearningType === "image" && (
              <div className={surfaceCardClass}>
                <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                  Scenes per Topic (Visual Story)
                  <InfoHint text="Create a narrative story with multiple connected images per topic, like a comic strip. More scenes = richer storytelling." />
                </label>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_NARRATIVE_SCENE_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setImageNarrativeSceneCount(count as CourseParameters["imageNarrativeSceneCount"])}
                      className={`h-10 px-4 rounded-full text-[13px] font-semibold border transition-all duration-200 ease-in-out ${
                        imageNarrativeSceneCount === count
                          ? "text-white"
                          : "border-[#E5E7EB] text-[#2E2E2E] hover:border-[#b45309]"
                      }`}
                      style={imageNarrativeSceneCount === count ? { background: "#b45309", borderColor: "transparent" } : undefined}
                  >
                    {count} Scenes
                  </button>
                ))}
              </div>
              </div>
            )}

            {/* Flipbook Display Style - Only for Image Course */}
            {localLearningType === "image" && (
              <div className={surfaceCardClass}>
                <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                  Display Style
                  <InfoHint text="How the image sequence will be displayed to learners." />
                </label>
                <div className="space-y-2">
                  {FLIPBOOK_DISPLAY_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setFlipbookDisplayStyle(style.id as CourseParameters["flipbookDisplayStyle"])}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        flipbookDisplayStyle === style.id
                          ? "border-[#b45309] bg-orange-50"
                          : "border-[#E5E7EB] hover:border-[#b45309]"
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[#2E2E2E]">{style.label}</p>
                      <p className="text-[11px] text-[#6B7280]">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image Output Format */}
            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-3 flex items-center gap-1.5 block" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Final Output Format
                <InfoHint text="Choose how the image narrative will be delivered to learners." />
              </label>
              <div className="space-y-2">
                {IMAGE_OUTPUT_FORMATS.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setImageOutputFormat(format.id as CourseParameters["imageOutputFormat"])}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      imageOutputFormat === format.id
                        ? "border-[#b45309] bg-orange-50"
                        : "border-[#E5E7EB] hover:border-[#b45309]"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[#2E2E2E]">{format.label}</p>
                    <p className="text-[11px] text-[#6B7280]">{format.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

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

          {localLearningType === "video" && (
          <div>
            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-2 flex items-center gap-1.5" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Video Quality
                <InfoHint text="Higher quality means slower video generation." />
              </label>
              <p className="text-[11px] text-[#6B7280] mb-3">Higher quality = slower generation</p>
              <div className="space-y-2">
                {VIDEO_QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setVideoQuality(q.id as CourseParameters["videoQuality"])}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      videoQuality === q.id
                        ? "border-[#0891b2] bg-[#0891b2]/5"
                        : "border-[#E5E7EB] bg-white hover:border-[#0891b2]"
                    }`}
                  >
                    <p className="font-semibold text-[#2E2E2E]">{q.label}</p>
                    <p className="text-xs text-[#6B7280]">{q.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className={surfaceCardClass}>
              <label className="text-[13px] text-[#2E2E2E] mb-2 flex items-center gap-1.5" style={{ fontFamily: bodyFont, fontWeight: 600 }}>
                Background Style
                <InfoHint text="Choose the environment your avatar appears in." />
              </label>
              <p className="text-[11px] text-[#6B7280] mb-3">What environment should your avatar appear in?</p>
              <div className="space-y-2">
                {BACKGROUND_STYLES.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setBackgroundStyle(bg.id as CourseParameters["backgroundStyle"])}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      backgroundStyle === bg.id
                        ? "border-[#0891b2] bg-[#0891b2]/5"
                        : "border-[#E5E7EB] bg-white hover:border-[#0891b2]"
                    }`}
                  >
                    <p className="font-semibold text-[#2E2E2E]">{bg.label}</p>
                    <p className="text-xs text-[#6B7280]">{bg.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {localLearningType === "static" && youtubeAgentEnabled && (
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
          )}

          {localLearningType === "static" && youtubeAgentEnabled && (
          <div className={surfaceCardClass}>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[13px] font-bold text-foreground">YouTube Video Count</p>
              <InfoHint text="Maximum number of YouTube videos fetched per module during course generation." />
            </div>
            <p className="text-[11px] text-[#6B7280] mb-3">How many YouTube videos to surface per module (default 20). Increase for more variety, decrease to keep it focused.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMaxYoutubeVideos(v => Math.max(5, v - 5))}
                className="h-9 w-9 rounded-lg border border-[#E5E7EB] bg-white text-[18px] font-bold text-foreground hover:border-primary transition-colors"
              >−</button>
              <span className="w-12 text-center text-[20px] font-extrabold text-foreground">{maxYoutubeVideos}</span>
              <button
                type="button"
                onClick={() => setMaxYoutubeVideos(v => Math.min(50, v + 5))}
                className="h-9 w-9 rounded-lg border border-[#E5E7EB] bg-white text-[18px] font-bold text-foreground hover:border-primary transition-colors"
              >+</button>
              <span className="text-[11px] text-muted-foreground">videos per module (max 50)</span>
            </div>
          </div>
          )}

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

          {localLearningType === "static" && (
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
          )}

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

                    {localLearningType === "image" ? (
                      <>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Avatar:</span> {showAvatarNarrator ? selectedTrainer.name : "None"}</p>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Image Style:</span> {IMAGE_STYLES.find((s) => s.id === imageStyleVariant)?.label || "Illustrated"}</p>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Images per Step:</span> {imageCount}</p>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Aspect Ratio:</span> {IMAGE_ASPECT_RATIOS.find((r) => r.id === imageAspectRatio)?.label || "Landscape"}</p>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Caption:</span> {showCaption ? "Enabled" : "Disabled"}</p>
                      </>
                    ) : (
                      <>
                        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Instructor:</span> {selectedTrainer.name}</p>
                        {localLearningType === "static" && (
                          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Flip Style:</span> {FLIP_STYLE_OPTIONS.find((option) => option.value === flipStyle)?.label || "Bound Flipchart"}</p>
                        )}
                      </>
                    )}

                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6EC1E4]" /> <span style={{ fontWeight: 600 }}>Duration:</span> {selectedDurationLabel}</p>
                  </div>
                </div>

                {((localLearningType === "image" && showAvatarNarrator) || localLearningType !== "image") && (
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
                )}
              </div>

              {((localLearningType === "image" && showAvatarNarrator) || localLearningType !== "image") && (
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
              )}
            </aside>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

