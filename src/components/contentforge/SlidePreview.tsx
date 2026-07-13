import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Volume2, X, Youtube } from "lucide-react";
import { isPlaceholderToken, safeLearnerText, stripNarratorMarkdown } from "@/lib/textCleaningUtility";
import type { InsertedVideo } from "./VideosTab";

interface SlidePreviewProps {
  archRaw: string;
  visualRaw: string;
  writerRaw?: string;
  voiceRaw?: string;
  courseTitle: string;
  insertedVideos?: InsertedVideo[];
  avatarTrainerId?: string;
}

function tryParseJSON(raw: string | undefined | null): any | null {
  if (!raw || typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { return null; } }
    return null;
  }
}

interface SlideData {
  type: "title" | "content" | "video";
  moduleNum: number;
  moduleTitle: string;
  courseTitle: string;
  topics?: string[];
  layoutType?: string;
  topicTitle?: string;
  body?: string;
  imageDataUrl?: string;
  visualAltText?: string;
  video?: InsertedVideo;
}

type WriterSection = { heading: string; body: string };

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function parseTopicLabel(topic: any): string {
  if (typeof topic === "string") return stripNarratorMarkdown(topic).replace(/^"|"$/g, "").trim();
  if (topic && typeof topic === "object") {
    return String(topic.topic_name || topic.topic_title || topic.title || topic.topic || topic.name || topic.label || "").trim();
  }
  return "";
}

function cleanBody(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n/g, "\n").replace(/^---+\s*$/gm, "").trim();
  return cleaned && !isPlaceholderToken(cleaned) ? cleaned : "";
}

function objectBody(value: any): string {
  if (!value || typeof value !== "object") return "";
  const candidates = [value.content, value.body, value.text, value.narrative, value.script, value.lesson_content, value.description];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const cleaned = cleanBody(candidate);
      if (cleaned) return cleaned;
    }
    if (Array.isArray(candidate)) {
      const joined = candidate.map((item) => (typeof item === "string" ? item : objectBody(item))).filter(Boolean).join("\n\n");
      const cleaned = cleanBody(joined);
      if (cleaned) return cleaned;
    }
  }
  return "";
}

function extractWriterSections(writerRaw = ""): WriterSection[] {
  const json = tryParseJSON(writerRaw);
  const sections: WriterSection[] = [];
  const push = (heading: unknown, body: unknown) => {
    const parsedHeading = parseTopicLabel(heading);
    const parsedBody = typeof body === "string" ? cleanBody(body) : objectBody(body);
    if (parsedHeading && parsedBody) sections.push({ heading: parsedHeading, body: parsedBody });
  };
  const visitCollection = (items: any[]) => {
    items.forEach((item, index) => {
      push(item?.topic_name || item?.topic_title || item?.title || item?.heading || item?.name || `Section ${index + 1}`, item);
      const children = item?.topics || item?.sections || item?.lessons || item?.slides || item?.content;
      if (Array.isArray(children)) visitCollection(children);
    });
  };
  if (json) {
    const topLevel = json.sections || json.lessons || json.slides || json.topics;
    if (Array.isArray(topLevel)) visitCollection(topLevel);
    const modules = json.modules || json.course_structure?.modules || json.course_modules;
    if (Array.isArray(modules)) visitCollection(modules);
  }
  const normalized = writerRaw.replace(/\r\n/g, "\n");
  const headings = Array.from(normalized.matchAll(/^(#{2,4})\s+(.+?)\s*$/gm));
  headings.forEach((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index || normalized.length : normalized.length;
    const heading = stripNarratorMarkdown(match[2]).trim();
    const body = cleanBody(normalized.slice(start, end));
    if (heading && body) sections.push({ heading, body });
  });
  if (sections.length === 0) {
    const fallback = cleanBody(normalized.replace(/^#\s+.+$/m, ""));
    if (fallback) sections.push({ heading: "Course Content", body: fallback });
  }
  return sections;
}

function getWriterLookup(writerRaw: string | undefined, moduleTitles: string[]) {
  const sections = extractWriterSections(writerRaw || "");
  const moduleKeys = new Set(moduleTitles.map(normalizeKey));
  const exact = new Map<string, string>();
  const ordered: string[] = [];
  sections.forEach((section) => {
    const key = normalizeKey(section.heading);
    if (key && !exact.has(key)) exact.set(key, section.body);
    if (!moduleKeys.has(key) && !/^module\s*\d+\b/i.test(section.heading)) ordered.push(section.body);
  });
  return { exact, ordered };
}

function findTopicBody(topic: string, lookup: { exact: Map<string, string>; ordered: string[] }, index: number): string {
  const key = normalizeKey(topic);
  const exact = lookup.exact.get(key);
  if (exact) return exact;
  for (const [candidate, body] of lookup.exact.entries()) {
    if (key.length > 4 && (candidate.includes(key) || key.includes(candidate))) return body;
  }
  return lookup.ordered[index] || "";
}

function parseContentParts(text = "") {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => !line.match(/^#{1,4}\s/)).map((line) => line.trim()).filter((line) => line && !isPlaceholderToken(line));
  const paragraphs = lines.join("\n").split(/\n\n+/).map((paragraph) => safeLearnerText(paragraph)).filter(Boolean);
  let hook = "";
  let body: string[] = [];
  let takeaway = "";
  let challenge = "";
  paragraphs.forEach((paragraph, index) => {
    if (/^(Situation|Scenario)\s*:/i.test(paragraph)) hook = safeLearnerText(paragraph.replace(/^(Situation|Scenario)\s*:\s*/i, ""));
    else if (/^(Better Move|Challenge|Try this)\s*:/i.test(paragraph)) challenge = safeLearnerText(paragraph.replace(/^(Better Move|Challenge|Try this)\s*:\s*/i, ""));
    else if (/^(Key Takeaway|Takeaway|Remember|Tip)\s*:/i.test(paragraph)) takeaway = safeLearnerText(paragraph.replace(/^(Key Takeaway|Takeaway|Remember|Tip)\s*:\s*/i, ""));
    else if (index === 0 && !hook) hook = paragraph;
    else body.push(paragraph);
  });
  if (!takeaway && body.length > 1 && body[body.length - 1].length < 120) {
    takeaway = body[body.length - 1];
    body = body.slice(0, -1);
  }
  return { hook, body, takeaway, challenge };
}

function sentenceBullets(texts: string[], max = 4): string[] {
  const bullets: string[] = [];
  texts.forEach((text) => {
    const sentences = stripNarratorMarkdown(text).match(/[^.!?]+[.!?]+[\])"'`]*|[^.!?]+$/g) || [];
    sentences.forEach((sentence) => {
      const cleaned = safeLearnerText(sentence);
      if (cleaned && !isPlaceholderToken(cleaned) && bullets.length < max) bullets.push(cleaned);
    });
  });
  return Array.from(new Set(bullets)).slice(0, max);
}

function getVisualForTopic(visualModules: any[], moduleIndex: number, topicTitle: string) {
  const moduleVisual = visualModules[moduleIndex];
  const topicVisuals = Array.isArray(moduleVisual?.topic_visuals) ? moduleVisual.topic_visuals : [];
  const key = normalizeKey(topicTitle);
  return topicVisuals.find((visual: any) => normalizeKey(String(visual?.topic_title || visual?.title || visual?.name || "")) === key) || topicVisuals[0];
}

function timeToSeconds(value = ""): number {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function youtubeEmbedUrl(video: InsertedVideo): string {
  const start = timeToSeconds(video.startTime);
  const end = timeToSeconds(video.endTime);
  return `https://www.youtube.com/embed/${encodeURIComponent(video.videoId)}?rel=0&modestbranding=1${start ? `&start=${start}` : ""}${end ? `&end=${end}` : ""}`;
}

function buildSlides(archRaw: string, visualRaw: string, writerRaw: string | undefined, courseTitle: string, insertedVideos: InsertedVideo[] = []): SlideData[] {
  const arch = tryParseJSON(archRaw);
  const visual = tryParseJSON(visualRaw);
  const slides: SlideData[] = [];
  let modules: any[] = [];
  if (arch?.modules) modules = arch.modules;
  else if (arch?.course_structure?.modules) modules = arch.course_structure.modules;
  else if (Array.isArray(arch)) modules = arch;
  const visualModules = visual?.modules || visual?.course_visual_plan?.modules || visual?.module_visuals || [];
  if (modules.length === 0) return slides;
  const moduleTitles = modules.map((mod: any, i: number) => mod.module_title || mod.title || mod.name || `Module ${i + 1}`);
  const writerLookup = getWriterLookup(writerRaw, moduleTitles);
  let topicCounter = 0;
  modules.forEach((mod: any, i: number) => {
    const title = mod.module_title || mod.title || mod.name || `Module ${i + 1}`;
    const topics = mod.topics || mod.sections || mod.key_topics || [];
    const topicNames = topics.map(parseTopicLabel).filter(Boolean);
    const vm = visualModules[i];
    const layoutType = vm?.slide_layout || "Standard Layout";
    slides.push({ type: "title", moduleNum: i + 1, moduleTitle: title, courseTitle });
    if (topicNames.length === 0) {
      const body = findTopicBody(title, writerLookup, topicCounter++);
      slides.push({ type: "content", moduleNum: i + 1, moduleTitle: title, courseTitle, topics: [], layoutType, topicTitle: title, body });
    } else {
      topicNames.forEach((topicTitle) => {
        const body = findTopicBody(topicTitle, writerLookup, topicCounter++);
        const topicVisual = getVisualForTopic(visualModules, i, topicTitle);
        slides.push({
          type: "content",
          moduleNum: i + 1,
          moduleTitle: title,
          courseTitle,
          topics: topicNames,
          layoutType,
          topicTitle,
          body,
          imageDataUrl: typeof topicVisual?.generated_image_data_url === "string" ? topicVisual.generated_image_data_url : undefined,
          visualAltText: typeof topicVisual?.alt_text === "string" ? topicVisual.alt_text : undefined,
        });
      });
    }
    insertedVideos
      .filter((video) => normalizeKey(video.moduleTitle || "") === normalizeKey(title))
      .forEach((video) => {
        slides.push({ type: "video", moduleNum: i + 1, moduleTitle: title, courseTitle, topicTitle: video.title, video });
      });
  });
  return slides;
}

const TitleSlide: React.FC<{ slide: SlideData }> = ({ slide }) => (
  <div className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden bg-primary" style={{ height: 400 }}>
    <p className="text-[14px] text-primary-foreground/60 font-semibold mb-2">Module {slide.moduleNum}</p>
    <h2 className="text-[32px] font-extrabold text-primary-foreground text-center px-8 leading-tight">{slide.moduleTitle}</h2>
    <p className="absolute bottom-4 left-6 text-[13px] text-primary-foreground/50">{slide.courseTitle}</p>
    <p className="absolute bottom-4 right-6 text-[11px] text-primary-foreground/40 font-semibold">ContentForge</p>
  </div>
);

const ContentSlide: React.FC<{ slide: SlideData }> = ({ slide }) => {
  const parts = parseContentParts(slide.body || "");
  const hasRichContent = !!(parts.hook || parts.body.length || parts.takeaway || parts.challenge);
  const situation = parts.hook || parts.body[0] || slide.topicTitle || slide.moduleTitle;
  const notice = sentenceBullets([parts.hook, ...parts.body, parts.takeaway].filter(Boolean));
  const betterMove = parts.challenge || parts.takeaway || parts.body[1] || parts.body[0] || situation;
  if (!hasRichContent) {
    return (
      <div className="w-full rounded-2xl bg-card border border-border overflow-hidden flex flex-col" style={{ height: 400 }}>
        <div className="h-2 w-full bg-primary" />
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
              <Maximize2 className="w-5 h-5 text-primary" />
              <p className="text-[12px] font-semibold text-muted-foreground text-center px-2">{slide.layoutType}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full rounded-2xl bg-secondary border border-border overflow-hidden p-5" style={{ height: 400 }}>
      <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden">
          <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-muted-foreground">Module {slide.moduleNum}</p>
          <h3 className="mt-1 text-[22px] font-[900] leading-tight text-primary">{slide.topicTitle || slide.moduleTitle}</h3>
          <div className="mt-4 rounded-xl border border-border bg-secondary/70 p-3">
            <p className="text-[10px] font-[900] uppercase tracking-[0.14em] text-muted-foreground">Situation</p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/80 line-clamp-3">{situation}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-[900] uppercase tracking-[0.14em] text-muted-foreground">What to Notice</p>
              <div className="mt-2 space-y-1.5">
                {(notice.length ? notice : [situation]).slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] leading-snug text-foreground/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="line-clamp-2">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-accent p-3">
              <p className="text-[10px] font-[900] uppercase tracking-[0.14em] text-muted-foreground">Better Move</p>
              <p className="mt-2 text-[12px] leading-relaxed text-accent-foreground line-clamp-4">{betterMove}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm overflow-hidden">
          <p className="mb-2 text-[10px] font-[900] uppercase tracking-[0.14em] text-muted-foreground">Visual Context</p>
          <div className="flex h-[calc(100%-96px)] min-h-[190px] items-center justify-center overflow-hidden rounded-xl bg-secondary">
            {slide.imageDataUrl ? <img src={slide.imageDataUrl} alt={slide.visualAltText || slide.topicTitle || slide.moduleTitle} className="h-full w-full object-cover" /> : <p className="px-4 text-center text-[12px] font-semibold text-muted-foreground">{slide.layoutType || "Scenario visual"}</p>}
          </div>
          <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">AV</div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-primary">Avatar Guide</p>
                <p className="truncate text-[12px] font-semibold text-foreground/75">Narration available in output</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoSlide: React.FC<{ slide: SlideData }> = ({ slide }) => {
  if (!slide.video) return null;
  return (
    <div className="w-full rounded-2xl bg-card border border-border overflow-hidden p-5" style={{ height: 400 }}>
      <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="overflow-hidden rounded-xl border border-border bg-secondary">
          <iframe
            src={youtubeEmbedUrl(slide.video)}
            title={slide.video.title}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="rounded-xl border border-border bg-secondary/60 p-4">
          <Youtube className="mb-3 h-5 w-5 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Inserted YouTube</p>
          <h3 className="mt-2 text-[18px] font-black leading-tight text-foreground line-clamp-4">{slide.video.title}</h3>
          <p className="mt-2 text-[12px] font-semibold text-muted-foreground">{slide.video.channelTitle}</p>
          <p className="mt-4 text-[12px] text-foreground/70">Placed in Module {slide.moduleNum}: {slide.moduleTitle}</p>
        </div>
      </div>
    </div>
  );
};

export const SlidePreview: React.FC<SlidePreviewProps> = ({ archRaw, visualRaw, writerRaw, voiceRaw, courseTitle, insertedVideos = [] }) => {
  const slides = buildSlides(archRaw, visualRaw, writerRaw, courseTitle, insertedVideos);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const hasVoice = !!voiceRaw;
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
  const renderSlide = (s: SlideData) => s.type === "title" ? <TitleSlide slide={s} /> : s.type === "video" ? <VideoSlide slide={s} /> : <ContentSlide slide={s} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2">
          Slide Preview
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{slides.length} slides</span>
          {hasVoice && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full"><Volume2 className="h-3 w-3" /> Voice</span>}
          {insertedVideos.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full"><Youtube className="h-3 w-3" /> {insertedVideos.length} YouTube</span>}
        </h3>
        <button onClick={() => setFullscreen(true)} className="h-8 px-3 rounded-lg text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1.5 transition-all">
          <Maximize2 className="w-3.5 h-3.5" />
          Present Mode
        </button>
      </div>
      {renderSlide(slide)}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))} disabled={currentSlide === 0} className="w-8 h-8 rounded-lg bg-secondary hover:bg-border flex items-center justify-center disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
        <span className="text-[13px] font-semibold text-foreground">Slide {currentSlide + 1} of {slides.length}</span>
        <button onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))} disabled={currentSlide === slides.length - 1} className="w-8 h-8 rounded-lg bg-secondary hover:bg-border flex items-center justify-center disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4 text-foreground" /></button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button key={i} onClick={() => setCurrentSlide(i)} className={`w-20 h-12 rounded-lg shrink-0 overflow-hidden border-2 transition-all ${i === currentSlide ? "border-primary shadow-md" : "border-border opacity-60 hover:opacity-100"}`}>
            <div className="w-full h-full flex items-center justify-center text-[6px] font-bold bg-card text-foreground">{s.type === "title" ? `M${s.moduleNum}` : s.topicTitle?.slice(0, 16) || "Content"}</div>
          </button>
        ))}
      </div>
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-foreground/90 flex flex-col items-center justify-center p-8">
          <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center transition-all"><X className="w-5 h-5 text-background" /></button>
          <div className="w-full max-w-4xl">{renderSlide(slide)}</div>
          <div className="flex items-center gap-4 mt-6">
            <button onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))} disabled={currentSlide === 0} className="w-10 h-10 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-5 h-5 text-background" /></button>
            <span className="text-[14px] font-semibold text-background">{currentSlide + 1} / {slides.length}</span>
            <button onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))} disabled={currentSlide === slides.length - 1} className="w-10 h-10 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-5 h-5 text-background" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

