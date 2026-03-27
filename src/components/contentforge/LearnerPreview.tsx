import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Check, Clock } from "lucide-react";
import { RawAgentOutputs } from "@/types/agents";
import { InsertedVideo } from "./VideosTab";

/* ── helpers ── */
function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { return null; } }
    return null;
  }
}

/* ── types ── */
interface Module {
  title: string;
  topics: string[];
}

type SlideType = "title" | "content" | "assessment" | "summary" | "video";

interface Slide {
  type: SlideType;
  moduleIndex: number;
  moduleTitle: string;
  topicIndex?: number;
  topicTitle?: string;
  content?: string;
  infographicSvg?: string;
  question?: { question: string; options: string[]; correct_answer: string; rationale?: string };
  takeaways?: string[];
  video?: InsertedVideo;
}

/* ── build slides from agent outputs ── */
function buildSlides(rawOutputs: RawAgentOutputs, insertedVideos: InsertedVideo[] = []): { modules: Module[]; slides: Slide[] } {
  const archData = tryParseJSON(rawOutputs.architect);
  const writerText = rawOutputs.writer || "";
  const assessData = tryParseJSON(rawOutputs.assessment);
  const visualData = tryParseJSON(rawOutputs.visual);

  // Extract modules
  let modules: Module[] = [];
  if (archData) {
    const mods = archData.modules || archData.course_structure?.modules || archData.course_modules || [];
    modules = mods.map((m: any) => ({
      title: m.module_title || m.title || m.name || "Untitled Module",
      topics: (m.topics || m.sections || m.lessons || []).map((t: any) =>
        typeof t === "string" ? t : t.topic_title || t.title || t.name || "Untitled Topic"
      ),
    }));
  }

  if (modules.length === 0) {
    modules = [{ title: "Module 1", topics: ["Introduction"] }];
  }

  // Extract MCQs
  const mcqs = assessData?.mcq || [];

  // Extract infographic SVGs from visual data
  const infographics: string[] = [];
  if (visualData?.modules) {
    visualData.modules.forEach((m: any) => {
      infographics.push(m.infographic_description || "");
    });
  }

  // Build slides
  const slides: Slide[] = [];
  
  // Split writer content into rough sections
  const writerSections = writerText.split(/(?=#{1,3}\s)/).filter(Boolean);

  modules.forEach((mod, mi) => {
    // 1. Title slide
    slides.push({ type: "title", moduleIndex: mi, moduleTitle: mod.title });

    // 2. Content slides — one per topic
    mod.topics.forEach((topic, ti) => {
      const sectionText = writerSections[ti] || `Content for ${topic} will appear here after running the pipeline.`;
      slides.push({
        type: "content",
        moduleIndex: mi,
        moduleTitle: mod.title,
        topicIndex: ti,
        topicTitle: topic,
        content: sectionText,
        infographicSvg: ti === 0 ? infographics[mi] : undefined,
      });
    });

    // 3. Assessment slide
    const mcq = mcqs[mi % mcqs.length];
    if (mcq) {
      slides.push({
        type: "assessment",
        moduleIndex: mi,
        moduleTitle: mod.title,
        question: mcq,
      });
    }

    // 3b. Insert video slides for this module
    const modVideos = insertedVideos.filter(v => v.moduleTitle === mod.title);
    modVideos.forEach(vid => {
      slides.push({
        type: "video",
        moduleIndex: mi,
        moduleTitle: mod.title,
        topicTitle: vid.title,
        video: vid,
      });
    });

    // 4. Summary slide
    slides.push({
      type: "summary",
      moduleIndex: mi,
      moduleTitle: mod.title,
      takeaways: mod.topics.slice(0, 3),
    });
  });

  return { modules, slides };
}

/* ── Confetti animation ── */
const Confetti: React.FC = () => {
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );
};

/* ── Main component ── */
interface LearnerPreviewProps {
  courseTitle: string;
  rawOutputs: RawAgentOutputs;
  onClose: () => void;
}

export const LearnerPreview: React.FC<LearnerPreviewProps> = ({ courseTitle, rawOutputs, onClose }) => {
  const { modules, slides } = React.useMemo(() => buildSlides(rawOutputs), [rawOutputs]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, { selected: number; submitted: boolean }>>({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime] = useState(Date.now());
  const [showCompletion, setShowCompletion] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slide = slides[currentSlide];
  const totalSlides = slides.length;
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  // Mark visited
  useEffect(() => {
    setVisited(prev => new Set(prev).add(currentSlide));
    if (currentSlide === totalSlides - 1 && slides[currentSlide]?.type === "summary") {
      // Check if this is the last module's summary
      const lastModuleIdx = modules.length - 1;
      if (slide.moduleIndex === lastModuleIdx) {
        setTimeout(() => setShowCompletion(true), 500);
      }
    }
  }, [currentSlide]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentSlide]);

  const goNext = useCallback(() => {
    if (currentSlide < totalSlides - 1) setCurrentSlide(c => c + 1);
  }, [currentSlide, totalSlides]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) setCurrentSlide(c => c - 1);
  }, [currentSlide]);

  // Get narration sections
  const voiceParsed = tryParseJSON(rawOutputs.voice);
  const narrationSections = voiceParsed?.sections || [];

  // Get slides for current module
  const currentModuleSlides = slides
    .map((s, i) => ({ ...s, idx: i }))
    .filter(s => s.moduleIndex === slide.moduleIndex);

  // Build sidebar TOC
  const toc = modules.map((mod, mi) => ({
    title: mod.title,
    moduleIndex: mi,
    slides: slides
      .map((s, i) => ({ ...s, idx: i }))
      .filter(s => s.moduleIndex === mi),
  }));

  const formatElapsed = () => {
    const secs = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSelectAnswer = (slideIdx: number, optionIdx: number) => {
    if (assessmentAnswers[slideIdx]?.submitted) return;
    setAssessmentAnswers(prev => ({ ...prev, [slideIdx]: { selected: optionIdx, submitted: false } }));
  };

  const handleSubmitAnswer = (slideIdx: number) => {
    const ans = assessmentAnswers[slideIdx];
    if (!ans || ans.submitted) return;
    const q = slides[slideIdx].question;
    if (!q) return;
    const correct = q.options[ans.selected] === q.correct_answer ||
      String.fromCharCode(65 + ans.selected) === q.correct_answer ||
      q.correct_answer?.includes(q.options[ans.selected]);
    setAssessmentAnswers(prev => ({ ...prev, [slideIdx]: { ...ans, submitted: true } }));
    setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  };

  // Narration text for current slide
  const getNarrationText = () => {
    if (!narrationSections.length) return "";
    // Map slide to narration section roughly
    const contentSlides = slides.filter(s => s.type === "content");
    const contentIdx = contentSlides.indexOf(slide as any);
    if (contentIdx >= 0 && narrationSections[contentIdx]) {
      return narrationSections[contentIdx].narration_text || "";
    }
    return "";
  };

  /* ── COMPLETION SCREEN ── */
  if (showCompletion) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "#0f172a" }}>
        <Confetti />
        <div className="text-center z-20 animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-[36px] font-[800] text-white mb-2">Course Complete!</h1>
          <p className="text-white/60 text-[16px] mb-6">{courseTitle}</p>
          <div className="flex items-center justify-center gap-8 mb-8">
            {score.total > 0 && (
              <div className="text-center">
                <p className="text-[28px] font-[800] text-emerald-400">{score.correct}/{score.total}</p>
                <p className="text-[13px] text-white/50">Assessment Score</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-[28px] font-[800] text-blue-400">{formatElapsed()}</p>
              <p className="text-[13px] text-white/50">Time Taken</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    );
  }

  /* ── SLIDE RENDERERS ── */
  const renderSlide = () => {
    switch (slide.type) {
      case "title":
        return (
          <div className="flex items-center justify-center h-full animate-fade-in">
            <div className="w-full max-w-[800px] rounded-2xl p-12 text-center"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              <p className="text-[13px] font-bold text-white/60 uppercase tracking-[3px] mb-4">
                Module {String(slide.moduleIndex + 1).padStart(2, "0")}
              </p>
              <h1 className="text-[42px] font-[800] text-white leading-tight mb-4">{slide.moduleTitle}</h1>
              <p className="text-[15px] text-white/60 mb-8">{courseTitle}</p>
              <span className="inline-flex items-center gap-2 bg-white/20 text-white text-[13px] font-semibold px-4 py-2 rounded-full">
                <Clock className="w-4 h-4" />
                ~12 min
              </span>
            </div>
          </div>
        );

      case "content":
        return (
          <div className="max-w-[800px] mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-1.5 bg-[#4f46e5]" />
              <div className="p-7">
                <h2 className="text-[26px] font-bold text-[#0f172a] mb-4">{slide.topicTitle}</h2>
                <div className="text-[17px] text-[#374151] leading-[1.8] whitespace-pre-wrap">
                  {slide.content}
                </div>
                {slide.infographicSvg && (
                  <div className="mt-6 bg-slate-50 rounded-xl p-4 text-[14px] text-[#64748b] italic">
                    📊 Infographic: {slide.infographicSvg}
                  </div>
                )}
              </div>
              <div className="px-7 pb-4 text-right">
                <span className="text-[12px] font-semibold text-[#94a3b8] bg-slate-100 px-3 py-1 rounded-full">
                  Slide {currentSlide + 1}
                </span>
              </div>
            </div>
          </div>
        );

      case "assessment": {
        const ans = assessmentAnswers[currentSlide];
        const q = slide.question;
        if (!q) return null;
        return (
          <div className="max-w-[800px] mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-1.5 bg-amber-400" />
              <div className="p-7">
                <p className="text-[13px] font-bold text-amber-600 uppercase tracking-wider mb-4">Knowledge Check</p>
                <h2 className="text-[22px] font-bold text-[#0f172a] mb-6">{q.question}</h2>
                <div className="space-y-3">
                  {q.options.map((opt: string, oi: number) => {
                    let style = "border-[#e2e8f0] bg-white hover:bg-[#f0f2f7]";
                    if (ans?.submitted) {
                      const isCorrect = opt === q.correct_answer ||
                        String.fromCharCode(65 + oi) === q.correct_answer ||
                        q.correct_answer?.includes(opt);
                      if (isCorrect) style = "border-emerald-400 bg-emerald-50 text-emerald-800";
                      else if (oi === ans.selected) style = "border-red-400 bg-red-50 text-red-800";
                    } else if (ans?.selected === oi) {
                      style = "border-[#4f46e5] bg-[rgba(79,70,229,0.05)]";
                    }
                    return (
                      <button
                        key={oi}
                        onClick={() => handleSelectAnswer(currentSlide, oi)}
                        className={`w-full h-[52px] rounded-xl border-2 px-4 text-left text-[16px] transition-all ${style}`}
                      >
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {ans && !ans.submitted && (
                  <button
                    onClick={() => handleSubmitAnswer(currentSlide)}
                    className="w-full h-12 rounded-xl text-[15px] font-bold text-white mt-6"
                    style={{ background: "#4f46e5" }}
                  >
                    Submit Answer
                  </button>
                )}
                {ans?.submitted && (
                  <div className="mt-4 space-y-3">
                    {q.rationale && (
                      <p className="text-[14px] text-[#64748b] bg-slate-50 rounded-xl p-4">💡 {q.rationale}</p>
                    )}
                    <button
                      onClick={goNext}
                      className="w-full h-12 rounded-xl text-[15px] font-bold text-white"
                      style={{ background: "#4f46e5" }}
                    >
                      Next Slide →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case "summary":
        return (
          <div className="flex items-center justify-center h-full animate-fade-in relative">
            <Confetti />
            <div className="w-full max-w-[800px] rounded-2xl p-12 text-center relative z-20"
              style={{ background: "linear-gradient(135deg, #4f46e5, #10b981)" }}>
              <p className="text-[13px] font-bold text-white/60 uppercase tracking-[3px] mb-4">Module Complete</p>
              <h1 className="text-[32px] font-[800] text-white leading-tight mb-6">{slide.moduleTitle}</h1>
              <div className="text-left space-y-3 max-w-[500px] mx-auto mb-8">
                {(slide.takeaways || []).map((t, i) => (
                  <div key={i} className="flex items-start gap-3 text-white">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[15px] leading-relaxed">{t}</span>
                  </div>
                ))}
              </div>
              {slide.moduleIndex < modules.length - 1 ? (
                <button
                  onClick={goNext}
                  className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all"
                >
                  Next Module →
                </button>
              ) : (
                <button
                  onClick={() => setShowCompletion(true)}
                  className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all"
                >
                  Complete Course
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0f172a" }}>
      {/* TOP BAR */}
      <div className="h-[60px] shrink-0 flex items-center px-6 border-b"
        style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
        <p className="text-[16px] font-bold text-white truncate max-w-[240px]">{courseTitle}</p>
        <div className="flex-1 mx-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#4f46e5" }} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {score.total > 0 && (
            <span className="text-[13px] font-semibold text-emerald-400">Score: {score.correct}/{score.total}</span>
          )}
          <span className="text-[13px] text-white/50">Slide {currentSlide + 1} of {totalSlides}</span>
          <button onClick={onClose} className="text-[14px] text-white/50 hover:text-white transition-colors">
            Exit Preview
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT SIDEBAR */}
        <div className="w-[220px] shrink-0 overflow-y-auto p-4 hidden md:block"
          style={{ background: "rgba(0,0,0,0.3)" }}>
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Course Contents</p>
          {toc.map((mod, mi) => (
            <div key={mi} className="mb-3">
              <p className={`text-[13px] font-semibold text-white mb-1 pl-2 border-l-2 ${
                slide.moduleIndex === mi ? "border-[#4f46e5]" : "border-transparent"
              }`}>
                {mod.title}
              </p>
              <div className="space-y-0.5 ml-2">
                {mod.slides.map((s) => (
                  <button
                    key={s.idx}
                    onClick={() => setCurrentSlide(s.idx)}
                    className={`w-full text-left text-[12px] px-2 py-1 rounded flex items-center gap-2 transition-colors ${
                      s.idx === currentSlide ? "text-white bg-white/10" : "text-white/50 hover:text-white/70"
                    }`}
                  >
                    {visited.has(s.idx) && s.idx !== currentSlide ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : s.idx === currentSlide ? (
                      <div className="w-2 h-2 rounded-full bg-[#4f46e5] shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className="truncate">
                      {s.type === "title" ? "Introduction" :
                        s.type === "assessment" ? "Knowledge Check" :
                        s.type === "summary" ? "Summary" :
                        s.topicTitle || `Topic ${(s.topicIndex || 0) + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CENTER STAGE */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          {renderSlide()}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-[200px] shrink-0 overflow-y-auto p-4 hidden lg:block"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Slide Notes</p>
          {getNarrationText() ? (
            <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap">
              {getNarrationText().replace(/\[.*?\]/g, "")}
            </p>
          ) : (
            <p className="text-[12px] text-white/30 italic">No narration for this slide</p>
          )}
          <div className="mt-6">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Resources</p>
            <p className="text-[12px] text-white/30 italic">No resources attached</p>
          </div>
        </div>
      </div>

      {/* NARRATION AUDIO CONTROLS */}
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-50">
        {getNarrationText() ? (
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <Play className="w-4 h-4" />
            </button>
            <div className="flex gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-1 rounded-full bg-white/30" style={{ height: `${6 + Math.random() * 12}px` }} />
              ))}
            </div>
            <button onClick={() => setMuted(!muted)} className="text-white/60 hover:text-white transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-[11px] text-white/40">Narrated by Rachel</span>
          </div>
        ) : (
          <p className="text-[12px] text-white/30 italic">No narration for this slide</p>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-t"
        style={{ background: "rgba(0,0,0,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="h-10 px-5 rounded-lg border border-white/20 text-white text-[14px] font-semibold flex items-center gap-2 disabled:opacity-30 hover:bg-white/5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {/* Dot nav for current module */}
        <div className="flex items-center gap-1.5">
          {currentModuleSlides.map((s) => (
            <button
              key={s.idx}
              onClick={() => setCurrentSlide(s.idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                s.idx === currentSlide ? "bg-[#4f46e5] scale-125" :
                visited.has(s.idx) ? "bg-white/50" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === totalSlides - 1}
          className="h-10 px-5 rounded-lg text-white text-[14px] font-semibold flex items-center gap-2 disabled:opacity-30 hover:brightness-110 transition-all"
          style={{ background: "#4f46e5" }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white text-[14px] flex items-center gap-1 z-50"
      >
        <X className="w-4 h-4" /> Close
      </button>
    </div>
  );
};
