import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

interface SlidePreviewProps {
  archRaw: string;
  visualRaw: string;
  courseTitle: string;
}

function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { return null; } }
    return null;
  }
}

interface SlideData {
  type: "title" | "content";
  moduleNum: number;
  moduleTitle: string;
  courseTitle: string;
  topics?: string[];
  layoutType?: string;
}

function buildSlides(archRaw: string, visualRaw: string, courseTitle: string): SlideData[] {
  const arch = tryParseJSON(archRaw);
  const visual = tryParseJSON(visualRaw);
  const slides: SlideData[] = [];

  // Try to extract modules from architect output
  let modules: any[] = [];
  if (arch?.modules) modules = arch.modules;
  else if (arch?.course_structure?.modules) modules = arch.course_structure.modules;
  else if (Array.isArray(arch)) modules = arch;

  const visualModules = visual?.modules || [];

  if (modules.length === 0) return slides;

  modules.forEach((mod: any, i: number) => {
    const title = mod.module_title || mod.title || mod.name || `Module ${i + 1}`;
    const topics = mod.topics || mod.sections || mod.key_topics || [];
    const topicNames = topics.map((t: any) => (typeof t === "string" ? t : t.topic_name || t.topic_title || t.title || t.topic || t.name || ""));
    const vm = visualModules[i];
    const layoutType = vm?.slide_layout || "Standard Layout";

    slides.push({ type: "title", moduleNum: i + 1, moduleTitle: title, courseTitle });
    slides.push({ type: "content", moduleNum: i + 1, moduleTitle: title, courseTitle, topics: topicNames, layoutType });
  });

  return slides;
}

const TitleSlide: React.FC<{ slide: SlideData }> = ({ slide }) => (
  <div
    className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
    style={{ height: 400, background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
  >
    <p className="text-[14px] text-white/60 font-semibold mb-2">Module {slide.moduleNum}</p>
    <h2 className="text-[32px] font-extrabold text-white text-center px-8 leading-tight">{slide.moduleTitle}</h2>
    <p className="absolute bottom-4 left-6 text-[13px] text-white/50">{slide.courseTitle}</p>
    <p className="absolute bottom-4 right-6 text-[11px] text-white/30 font-semibold">ContentForge</p>
  </div>
);

const ContentSlide: React.FC<{ slide: SlideData }> = ({ slide }) => (
  <div
    className="w-full rounded-2xl bg-white border border-border overflow-hidden flex flex-col"
    style={{ height: 400 }}
  >
    <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }} />
    <div className="flex-1 flex p-6 gap-6">
      <div className="flex-[3] space-y-3">
        <h3 className="text-[20px] font-bold text-foreground">{slide.moduleTitle}</h3>
        <div className="space-y-2">
          {(slide.topics || []).slice(0, 8).map((topic, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <p className="text-[14px] text-foreground/80">{topic}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-[2] flex items-center justify-center">
        <div className="w-full h-full rounded-xl bg-secondary border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Maximize2 className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[12px] font-semibold text-muted-foreground text-center px-2">{slide.layoutType}</p>
        </div>
      </div>
    </div>
  </div>
);

export const SlidePreview: React.FC<SlidePreviewProps> = ({ archRaw, visualRaw, courseTitle }) => {
  const slides = buildSlides(archRaw, visualRaw, courseTitle);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrentSlide((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrentSlide((c) => Math.min(slides.length - 1, c + 1));
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[currentSlide];

  const renderSlide = (s: SlideData) =>
    s.type === "title" ? <TitleSlide slide={s} /> : <ContentSlide slide={s} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2">
          Slide Preview
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {slides.length} slides
          </span>
        </h3>
        <button
          onClick={() => setFullscreen(true)}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1.5 transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Present Mode
        </button>
      </div>

      {/* Main slide */}
      {renderSlide(slide)}

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))}
          disabled={currentSlide === 0}
          className="w-8 h-8 rounded-lg bg-secondary hover:bg-border flex items-center justify-center disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <span className="text-[13px] font-semibold text-foreground">
          Slide {currentSlide + 1} of {slides.length}
        </span>
        <button
          onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))}
          disabled={currentSlide === slides.length - 1}
          className="w-8 h-8 rounded-lg bg-secondary hover:bg-border flex items-center justify-center disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`w-20 h-12 rounded-lg shrink-0 overflow-hidden border-2 transition-all ${
              i === currentSlide ? "border-primary shadow-md" : "border-border opacity-60 hover:opacity-100"
            }`}
          >
            <div
              className="w-full h-full flex items-center justify-center text-[6px] font-bold"
              style={s.type === "title"
                ? { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white" }
                : { background: "white", color: "#0f172a" }
              }
            >
              {s.type === "title" ? `M${s.moduleNum}` : `Content`}
            </div>
          </button>
        ))}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-8">
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="w-full max-w-4xl">
            {renderSlide(slide)}
          </div>
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))}
              disabled={currentSlide === 0}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-[14px] font-semibold text-white">
              {currentSlide + 1} / {slides.length}
            </span>
            <button
              onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))}
              disabled={currentSlide === slides.length - 1}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
