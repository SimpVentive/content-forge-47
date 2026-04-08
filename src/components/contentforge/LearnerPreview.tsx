import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Check, Clock, Film, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { RawAgentOutputs } from "@/types/agents";
import { InsertedVideo } from "./VideosTab";
import { VideoTimelinePlacer } from "./VideoTimelinePlacer";
import { HIGHLIGHT_PALETTES, PreviewActionBar, type HighlightPalette } from "./PreviewActionBar";

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

function normalizeModuleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function buildFallbackInfographicText(module: Module): string {
  const topics = module.topics.filter(Boolean).slice(0, 3);
  if (topics.length === 0) {
    return `A visual summary for ${module.title} showing the core learning flow and main learner decisions.`;
  }
  return `A structured visual for ${module.title} connecting ${topics.join(", ")} into one learner-friendly concept map.`;
}

function getInfographicDescription(visualModule: any, module: Module): string {
  const candidate = [
    visualModule?.infographic_description,
    visualModule?.infographic,
    visualModule?.visual_aid,
    visualModule?.diagram_description,
    visualModule?.slide_layout,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return candidate?.trim() || buildFallbackInfographicText(module);
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

/* ── Parse writer content into structured parts ── */
function parseContentParts(text: string) {
  const lines = text.split("\n").filter(l => !l.match(/^#{1,3}\s/)); // remove heading lines
  const joined = lines.join("\n").trim();
  const paragraphs = joined.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

  let hook = "";
  let body: string[] = [];
  let takeaway = "";
  let challenge = "";

  paragraphs.forEach((p, i) => {
    if (i === 0) {
      hook = p;
    } else if (p.match(/^(Key Takeaway|Takeaway|Remember|💡)/i)) {
      takeaway = p.replace(/^(Key Takeaway:|Takeaway:|Remember:|💡\s*)/i, "").trim();
    } else if (p.match(/^(Challenge:|Next time|Try this:)/i) || (i === paragraphs.length - 1 && p.length < 120)) {
      challenge = p.replace(/^(Challenge:\s*)/i, "").trim();
    } else {
      body.push(p);
    }
  });

  // If no takeaway found, check last body paragraph
  if (!takeaway && body.length > 1) {
    const last = body[body.length - 1];
    if (last.length < 100) {
      takeaway = last;
      body = body.slice(0, -1);
    }
  }

  return { hook, body, takeaway, challenge };
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
    modules = mods.map((m: any, mi: number) => ({
      title: m.module_title || m.title || m.name || `Module ${mi + 1}`,
      topics: (m.topics || m.sections || m.lessons || []).map((t: any, ti: number) =>
        typeof t === "string" ? t : t.topic_name || t.topic_title || t.title || t.name || `Module ${mi + 1} — Part ${ti + 1}`
      ),
    }));
  }

  if (modules.length === 0) {
    modules = [{ title: "Module 1", topics: ["Introduction"] }];
  }

  // Extract MCQs
  const mcqs = assessData?.mcq || [];

  // Extract infographic descriptions from visual agent
  const visualModules = visualData?.modules || visualData?.course_visual_plan?.modules || visualData?.module_visuals || [];

  // Build slides
  const slides: Slide[] = [];
  
  // Split writer content by ## headers to map to topics
  const writerSections: Record<string, string> = {};
  const sectionRegex = /##\s+(.+?)\n([\s\S]*?)(?=\n##\s|\n$|$)/g;
  let match;
  while ((match = sectionRegex.exec(writerText)) !== null) {
    writerSections[match[1].trim().toLowerCase()] = match[2].trim();
  }
  // Also split by heading for fallback
  const writerParts = writerText.split(/(?=##\s)/).filter(Boolean);

  let topicCounter = 0;

  modules.forEach((mod, mi) => {
    const matchedVisualModule = visualModules.find((vm: any) => {
      const moduleTitle = vm?.module_title || vm?.title || vm?.name || "";
      return moduleTitle && normalizeModuleKey(moduleTitle) === normalizeModuleKey(mod.title);
    }) || visualModules[mi];
    const infographicDescription = getInfographicDescription(matchedVisualModule, mod);

    // 1. Title slide
    slides.push({ type: "title", moduleIndex: mi, moduleTitle: mod.title });

    // 2. Content slides — one per topic
    mod.topics.forEach((topic, ti) => {
      // Try to match writer section by topic name
      let sectionText = writerSections[topic.toLowerCase()] || "";
      if (!sectionText && writerParts[topicCounter]) {
        sectionText = writerParts[topicCounter].replace(/^##\s+.+\n/, "").trim();
      }
      if (!sectionText) {
        sectionText = `Content for "${topic}" will appear here after running the pipeline.`;
      }
      
      slides.push({
        type: "content",
        moduleIndex: mi,
        moduleTitle: mod.title,
        topicIndex: ti,
        topicTitle: topic,
        content: sectionText,
        infographicSvg: ti === 0 ? infographicDescription : undefined,
      });
      topicCounter++;
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

    // 3b. Insert video slides for this module (fuzzy match module titles)
    const modVideos = insertedVideos.filter(v => 
      v.moduleTitle === mod.title || 
      normalizeModuleKey(v.moduleTitle) === normalizeModuleKey(mod.title)
    );
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

/* ── Waveform Bars ── */
const WaveformBars: React.FC<{ playing: boolean }> = ({ playing }) => (
  <div className="flex items-end gap-[3px] h-5">
    {[0, 1, 2, 3].map(i => (
      <div
        key={i}
        className="w-[3px] rounded-full"
        style={{
          backgroundColor: "#4f46e5",
          height: playing ? undefined : "4px",
          animation: playing ? `waveBar 0.6s ease-in-out ${i * 0.1}s infinite` : "none",
        }}
      />
    ))}
  </div>
);

/* ── Infographic Visual Aid (on-demand SVG generation) ── */
function extractSVG(text: string): string {
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) return svgMatch[0];
  const codeMatch = text.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
  if (codeMatch) {
    const inner = codeMatch[1].trim();
    const innerSvg = inner.match(/<svg[\s\S]*?<\/svg>/i);
    if (innerSvg) return innerSvg[0];
  }
  return "";
}

const InfographicVisualAid: React.FC<{ description: string; moduleTitle: string }> = ({ description, moduleTitle }) => {
  const [expanded, setExpanded] = useState(false);
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const generateSvg = useCallback(async () => {
    if (svg || loading) return;
    setLoading(true);
    setError(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error: fnErr } = await supabase.functions.invoke("claude", {
        body: {
          systemPrompt: "You are an SVG infographic designer. Generate a clean, professional SVG infographic. Use only these colors: #4f46e5 (indigo), #7c3aed (violet), #10b981 (emerald), #f59e0b (amber), #f8fafc (background), #0f172a (text). The SVG must be 600x400px, self-contained, with no external fonts or images. Use geometric shapes, icons made from basic SVG paths, and bold readable text.",
          userMessage: `Create an infographic for module: "${moduleTitle}". Visual description: ${description}`,
        },
      });
      if (fnErr || data?.error) {
        setError(true);
      } else {
        const result = extractSVG(data.text || "");
        if (result) setSvg(result);
        else setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [svg, loading, description, moduleTitle]);

  const handleToggle = () => {
    if (!expanded && !svg && !loading) generateSvg();
    setExpanded(!expanded);
  };

  return (
    <div className="mb-6 rounded-2xl border border-border overflow-hidden anim-scale-in" style={{ animationDelay: "0.16s" }}>
      <button
        onClick={handleToggle}
        className="w-full flex items-start gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
        style={{ background: "hsl(var(--secondary) / 0.7)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[18px] text-primary">
          📊
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-foreground">Module Infographic</p>
          <p className="text-[11px] font-semibold text-primary">
            {expanded ? "Click to collapse" : "Click to view visual aid"}
          </p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? <ZoomOut className="w-4 h-4 text-muted-foreground" /> : <ZoomIn className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-4" style={{ minHeight: 200 }}>
          {loading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-[13px] text-muted-foreground">Generating infographic…</span>
            </div>
          ) : svg ? (
            <div
              className="w-full flex items-center justify-center overflow-hidden"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <p className="text-[13px] text-red-500">Failed to generate infographic</p>
              <button onClick={generateSvg} className="text-[12px] font-semibold text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};


interface LearnerPreviewProps {
  courseTitle: string;
  rawOutputs: RawAgentOutputs;
  onClose: () => void;
  insertedVideos?: InsertedVideo[];
  courseDuration?: string;
  slideLayout?: {
    maxLines: number;
    minFontSize: number;
    lineSpacing: number;
  };
}

export const LearnerPreview: React.FC<LearnerPreviewProps> = ({ courseTitle, rawOutputs, onClose, insertedVideos = [], courseDuration, slideLayout }) => {
  const [localVideos, setLocalVideos] = useState<InsertedVideo[]>(insertedVideos);
  const [showPlacer, setShowPlacer] = useState(false);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [highlightPalette, setHighlightPalette] = useState<HighlightPalette>("yellow");

  // Sync if parent changes
  useEffect(() => { setLocalVideos(insertedVideos); }, [insertedVideos]);

  const unassignedCount = localVideos.filter(v => !v.moduleTitle).length;
  const activeHighlightPalette = HIGHLIGHT_PALETTES[highlightPalette];
  const slideRules = {
    maxLines: slideLayout?.maxLines ?? 10,
    minFontSize: slideLayout?.minFontSize ?? 12.5,
    lineSpacing: slideLayout?.lineSpacing ?? 2,
  };

  const { modules, slides } = React.useMemo(() => buildSlides(rawOutputs, localVideos), [rawOutputs, localVideos]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, { selected: number; submitted: boolean }>>({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime] = useState(Date.now());
  const [showCompletion, setShowCompletion] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<Record<number, string>>({});

  const slide = slides[currentSlide];
  const totalSlides = slides.length;
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  // Get narration sections
  const voiceParsed = tryParseJSON(rawOutputs.voice);
  const narrationSections = voiceParsed?.sections || [];

  // Word highlight state
  const [highlightWordIdx, setHighlightWordIdx] = useState(-1);
  const animFrameRef = useRef<number>(0);

  // Narration text for current slide — with fallback to slide content
  const getNarrationForSlide = useCallback((slideIdx: number) => {
    const s = slides[slideIdx];
    if (!s || s.type !== "content") return "";

    // Try voice agent output first
    if (narrationSections.length) {
      const contentSlides = slides.filter(sl => sl.type === "content");
      const contentIdx = contentSlides.indexOf(s);
      if (contentIdx >= 0 && narrationSections[contentIdx]) {
        const txt = narrationSections[contentIdx].narration_text || "";
        if (txt) return txt;
      }
    }

    // Fallback: build narration from slide content
    const parts = parseContentParts(s.content || "");
    const lines: string[] = [];
    if (parts.hook) lines.push(parts.hook);
    parts.body.forEach(p => lines.push(p));
    if (parts.takeaway) lines.push(`Key takeaway: ${parts.takeaway}`);
    return lines.join(". ").replace(/\.\./g, ".").slice(0, 2500) || "";
  }, [slides, narrationSections]);

  // Split narration into sentences for highlighting
  const narrationSentences = useMemo(() => {
    const text = getNarrationForSlide(currentSlide);
    if (!text) return [];
    // Split by sentence-ending punctuation, keeping the punctuation
    return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [text];
  }, [currentSlide, getNarrationForSlide]);

  // Also keep words for progress calculation
  const narrationWords = useMemo(() => {
    const text = getNarrationForSlide(currentSlide);
    return text ? text.split(/\s+/).filter(Boolean) : [];
  }, [currentSlide, getNarrationForSlide]);

  // Track current sentence index (not word)
  const [highlightSentenceIdx, setHighlightSentenceIdx] = useState(-1);

  // Stop audio on slide change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    }
    setHighlightWordIdx(-1);
    setHighlightSentenceIdx(-1);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [currentSlide]);

  // Animate sentence highlight while playing
  const startWordHighlight = useCallback((audio: HTMLAudioElement) => {
    const totalSentences = narrationSentences.length;
    const totalWords = narrationWords.length;
    if (!totalSentences || !totalWords) return;

    // Pre-compute cumulative word counts per sentence to map audio progress → sentence
    const sentenceWordCounts = narrationSentences.map(s => s.split(/\s+/).length);
    const cumulativeWords: number[] = [];
    sentenceWordCounts.reduce((acc, count, i) => {
      cumulativeWords[i] = acc + count;
      return acc + count;
    }, 0);

    const tick = () => {
      if (audio.paused || audio.ended) return;
      const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      const wordIdx = Math.floor(progress * totalWords);
      // Find which sentence this word belongs to
      let sentIdx = 0;
      for (let i = 0; i < cumulativeWords.length; i++) {
        if (wordIdx < cumulativeWords[i]) { sentIdx = i; break; }
        sentIdx = i;
      }
      setHighlightWordIdx(wordIdx);
      setHighlightSentenceIdx(sentIdx);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [narrationSentences, narrationWords]);

  // Helper to wire up audio events
  const wireAudio = useCallback((audio: HTMLAudioElement) => {
    audio.muted = muted;
    audioRef.current = audio;
    audio.onplay = () => { setIsPlaying(true); startWordHighlight(audio); };
    audio.onended = () => { setIsPlaying(false); setHighlightWordIdx(-1); setHighlightSentenceIdx(-1); };
    audio.onpause = () => { setIsPlaying(false); if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [muted, startWordHighlight]);

  // Fetch and play TTS on demand (user gesture)
  const playNarration = useCallback(async () => {
    const narrationText = getNarrationForSlide(currentSlide);
    if (!narrationText) return;

    // If we already have audio for this slide, just play it
    if (audioUrlsRef.current[currentSlide]) {
      const audio = new Audio(audioUrlsRef.current[currentSlide]);
      wireAudio(audio);
      await audio.play().catch(() => {});
      return;
    }

    // Fetch from ElevenLabs
    setAudioLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: narrationText.slice(0, 2500),
            voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error("TTS error:", response.status, errText);
        return;
      }
      const blob = await response.blob();
      if (blob.size < 100) { console.error("TTS returned empty audio"); return; }
      const url = URL.createObjectURL(blob);
      audioUrlsRef.current[currentSlide] = url;
      const audio = new Audio(url);
      wireAudio(audio);
      await audio.play().catch(() => {});
    } catch (err) {
      console.error("TTS fetch failed:", err);
    } finally {
      setAudioLoading(false);
    }
  }, [currentSlide, getNarrationForSlide, wireAudio]);

  // Mute/unmute live
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  // Mark visited
  useEffect(() => {
    setVisited(prev => new Set(prev).add(currentSlide));
    if (currentSlide === totalSlides - 1 && slides[currentSlide]?.type === "summary") {
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

  const currentModuleSlides = slides
    .map((s, i) => ({ ...s, idx: i }))
    .filter(s => s.moduleIndex === slide.moduleIndex);

  const toc = modules.map((mod, mi) => ({
    title: mod.title,
    moduleIndex: mi,
    slides: slides.map((s, i) => ({ ...s, idx: i })).filter(s => s.moduleIndex === mi),
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

  const currentNarration = getNarrationForSlide(currentSlide);

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
          <button onClick={onClose} className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all">
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
          <div className="flex flex-col items-center justify-center h-full gap-6" key={currentSlide}>
            {/* Avatar character card with speech bubble */}
            <div className="flex items-end gap-4 anim-fade-in-down" style={{ animationDelay: "0s" }}>
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              {/* Speech bubble */}
              <div className="relative bg-white rounded-2xl rounded-bl-md px-5 py-3 shadow-md max-w-[400px]"
                style={{ animation: "fadeInUp 0.5s ease both", animationDelay: "0.15s" }}>
                <p className="text-[14px] font-semibold" style={{ color: "#1e293b" }}>
                  Welcome to <span style={{ color: "#4f46e5" }}>Module {slide.moduleIndex + 1}</span>! 🎓
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "#64748b" }}>
                  Let's explore this topic together.
                </p>
                {/* Bubble tail */}
                <div className="absolute -left-2 bottom-2 w-0 h-0"
                  style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "8px solid white" }} />
              </div>
            </div>

            <div className="w-full max-w-[800px] rounded-2xl p-12 text-center anim-fade-in-down"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", animationDelay: "0.1s" }}>
              <p className="text-[13px] font-bold text-white/60 uppercase tracking-[3px] mb-4">
                Module {String(slide.moduleIndex + 1).padStart(2, "0")}
              </p>
              <h1 className="text-[42px] font-[800] text-white leading-tight mb-4">{slide.moduleTitle}</h1>
              <p className="text-[15px] text-white/60 mb-8">{courseTitle}</p>
              <span className="inline-flex items-center gap-2 bg-white/20 text-white text-[13px] font-semibold px-4 py-2 rounded-full">
                <Clock className="w-4 h-4" />
                ~{courseDuration || "15"} min
              </span>
            </div>
          </div>
        );

      case "content": {
        const parts = parseContentParts(slide.content || "");
        const moduleLabel = `MODULE ${slide.moduleIndex + 1} — ${slide.moduleTitle}`.toUpperCase();
        const maxTextBlocks = Math.max(1, Math.floor(slideRules.maxLines / 2));
        const reservedBlocks = [parts.hook, parts.takeaway, parts.challenge].filter(Boolean).length;
        const visibleBodySlots = Math.max(1, maxTextBlocks - reservedBlocks);
        const visibleBody = parts.body.slice(0, visibleBodySlots);
        const contentTextStyle = {
          fontSize: `${Math.max(14, slideRules.minFontSize)}px`,
          lineHeight: slideRules.lineSpacing,
        } as React.CSSProperties;
        const supportingTextStyle = {
          fontSize: `${Math.max(12.5, slideRules.minFontSize)}px`,
          lineHeight: slideRules.lineSpacing,
        } as React.CSSProperties;
        const clampTwoLines = {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        } as React.CSSProperties;

        // Collect all raw text in order to split into sentences
        const allRawText: string[] = [];
        if (parts.hook) allRawText.push(parts.hook);
        parts.body.forEach(p => allRawText.push(p));
        if (parts.takeaway) allRawText.push(parts.takeaway);
        if (parts.challenge) allRawText.push(parts.challenge);

        const fullText = allRawText.join(" ");
        const allSentences = fullText.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [fullText];

        // Render text as sentence spans with per-sentence highlighting
        const renderSentenceText = (text: string) => {
          const blockSentences = text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [text];
          return blockSentences.map((sentence, si) => {
            // Find global sentence index
            const globalIdx = allSentences.findIndex((s, gi) => {
              // Match by content - find first unmatched occurrence
              return s === sentence && !allSentences.slice(0, gi).filter(prev => prev === sentence).length || s === sentence;
            });
            // More robust: find by accumulating
            let gIdx = -1;
            let searchFrom = 0;
            // Walk through all raw text blocks to find the position
            for (let bi = 0; bi < allRawText.length; bi++) {
              const blockSents = allRawText[bi].match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [allRawText[bi]];
              for (let bsi = 0; bsi < blockSents.length; bsi++) {
                if (allRawText[bi] === text && bsi === si) {
                  gIdx = searchFrom;
                }
                searchFrom++;
              }
              if (gIdx >= 0) break;
            }

            const isActive = highlightEnabled && isPlaying && highlightSentenceIdx >= 0 && gIdx === highlightSentenceIdx;

            return (
              <span
                key={si}
                style={{
                  padding: "2px 4px",
                  borderRadius: "6px",
                  transition: "background 0.25s ease, box-shadow 0.25s ease",
                  ...(isActive ? {
                    background: activeHighlightPalette.background,
                    boxShadow: `inset 4px 0 0 ${activeHighlightPalette.border}`,
                  } : {}),
                }}
              >
                {sentence}{" "}
              </span>
            );
          });
        };

        return (
          <div className="max-w-[800px] mx-auto" key={currentSlide}>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Top accent bar */}
              <div className="h-[6px]" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }} />
              
              <div className="p-8">
                {/* Module label */}
                <p className="text-[11px] font-semibold tracking-[2px] mb-2 anim-fade-in-down"
                  style={{ color: "#4f46e5", fontSize: `${Math.max(12.5, slideRules.minFontSize)}px` }}>
                  {moduleLabel}
                </p>
                
                {/* Topic title */}
                <h2 className="text-[28px] font-[800] mb-6 anim-fade-in-down"
                  style={{ color: "#0f172a", animationDelay: "0.1s" }}>
                  {slide.topicTitle}
                </h2>

                {slide.infographicSvg?.trim() && (
                  <InfographicVisualAid
                    description={slide.infographicSvg}
                    moduleTitle={slide.moduleTitle}
                  />
                )}

                {/* Hook paragraph — special styling */}
                {parts.hook && (
                  <div className="mb-5 rounded-lg p-4 anim-fade-in-up"
                    style={{
                      borderLeft: "3px solid hsl(var(--primary))",
                      background: "hsl(var(--primary) / 0.06)",
                      animationDelay: "0.15s",
                    }}>
                    <p className="text-[17px]" style={{ color: "#374151", ...contentTextStyle, ...clampTwoLines }}>
                      {renderSentenceText(parts.hook)}
                    </p>
                  </div>
                )}

                {/* Body paragraphs with sentence-level highlight */}
                {visibleBody.map((para, pi) => (
                  <div key={pi} className="mb-4 anim-fade-in-up">
                    <p className="text-[17px]"
                      style={{ color: "#374151", animationDelay: `${0.3 + pi * 0.15}s`, ...contentTextStyle, ...clampTwoLines }}>
                      {renderSentenceText(para)}
                    </p>
                  </div>
                ))}

                {/* Takeaway box */}
                {parts.takeaway && (
                  <div className="mt-6 rounded-lg p-[14px_18px] anim-fade-in-up"
                    style={{
                      background: "hsl(var(--highlight-yellow-bg))",
                      borderLeft: "4px solid hsl(var(--highlight-yellow-border))",
                      animationDelay: "0.5s",
                    }}>
                    <p className="text-[11px] font-bold uppercase tracking-[1.5px] mb-1"
                      style={{ color: "#d97706", ...supportingTextStyle }}>
                      Key Takeaway
                    </p>
                    <p className="text-[15px]" style={{ color: "#92400e", ...contentTextStyle, ...clampTwoLines }}>
                      {renderSentenceText(parts.takeaway)}
                    </p>
                  </div>
                )}

                {/* Challenge line */}
                {parts.challenge && (
                  <p className="mt-4 pt-3 text-[15px] italic anim-fade-in-up"
                    style={{
                      color: "#6b7280",
                      borderTop: "1px solid #f1f5f9",
                      animationDelay: "0.6s",
                      ...contentTextStyle,
                      ...clampTwoLines,
                    }}>
                    {renderSentenceText(parts.challenge)}
                  </p>
                )}
              </div>

              <div className="px-8 pb-4 text-right">
                <span className="text-[12px] font-semibold px-3 py-1 rounded-full"
                  style={{ color: "#94a3b8", background: "#f1f5f9" }}>
                  Slide {currentSlide + 1}
                </span>
              </div>
            </div>
          </div>
        );
      }

      case "assessment": {
        const ans = assessmentAnswers[currentSlide];
        const q = slide.question;
        if (!q) return null;
        return (
          <div className="max-w-[800px] mx-auto" key={currentSlide}>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-[6px]" style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
              <div className="p-8">
                <p className="text-[13px] font-bold uppercase tracking-wider mb-4 anim-fade-in-down"
                  style={{ color: "#d97706" }}>
                  Knowledge Check
                </p>
                <h2 className="text-[22px] font-bold mb-6 anim-bounce-in"
                  style={{ color: "#0f172a", animationDelay: "0.1s" }}>
                  {q.question}
                </h2>
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
                        className={`w-full h-[52px] rounded-xl border-2 px-4 text-left text-[16px] transition-all anim-fade-in-up ${style}`}
                        style={{ animationDelay: `${0.2 + oi * 0.08}s` }}
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
                      <p className="text-[14px] bg-slate-50 rounded-xl p-4" style={{ color: "#64748b" }}>
                        💡 {q.rationale}
                      </p>
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
          <div className="flex items-center justify-center h-full relative" key={currentSlide}>
            <Confetti />
            <div className="w-full max-w-[800px] rounded-2xl p-12 text-center relative z-20 anim-fade-in-down"
              style={{ background: "linear-gradient(135deg, #4f46e5, #10b981)" }}>
              <p className="text-[13px] font-bold text-white/60 uppercase tracking-[3px] mb-4">Module Complete</p>
              <h1 className="text-[32px] font-[800] text-white leading-tight mb-6">{slide.moduleTitle}</h1>
              <div className="text-left space-y-3 max-w-[500px] mx-auto mb-8">
                {(slide.takeaways || []).map((t, i) => (
                  <div key={i} className="flex items-start gap-3 text-white anim-slide-in-left"
                    style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[15px] leading-relaxed">{t}</span>
                  </div>
                ))}
              </div>
              {slide.moduleIndex < modules.length - 1 ? (
                <button onClick={goNext}
                  className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all">
                  Next Module →
                </button>
              ) : (
                <button onClick={() => setShowCompletion(true)}
                  className="h-12 px-8 rounded-xl bg-white text-[#0f172a] text-[15px] font-bold hover:bg-white/90 transition-all">
                  Complete Course
                </button>
              )}
            </div>
          </div>
        );

      case "video": {
        const vid = slide.video;
        if (!vid) return null;
        const startSec = vid.startTime ? vid.startTime.split(":").reduce((a: number, b: string) => a * 60 + parseInt(b), 0) : 0;
        const endParam = vid.endTime ? `&end=${vid.endTime.split(":").reduce((a: number, b: string) => a * 60 + parseInt(b), 0)}` : "";
        const src = `https://www.youtube.com/embed/${vid.videoId}?start=${startSec}${endParam}&rel=0&modestbranding=1&color=white`;
        const durMatch = vid.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const durStr = durMatch ? `${parseInt(durMatch[2]||"0")}:${String(parseInt(durMatch[3]||"0")).padStart(2,"0")}` : "";
        return (
          <div className="max-w-[800px] mx-auto" key={currentSlide}>
            <div className="rounded-2xl overflow-hidden anim-fade-in-up" style={{ background: "#0f172a" }}>
              <div className="px-7 pt-5 flex items-center gap-2">
                <span className="text-[12px] text-white/50 uppercase tracking-wider font-semibold">Video Resource</span>
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              </div>
              <div className="px-7 pt-3 pb-3">
                <h2 className="text-[22px] font-bold text-white">{vid.title}</h2>
                <p className="text-[13px] text-white/60 mt-1">{vid.channelTitle} · {durStr}</p>
              </div>
              <div className="px-5 pb-4">
                <iframe
                  src={src}
                  className="w-full rounded-xl"
                  style={{ height: "338px" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="px-7 pb-5">
                <p className="text-[11px] text-white/40">Source: YouTube — included for educational purposes</p>
              </div>
            </div>
          </div>
        );
      }

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

      <PreviewActionBar
        highlightEnabled={highlightEnabled}
        highlightPalette={highlightPalette}
        onToggleHighlight={() => setHighlightEnabled(prev => !prev)}
        onSelectPalette={setHighlightPalette}
        onPlaceVideos={unassignedCount > 0 ? () => setShowPlacer(true) : undefined}
        unassignedCount={unassignedCount}
      />

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
                    ) : s.type === "video" ? (
                      <div className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className="truncate">
                      {s.type === "title" ? "Introduction" :
                        s.type === "assessment" ? "Knowledge Check" :
                        s.type === "summary" ? "Summary" :
                        s.type === "video" ? `▶ ${s.topicTitle?.slice(0, 25) || "Video"}` :
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
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Narration Script</p>
          {currentNarration ? (
            <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap">
              {currentNarration.replace(/\[.*?\]/g, "").slice(0, 500)}
            </p>
          ) : (
            <p className="text-[12px] text-white/30 italic">No narration for this slide type</p>
          )}
          <div className="mt-6">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Resources</p>
            <p className="text-[12px] text-white/30 italic">No resources attached</p>
          </div>
        </div>
      </div>

      {/* NARRATION AUDIO CONTROLS — floating player */}
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-50">
        {currentNarration ? (
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
            <button
              onClick={() => {
                if (audioLoading) return;
                if (audioRef.current && isPlaying) {
                  audioRef.current.pause();
                } else if (audioRef.current && !isPlaying) {
                  audioRef.current.play().catch(() => {});
                } else {
                  playNarration();
                }
              }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              {audioLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <WaveformBars playing={isPlaying} />
            <button onClick={() => setMuted(!muted)} className="text-white/60 hover:text-white transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-[11px] text-white/40">
              {audioLoading ? "Loading…" : isPlaying ? "Playing" : "Click ▶ to play"} · Sarah
            </span>
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

      {/* VideoTimelinePlacer overlay */}
      {showPlacer && (
        <VideoTimelinePlacer
          clips={localVideos.map(v => ({
            id: v.videoId,
            videoId: v.videoId,
            title: v.title,
            channelTitle: v.channelTitle,
            thumbnail: v.thumbnail,
            duration: v.duration,
            clipType: "all" as const,
            startTime: v.startTime,
            endTime: v.endTime,
            customName: v.customName || v.title,
            insertAfterModule: v.moduleTitle || "",
          }))}
          modules={modules.map(m => ({ title: m.title, sections: m.topics }))}
          courseDuration={courseDuration || "15min"}
          onUpdateClip={(id, updates) => {
            setLocalVideos(prev => prev.map(v =>
              v.videoId === id
                ? { ...v, moduleTitle: updates.insertAfterModule ?? v.moduleTitle }
                : v
            ));
          }}
          onRemoveClip={(id) => {
            setLocalVideos(prev => prev.filter(v => v.videoId !== id));
          }}
          onFinish={() => setShowPlacer(false)}
          onBack={() => setShowPlacer(false)}
        />
      )}
    </div>
  );
};
