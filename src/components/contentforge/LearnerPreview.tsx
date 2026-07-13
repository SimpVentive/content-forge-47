import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Check, Clock, Film, Loader2, RefreshCw, ZoomIn, ZoomOut, Home, BarChart3, NotebookPen, FolderOpen, MessageSquareText, BookOpenText, Settings2, HelpCircle, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";
import { HelpModal } from "@/components/HelpModal";
import { RawAgentOutputs } from "@/types/agents";
import { InsertedVideo } from "./VideosTab";
import { VideoTimelinePlacer } from "./VideoTimelinePlacer";
import { FLIP_STYLES, HIGHLIGHT_PALETTES, PreviewActionBar, type FlipStyle, type HighlightPalette } from "./PreviewActionBar";
import { AvatarNarrator } from "./AvatarNarrator";
import { NarrativeFlipbook } from "./NarrativeFlipbook";
import type { TopicNarrative } from "@/lib/visualNarrativeService";
import { AVATAR_TRAINERS, getTrainerMedia, getTrainerVoiceId, type VisemeKey } from "@/lib/avatarTrainers";
import { stripNarratorMarkdown, isPlaceholderToken, safeLearnerText, stripOptionPrefix } from "@/lib/textCleaningUtility";
import { toast } from "sonner";
import { logApiUsage } from "@/lib/edgeFunctions";

/* helpers */
function tryParseJSON(raw: string | undefined | null): any | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { return null; } }
    return null;
  }
}

/* types */
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


function getNarratorExcerpt(text: string, sentenceCount = 3): string {
  const normalized = stripNarratorMarkdown(text);
  if (!normalized) return "";

  const sentences = normalized.match(/[^.!?]+[.!?]+[\])"'`]*|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [normalized];
  return sentences.slice(0, sentenceCount).join(" ");
}

type ElevenLabsAlignment = {
  characters?: string[];
  chars?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
  char_start_times_ms?: number[];
  char_durations_ms?: number[];
};

type VisemeCue = {
  startMs: number;
  endMs: number;
  viseme: VisemeKey;
};

type ParsedTtsPayload = {
  audioUrl: string;
  visemeTimeline: VisemeCue[];
};

function decodeBase64Audio(base64Audio: string): Blob {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "audio/mpeg" });
}

function toMilliseconds(value: number, fromSeconds: boolean): number {
  return fromSeconds ? value * 1000 : value;
}

function mapTokenToViseme(token: string): VisemeKey {
  const normalized = token.toLowerCase();
  if (!normalized || /\s/.test(normalized) || /[.,!?;:'"()\[\]{}\-]/.test(normalized)) return "rest";
  if (["th"].includes(normalized)) return "th";
  if (["ch", "sh", "zh"].includes(normalized)) return "ch";
  if (["ph", "f", "v"].includes(normalized)) return "fv";
  if (["b", "m", "p"].includes(normalized)) return "mbp";
  if (normalized === "l") return "l";
  if (normalized === "r") return "r";
  if (["w", "q", "wh", "qu"].includes(normalized)) return "wq";
  if (["a", "aa"].includes(normalized)) return "aa";
  if (["e", "ee"].includes(normalized)) return "ee";
  if (["i", "y", "ih"].includes(normalized)) return "ih";
  if (["o", "oh"].includes(normalized)) return "oh";
  if (["u", "ou", "oo"].includes(normalized)) return "ou";
  if (/[ae]/.test(normalized)) return "aa";
  if (/[iy]/.test(normalized)) return "ih";
  if (/[ou]/.test(normalized)) return "oh";
  if (/[fv]/.test(normalized)) return "fv";
  if (/[bmp]/.test(normalized)) return "mbp";
  if (/[rl]/.test(normalized)) return normalized.includes("l") ? "l" : "r";
  if (/[wq]/.test(normalized)) return "wq";
  return "rest";
}

function buildVisemeTimeline(alignment: ElevenLabsAlignment | null | undefined): VisemeCue[] {
  if (!alignment) return [];

  const chars = alignment.characters || alignment.chars || [];
  if (!Array.isArray(chars) || chars.length === 0) return [];

  const startsSeconds = alignment.character_start_times_seconds;
  const startsMs = alignment.char_start_times_ms;
  const hasSecondTimings = Array.isArray(startsSeconds) && startsSeconds.length === chars.length;
  const starts = hasSecondTimings
    ? startsSeconds
    : Array.isArray(startsMs) && startsMs.length === chars.length
      ? startsMs
      : [];

  if (starts.length !== chars.length) return [];

  const durations = Array.isArray(alignment.char_durations_ms) && alignment.char_durations_ms.length === chars.length
    ? alignment.char_durations_ms
    : [];
  const endsSeconds = Array.isArray(alignment.character_end_times_seconds) && alignment.character_end_times_seconds.length === chars.length
    ? alignment.character_end_times_seconds
    : [];

  const digraphs = new Set(["th", "sh", "ch", "zh", "ph", "wh", "qu", "oo", "ee", "aa"]);
  const timeline: VisemeCue[] = [];
  let index = 0;

  while (index < chars.length) {
    const current = String(chars[index] || "");
    const next = String(chars[index + 1] || "");
    const pair = `${current}${next}`.toLowerCase();
    const useDigraph = digraphs.has(pair);

    const startMs = toMilliseconds(starts[index], hasSecondTimings);
    let endMs = startMs + 70;

    if (durations.length > 0) {
      const durationMs = useDigraph
        ? (durations[index] || 0) + (durations[index + 1] || 0)
        : (durations[index] || 0);
      endMs = startMs + Math.max(35, durationMs);
    } else if (endsSeconds.length > 0) {
      const end = useDigraph ? endsSeconds[index + 1] : endsSeconds[index];
      endMs = Math.max(startMs + 30, toMilliseconds(end, true));
    } else {
      const nextStart = starts[Math.min(starts.length - 1, index + (useDigraph ? 2 : 1))];
      if (Number.isFinite(nextStart)) {
        endMs = Math.max(startMs + 30, toMilliseconds(nextStart, hasSecondTimings));
      }
    }

    timeline.push({
      startMs,
      endMs,
      viseme: mapTokenToViseme(useDigraph ? pair : current),
    });

    index += useDigraph ? 2 : 1;
  }

  return timeline;
}

async function parseTtsResponse(response: Response): Promise<ParsedTtsPayload> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const audioBase64: string | undefined = payload?.audioBase64 || payload?.audio_base64;
    if (!audioBase64) {
      throw new Error("TTS response did not include audio payload");
    }

    const blob = decodeBase64Audio(audioBase64);
    return {
      audioUrl: URL.createObjectURL(blob),
      visemeTimeline: buildVisemeTimeline(payload?.alignment || payload?.normalizedAlignment || payload?.normalized_alignment),
    };
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    visemeTimeline: [],
  };
}

function buildFlipChartLines(
  parts: { hook: string; body: string[]; takeaway: string; challenge: string },
  maxLines: number
) {
  const availableLines = Math.max(4, maxLines - 2);
  const lines: Array<{ text: string; tone: "lead" | "body" | "takeaway" | "challenge" }> = [];

  const pushSentences = (text: string, tone: "lead" | "body" | "takeaway" | "challenge") => {
    if (!text || lines.length >= availableLines) return;
    const normalized = stripNarratorMarkdown(text);
    const sentences = normalized.match(/[^.!?]+[.!?]+[\])"'`]*|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [normalized];

    for (const sentence of sentences) {
      if (lines.length >= availableLines) break;
      lines.push({
        text: sentence.replace(/^Key takeaway:\s*/i, "").replace(/^Challenge:\s*/i, "").trim(),
        tone,
      });
    }
  };

  pushSentences(parts.hook, "lead");
  parts.body.forEach((paragraph) => pushSentences(paragraph, "body"));

  if (parts.takeaway && lines.length < availableLines) {
    pushSentences(`Key takeaway: ${parts.takeaway}`, "takeaway");
  }

  if (parts.challenge && lines.length < availableLines) {
    pushSentences(`Challenge: ${parts.challenge}`, "challenge");
  }

  return lines.slice(0, availableLines);
}

type SlideType = "title" | "content" | "assessment" | "summary" | "video" | "narrative-flipbook";

interface Slide {
  type: SlideType;
  moduleIndex: number;
  moduleTitle: string;
  topicIndex?: number;
  topicTitle?: string;
  topicPartIndex?: number;
  topicPartCount?: number;
  content?: string;
  infographicSvg?: string;
  visualImageDataUrl?: string;
  visualSvg?: string;
  visualPlacement?: "hero" | "side-panel" | "inline-card";
  visualAltText?: string;
  visualPrompt?: string;
  visualApproved?: boolean;
  wasTrimmedForLayout?: boolean;
  contentTemplate?: ContentTemplate;
  question?: { question: string; options: string[]; correct_answer: string; rationale?: string };
  takeaways?: string[];
  video?: InsertedVideo;
}

function getDurationMinutes(duration?: string): number {
  const parsed = Number.parseInt(duration || "15", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function splitParagraphIntoSentenceChunks(paragraph: string, targetWordsPerChunk: number): string[] {
  const normalized = paragraph.trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]+[\])"'`]*|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [normalized];
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (currentChunk.length > 0 && currentWordCount + sentenceWordCount > targetWordsPerChunk) {
      chunks.push(currentChunk.join(" ").trim());
      currentChunk = [sentence];
      currentWordCount = sentenceWordCount;
    } else {
      currentChunk.push(sentence);
      currentWordCount += sentenceWordCount;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" ").trim());
  }

  return chunks;
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ").trim()}...`;
}

function isTruncatedByWordLimit(text: string, maxWords: number): boolean {
  return text.split(/\s+/).filter(Boolean).length > maxWords;
}

type SlideContentChunk = {
  text: string;
  wasTrimmed: boolean;
};

function splitTopicContentIntoSlides(text: string, durationMinutes: number, maxLines = 10): SlideContentChunk[] {
  const lines = text
    .split("\n")
    .filter((line) => !line.match(/^#{1,3}\s/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.match(/^[-*#]+$/));
  const paragraphs = lines.join("\n").trim().split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    const fallback = text.trim();
    return fallback
      ? [{ text: truncateToWordLimit(fallback, Math.max(36, maxLines * 9)), wasTrimmed: isTruncatedByWordLimit(fallback, Math.max(36, maxLines * 9)) }]
      : [];
  }

  // Cap chunks-per-topic by duration so a 3-min course doesn't blow up to 12+ slides.
  // For very short courses (<=3 min), allow up to 2 chunks to avoid excessive truncation
  const maxChunksPerTopic = durationMinutes <= 2 ? 2
    : durationMinutes <= 3 ? 2
    : durationMinutes <= 5 ? 2
    : durationMinutes <= 10 ? 3
    : durationMinutes <= 20 ? 4
    : durationMinutes <= 45 ? 5
    : 6;

  const targetWordsByDuration = durationMinutes <= 5 ? 70 : durationMinutes <= 10 ? 85 : durationMinutes <= 20 ? 100 : 115;
  const approxWordsPerLine = 9;
  const lineBudgetWordLimit = Math.max(36, maxLines * approxWordsPerLine);
  const targetWordsPerSlide = Math.min(targetWordsByDuration, lineBudgetWordLimit);
  const chunks: SlideContentChunk[] = [];
  let currentParagraphs: string[] = [];
  let currentWordCount = 0;

  const flushChunk = () => {
    if (currentParagraphs.length === 0) return;
    const combined = currentParagraphs.join("\n\n").trim();
    chunks.push({
      text: truncateToWordLimit(combined, lineBudgetWordLimit),
      wasTrimmed: isTruncatedByWordLimit(combined, lineBudgetWordLimit),
    });
    currentParagraphs = [];
    currentWordCount = 0;
  };

  paragraphs.forEach((paragraph) => {
    const paragraphWordCount = paragraph.split(/\s+/).filter(Boolean).length;

    if (paragraphWordCount > targetWordsPerSlide * 1.35) {
      flushChunk();
      splitParagraphIntoSentenceChunks(paragraph, targetWordsPerSlide).forEach((sentenceChunk) => {
        if (sentenceChunk) {
          chunks.push({
            text: truncateToWordLimit(sentenceChunk, lineBudgetWordLimit),
            wasTrimmed: isTruncatedByWordLimit(sentenceChunk, lineBudgetWordLimit),
          });
        }
      });
      return;
    }

    if (currentParagraphs.length > 0 && currentWordCount + paragraphWordCount > targetWordsPerSlide) {
      flushChunk();
    }

    currentParagraphs.push(paragraph);
    currentWordCount += paragraphWordCount;
  });

  flushChunk();

  // Enforce per-topic chunk cap: if we exceeded the cap, merge the trailing
  // chunks into the last allowed slide (truncated to fit) rather than spawning
  // extra slides that overshoot the course's target duration.
  if (chunks.length > maxChunksPerTopic) {
    const kept = chunks.slice(0, maxChunksPerTopic - 1);
    const overflow = chunks.slice(maxChunksPerTopic - 1).map((c) => c.text).join(" ");
    kept.push({
      text: truncateToWordLimit(overflow, lineBudgetWordLimit),
      wasTrimmed: true,
    });
    return kept;
  }

  if (chunks.length > 0) return chunks;

  const fallback = text.trim();
  return fallback
    ? [{
        text: truncateToWordLimit(fallback, lineBudgetWordLimit),
        wasTrimmed: isTruncatedByWordLimit(fallback, lineBudgetWordLimit),
      }]
    : [];
}

function getTopicVisual(moduleVisual: any, topicTitle: string) {
  const topicVisuals = Array.isArray(moduleVisual?.topic_visuals) ? moduleVisual.topic_visuals : [];
  return topicVisuals.find((visual: any) => {
    const candidateTitle = visual?.topic_title || visual?.title || visual?.name || "";
    return candidateTitle && normalizeModuleKey(candidateTitle) === normalizeModuleKey(topicTitle);
  });
}

/* Parse writer content into structured parts */
function parseContentParts(text: string) {
  const lines = text
    .split("\n")
    .filter((line) => !line.match(/^#{1,3}\s/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isPlaceholderToken(line));
  const joined = lines.join("\n").trim();
  const paragraphs = joined
    .split(/\n\n+/)
    .map((paragraph) => safeLearnerText(paragraph))
    .filter(Boolean);

  let hook = "";
  let body: string[] = [];
  let takeaway = "";
  let challenge = "";

  paragraphs.forEach((p, i) => {
    if (i === 0) {
      hook = safeLearnerText(p);
    } else if (p.match(/^(Key Takeaway|Takeaway|Remember|Tip)/i)) {
      takeaway = safeLearnerText(p.replace(/^(Key Takeaway:|Takeaway:|Remember:|Tip:\s*)/i, "").trim());
    } else if (p.match(/^(Challenge:|Next time|Try this:)/i) || (i === paragraphs.length - 1 && p.length < 120)) {
      challenge = safeLearnerText(p.replace(/^(Challenge:\s*)/i, "").trim());
    } else {
      const cleaned = safeLearnerText(p);
      if (cleaned) body.push(cleaned);
    }
  });

  // If no takeaway found, check last body paragraph
  if (!takeaway && body.length > 1) {
    const last = body[body.length - 1];
    if (last.length < 100) {
      takeaway = safeLearnerText(last);
      body = body.slice(0, -1);
    }
  }

  // Final fallback: derive a one-sentence takeaway from any available prose so the
  // Key Takeaway panel doesn't render the "Content not available" filler.
  if (!takeaway) {
    const source = [...body, hook].find((value) => value && !isPlaceholderToken(value));
    const lastSentence = source ? source.match(/[^.!?]+[.!?]+/g)?.slice(-1)[0]?.trim() : "";
    if (lastSentence && !isPlaceholderToken(lastSentence)) takeaway = safeLearnerText(lastSentence);
  }

  return { hook, body, takeaway, challenge };
}

type ContentTemplate = "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel";
type AssessmentIntensity = "light" | "standard" | "deep";

function inferContentTemplate(slide: Slide, hasVisual: boolean): ContentTemplate {
  if (
    slide.contentTemplate === "dashboard" ||
    slide.contentTemplate === "guided-notes" ||
    slide.contentTemplate === "scenario" ||
    slide.contentTemplate === "media-quiz" ||
    slide.contentTemplate === "summary-panel"
  ) {
    return slide.contentTemplate;
  }
  const isModuleOpener = (slide.topicIndex || 0) === 0 && (slide.topicPartIndex || 0) === 0;
  if ((slide.topicPartCount || 1) > 1 && (slide.topicPartIndex || 0) === (slide.topicPartCount || 1) - 1) return "summary-panel";
  if (isModuleOpener || hasVisual) return "dashboard";
  return "guided-notes";
}

function getTopicLearningObjectives(moduleTopics: string[], topicTitle?: string): string[] {
  const seeded = topicTitle ? [topicTitle, ...moduleTopics.filter((topic) => topic !== topicTitle)] : moduleTopics;
  return Array.from(new Set(seeded.filter(Boolean))).slice(0, 3);
}

function getQuickFact(parts: { hook: string; body: string[]; takeaway: string; challenge: string }): string {
  if (parts.takeaway && !isPlaceholderToken(parts.takeaway)) return parts.takeaway;
  const source = [parts.challenge, parts.hook, ...parts.body].find((value) => value && !isPlaceholderToken(value));
  if (!source) return "";
  const sentence = stripNarratorMarkdown(source).match(/[^.!?]+[.!?]+|[^.!?]+$/)?.[0]?.trim();
  return sentence && !isPlaceholderToken(sentence) ? sentence : "";
}

function getTargetCourseQuestionCount(durationMinutes: number, intensity: AssessmentIntensity): number {
  const base = durationMinutes <= 5
    ? 3
    : durationMinutes <= 10
      ? 5
      : durationMinutes <= 15
        ? 7
        : durationMinutes <= 20
          ? 9
          : durationMinutes <= 30
            ? 12
            : durationMinutes <= 45
              ? 16
              : 20;

  const multiplier: Record<AssessmentIntensity, number> = {
    light: 0.75,
    standard: 1,
    deep: 1.25,
  };

  return Math.max(2, Math.round(base * multiplier[intensity]));
}

function allocateQuestionsPerModule(modules: Module[], totalQuestions: number): number[] {
  if (modules.length === 0 || totalQuestions <= 0) return [];

  const weights = modules.map((module) => Math.max(1, module.topics.length || 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || modules.length;
  const counts = new Array(modules.length).fill(0);

  let remaining = totalQuestions;
  if (totalQuestions >= modules.length) {
    for (let i = 0; i < modules.length; i++) counts[i] = 1;
    remaining -= modules.length;
  }

  const fractional: Array<{ index: number; fraction: number }> = [];
  for (let i = 0; i < modules.length; i++) {
    if (remaining <= 0) {
      fractional.push({ index: i, fraction: 0 });
      continue;
    }
    const raw = (weights[i] / totalWeight) * remaining;
    const whole = Math.floor(raw);
    counts[i] += whole;
    fractional.push({ index: i, fraction: raw - whole });
  }

  let assigned = counts.reduce((sum, value) => sum + value, 0);
  let leftovers = totalQuestions - assigned;
  fractional.sort((a, b) => b.fraction - a.fraction);

  let pointer = 0;
  while (leftovers > 0 && fractional.length > 0) {
    counts[fractional[pointer % fractional.length].index] += 1;
    leftovers -= 1;
    pointer += 1;
  }

  return counts;
}

function findModuleMatchedQuestionIndexes(mcqs: any[], module: Module): number[] {
  const normalizedTitle = normalizeModuleKey(module.title);
  const normalizedTopics = new Set(module.topics.map((topic) => normalizeModuleKey(topic)));

  return mcqs
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      const questionModuleTitle = question?.module_title || question?.module || question?.moduleTitle || "";
      const questionTopicTitle = question?.topic_title || question?.topic || question?.topicTitle || "";
      const moduleMatch = questionModuleTitle && normalizeModuleKey(questionModuleTitle) === normalizedTitle;
      const topicMatch = questionTopicTitle && normalizedTopics.has(normalizeModuleKey(questionTopicTitle));
      return Boolean(moduleMatch || topicMatch);
    })
    .map(({ index }) => index);
}

/* build slides from agent outputs */
function buildSlides(rawOutputs: RawAgentOutputs, insertedVideos: InsertedVideo[] = [], courseDuration?: string, maxLines = 10, assessmentIntensity: AssessmentIntensity = "standard"): { modules: Module[]; slides: Slide[] } {
  const archData = tryParseJSON(rawOutputs.architect);
  const writerText = rawOutputs.writer || "";
  const assessData = tryParseJSON(rawOutputs.assessment);
  const visualData = tryParseJSON(rawOutputs.visual);
  const narrativeScenesData = tryParseJSON(rawOutputs.narrativeScenes);
  const durationMinutes = getDurationMinutes(courseDuration);

  // Extract modules
  let modules: Module[] = [];
  if (archData) {
    const mods = archData.modules || archData.course_structure?.modules || archData.course_modules || [];
    modules = mods.map((m: any, mi: number) => ({
      title: m.module_title || m.title || m.name || `Module ${mi + 1}`,
      topics: (m.topics || m.sections || m.lessons || []).map((t: any, ti: number) =>
        typeof t === "string" ? t : t.topic_name || t.topic_title || t.title || t.name || `Module ${mi + 1} - Part ${ti + 1}`
      ),
    }));
  }

  if (modules.length === 0) {
    modules = [{ title: "Module 1", topics: ["Introduction"] }];
  }

  // Extract MCQs
  const mcqs = Array.isArray(assessData?.mcq) ? assessData.mcq : [];
  const maxQuestionCount = Math.min(mcqs.length, getTargetCourseQuestionCount(durationMinutes, assessmentIntensity));
  const questionsPerModule = allocateQuestionsPerModule(modules, maxQuestionCount);
  const usedQuestionIndexes = new Set<number>();

  // Extract infographic descriptions from visual agent
  const visualModules = visualData?.modules || visualData?.course_visual_plan?.modules || visualData?.module_visuals || [];

  // Build slides
  const slides: Slide[] = [];

  // Build a robust writer index (matches scormExport parser): supports JSON
  // writer output, multi-level markdown headings (##/###/####), and skips
  // module-level headings from the positional fallback so topic content aligns.
  const writerSections: Record<string, string> = {};
  const orderedTopicBodies: string[] = [];
  const moduleTitleKeys = new Set(modules.map((m) => normalizeModuleKey(m.title)));
  const isModuleLikeHeading = (h: string) =>
    moduleTitleKeys.has(normalizeModuleKey(h)) || /^module\s*\d+\b/i.test(h.trim());
  const cleanBody = (s: string) => {
    const c = (s || "").replace(/\r\n/g, "\n").replace(/^---+\s*$/gm, "").trim();
    return c && !isPlaceholderToken(c) ? c : "";
  };
  const extractObjBody = (v: any): string => {
    if (!v || typeof v !== "object") return "";
    const keys = ["content", "body", "text", "narrative", "narration", "script", "lesson_content", "on_screen_text", "screen_text", "description", "explanation"];
    for (const k of keys) {
      const val = v[k];
      if (typeof val === "string") { const c = cleanBody(val); if (c) return c; }
      if (Array.isArray(val)) {
        const joined = val.map((it) => typeof it === "string" ? it : extractObjBody(it)).filter(Boolean).join("\n\n");
        const c = cleanBody(joined); if (c) return c;
      }
    }
    return "";
  };
  const pushSection = (heading: string, body: string) => {
    const h = (heading || "").trim();
    const b = cleanBody(body);
    if (!h || !b) return;
    const key = h.toLowerCase();
    if (!writerSections[key]) writerSections[key] = b;
    if (!isModuleLikeHeading(h)) orderedTopicBodies.push(b);
  };
  const writerJson = tryParseJSON(writerText);
  if (writerJson) {
    const topLevel = writerJson.sections || writerJson.lessons || writerJson.slides || writerJson.topics;
    if (Array.isArray(topLevel)) {
      topLevel.forEach((s: any, i: number) =>
        pushSection(String(s?.topic_title || s?.title || s?.heading || s?.name || `Section ${i + 1}`), extractObjBody(s))
      );
    }
    const mods = writerJson.modules || writerJson.course_structure?.modules || writerJson.course_modules;
    if (Array.isArray(mods)) {
      mods.forEach((m: any, mi: number) => {
        pushSection(String(m?.module_title || m?.title || m?.name || `Module ${mi + 1}`), extractObjBody(m));
        const children = m?.topics || m?.sections || m?.lessons || m?.slides || m?.content;
        if (Array.isArray(children)) {
          children.forEach((t: any, ti: number) =>
            pushSection(String(t?.topic_name || t?.topic_title || t?.title || t?.heading || t?.name || `Topic ${ti + 1}`), extractObjBody(t))
          );
        }
      });
    }
  }
  const normalizedWriter = (writerText || "").replace(/\r\n/g, "\n");
  const headingMatches = Array.from(normalizedWriter.matchAll(/^(#{2,4})\s+(.+?)\s*$/gm));
  headingMatches.forEach((hm, i) => {
    const start = (hm.index || 0) + hm[0].length;
    const end = i + 1 < headingMatches.length ? (headingMatches[i + 1].index || normalizedWriter.length) : normalizedWriter.length;
    pushSection(stripNarratorMarkdown(hm[2]).trim(), normalizedWriter.slice(start, end));
  });

  let topicCounter = 0;

  modules.forEach((mod, mi) => {
    const matchedVisualModule = visualModules.find((vm: any) => {
      const moduleTitle = vm?.module_title || vm?.title || vm?.name || "";
      return moduleTitle && normalizeModuleKey(moduleTitle) === normalizeModuleKey(mod.title);
    }) || visualModules[mi];
    const infographicDescription = getInfographicDescription(matchedVisualModule, mod);

    // 1. Title slide - only for the first module (course opening)
    if (mi === 0) {
      slides.push({ type: "title", moduleIndex: mi, moduleTitle: mod.title });
    }

    // 2. Content slides - one per topic
    mod.topics.forEach((topic, ti) => {
      const topicKey = topic.toLowerCase();
      let sectionText = writerSections[topicKey] || "";
      if (!sectionText) {
        // Fuzzy contains match on stored headings
        for (const [k, v] of Object.entries(writerSections)) {
          if (k.length > 4 && (k.includes(topicKey) || topicKey.includes(k))) { sectionText = v; break; }
        }
      }
      if (!sectionText) sectionText = orderedTopicBodies[topicCounter] || "";
      if (!sectionText) sectionText = "";

      // For image-based learning, use narrative scenes; otherwise use visual design plan
      let narrativeForTopic = null;
      if (narrativeScenesData) {
        const narratives = Array.isArray(narrativeScenesData) ? narrativeScenesData : [narrativeScenesData];
        const normalizedTopic = normalizeModuleKey(topic);

        // First try exact match on normalized titles
        narrativeForTopic = narratives.find((n: any) =>
          normalizeModuleKey(n.topicTitle || "") === normalizedTopic
        );

        // If no exact match, fall back to the global topic order. Using the
        // per-module topic index here reused narrative[0] for the first topic
        // of every module, which made the same generated image/story repeat.
        if (!narrativeForTopic && topicCounter < narratives.length) {
          const fallback = narratives[topicCounter];
          if (fallback && Array.isArray(fallback.scenes) && fallback.scenes.length > 0) {
            narrativeForTopic = fallback;
          }
        }
      }

      // If narrative scenes exist, create a flipbook slide (image-based learning flow)
      if (narrativeForTopic && Array.isArray(narrativeForTopic.scenes) && narrativeForTopic.scenes.length > 0) {
        slides.push({
          type: "narrative-flipbook",
          moduleIndex: mi,
          moduleTitle: mod.title,
          topicIndex: ti,
          topicTitle: topic,
          narrative: narrativeForTopic,
          infographicSvg: ti === 0 ? infographicDescription : undefined,
        } as any);
      } else {
        // Fallback to content chunks for non-image-based or when no narrative scenes
        const contentChunks = splitTopicContentIntoSlides(sectionText, durationMinutes, maxLines);
        const topicVisual = getTopicVisual(matchedVisualModule, topic);
        const generatedImageDataUrl = typeof topicVisual?.generated_image_data_url === "string" && topicVisual.generated_image_data_url.trim().length > 0
          ? topicVisual.generated_image_data_url
          : undefined;
        const generatedSceneSvg = typeof topicVisual?.generated_scene_svg === "string" && topicVisual.generated_scene_svg.trim().length > 0
          ? normalizeSvg(topicVisual.generated_scene_svg)
          : undefined;
        const screenTemplate = topicVisual?.screen_template === "dashboard" || topicVisual?.screen_template === "guided-notes" || topicVisual?.screen_template === "scenario" || topicVisual?.screen_template === "media-quiz" || topicVisual?.screen_template === "summary-panel"
          ? topicVisual.screen_template
          : undefined;

        contentChunks.forEach((chunk, chunkIndex) => {
          slides.push({
            type: "content",
            moduleIndex: mi,
            moduleTitle: mod.title,
            topicIndex: ti,
            topicTitle: topic,
            topicPartIndex: chunkIndex,
            topicPartCount: contentChunks.length,
            content: chunk.text,
            wasTrimmedForLayout: chunk.wasTrimmed,
            infographicSvg: ti === 0 && chunkIndex === 0 ? infographicDescription : undefined,
            visualImageDataUrl: chunkIndex === 0 ? generatedImageDataUrl : undefined,
            visualSvg: chunkIndex === 0 ? generatedSceneSvg : undefined,
            visualPlacement: chunkIndex === 0 ? topicVisual?.placement : undefined,
            visualAltText: chunkIndex === 0 ? topicVisual?.alt_text : undefined,
            visualPrompt: chunkIndex === 0 ? topicVisual?.image_prompt : undefined,
            visualApproved: chunkIndex === 0 ? Boolean(topicVisual?.image_approved) : undefined,
            contentTemplate: chunkIndex === 0 ? screenTemplate : "guided-notes",
          });
        });
      }
      topicCounter++;
    });

    // 3. Assessment slides (proportional to module size and duration)
    const desiredQuestionCount = questionsPerModule[mi] || 0;
    if (desiredQuestionCount > 0) {
      const moduleMatchedIndexes = findModuleMatchedQuestionIndexes(mcqs, mod).filter((questionIndex) => !usedQuestionIndexes.has(questionIndex));
      const selectedIndexes: number[] = [];

      for (const questionIndex of moduleMatchedIndexes) {
        if (selectedIndexes.length >= desiredQuestionCount) break;
        selectedIndexes.push(questionIndex);
        usedQuestionIndexes.add(questionIndex);
      }

      if (selectedIndexes.length < desiredQuestionCount) {
        for (let questionIndex = 0; questionIndex < mcqs.length; questionIndex++) {
          if (selectedIndexes.length >= desiredQuestionCount) break;
          if (usedQuestionIndexes.has(questionIndex)) continue;
          selectedIndexes.push(questionIndex);
          usedQuestionIndexes.add(questionIndex);
        }
      }

      selectedIndexes.forEach((questionIndex) => {
        const mcq = mcqs[questionIndex];
        if (!mcq) return;
        // Determine template: scenario-based questions get "scenario", others get default
        const isScenario = mcq.situation || mcq.scenario || mcq.context;
        slides.push({
          type: "assessment",
          moduleIndex: mi,
          moduleTitle: mod.title,
          question: mcq,
          contentTemplate: isScenario ? "scenario" : undefined,
        });
      });
    }

    // 3b. Insert video slides for this module (exact match module titles).
    // Videos with no assigned module are NOT automatically placed - they appear in a separate "unassigned" list.
    const modVideos = insertedVideos.filter(v => {
      const assigned = (v.moduleTitle || "").trim();
      if (!assigned) return false; // Don't auto-assign unassigned videos
      // Exact match on normalized titles
      return normalizeModuleKey(assigned) === normalizeModuleKey(mod.title);
    });
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

/* Confetti animation */
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

/* Infographic Visual Aid (on-demand SVG generation) */
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

function normalizeSvg(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const hasPreserveAspectRatio = /preserveAspectRatio=/i.test(attrs);
    const cleanedAttrs = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");

    return `<svg${cleanedAttrs} width="100%" height="100%" style="display:block;width:100%;height:100%;"${hasPreserveAspectRatio ? "" : ' preserveAspectRatio="xMidYMid meet"'}>`;
  });
}

const INFOGRAPHIC_SYSTEM_PROMPT = "You are an elite SVG infographic designer for polished corporate eLearning. Generate a sophisticated, presentation-quality SVG infographic that uses the full canvas confidently, with strong visual hierarchy, large readable headings, 3-5 clearly separated content zones, connectors, icons built only from SVG primitives, and disciplined whitespace. Avoid giant empty margins, tiny text, clip-art aesthetics, or toy layouts. The SVG must be self-contained, 1200x800, with no external fonts or images. Use only these colors: #0f172a, #123d78, #355fa8, #4f46e5, #7c3aed, #10b981, #f59e0b, #e8eef9, #f8fafc, #ffffff. Make it feel like a premium consulting slide, not a simple classroom handout. Return only SVG markup.";

const InfographicVisualAid: React.FC<{ description: string; moduleTitle: string }> = ({ description, moduleTitle }) => {
  const [expanded, setExpanded] = useState(false);
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showZoomed, setShowZoomed] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.45);

  const generateSvg = useCallback(async () => {
    if (svg || loading) return;
    setLoading(true);
    setError(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error: fnErr } = await supabase.functions.invoke("claude", {
        body: {
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT,
          userMessage: `Create an infographic for module: "${moduleTitle}". Visual description: ${description}. Requirements: fill the canvas with a confident layout, use large readable labels, keep copy concise, and make the output feel like a polished modern eLearning visual aid that can still be read clearly when expanded in a learner preview.`,
        },
      });
      if (fnErr || data?.error) {
        setError(true);
      } else {
        const result = normalizeSvg(extractSVG(data.text || ""));
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

  const explainImage = useCallback(async () => {
    if (explaining) return;
    if (explanation) {
      setExplanation("");
      return;
    }

    setExplaining(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error: fnErr } = await supabase.functions.invoke("claude", {
        body: {
          systemPrompt: "You explain infographics for workplace learners. Be concise, practical, and easy to scan. Return plain text with 3 short bullet-style lines: what the image shows, how to read it, and why it matters.",
          userMessage: `Module: ${moduleTitle}\nInfographic description: ${description}`,
        },
      });

      if (fnErr || data?.error) {
        setExplanation(`What this image shows: ${description}\nHow to read it: follow the visual flow from left to right and connect each block to the learning journey.\nWhy it matters: it gives the learner a quick mental map before they go deeper into the topic.`);
      } else {
        setExplanation((data.text || "").trim() || `What this image shows: ${description}`);
      }
    } catch {
      setExplanation(`What this image shows: ${description}\nHow to read it: follow the visual flow from left to right and connect each block to the learning journey.\nWhy it matters: it gives the learner a quick mental map before they go deeper into the topic.`);
    } finally {
      setExplaining(false);
    }
  }, [description, explanation, explaining, moduleTitle]);

  const updateZoomLevel = (nextZoom: number) => {
    setZoomLevel(Math.max(1, Math.min(2.4, Number(nextZoom.toFixed(2)))));
  };

  return (
    <div className="mb-6 overflow-hidden rounded-[26px] border border-white/10 bg-slate-900 text-white shadow-[0_24px_54px_rgba(15,23,42,0.26)] anim-scale-in" style={{ animationDelay: "0.16s" }}>
      <button
        onClick={handleToggle}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
        type="button"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[18px] text-white shadow-inner shadow-white/10">
          AI
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f59e0b]/18 px-2.5 py-1 text-[10px] font-[900] uppercase tracking-[0.18em] text-[#ffd27a]">
              Visual Aid
            </span>
            <span className="text-[10px] font-[800] uppercase tracking-[0.16em] text-slate-300/80">
              Premium infographic view
            </span>
          </div>
          <p className="text-[15px] font-[900] tracking-tight text-white">Module Infographic</p>
          <p className="mt-1 text-[12px] font-medium text-slate-300">
            {expanded ? "Collapse this visual panel" : "Open the module-level infographic and inspect it properly"}
          </p>
        </div>
        <div className="mt-1 shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-slate-200">
          {expanded ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4" style={{ minHeight: 240, animation: "infographicExpandIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-[900] uppercase tracking-[0.18em] text-slate-300/75">Generated visual summary</p>
              <p className="mt-1 text-[13px] text-slate-300">Built from the module structure and meant to give the learner a fast mental model before the deeper content.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={explainImage}
                disabled={explaining}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#355fa8]/60 bg-[#123d78]/30 px-4 text-[12px] font-[800] text-[#cfe0ff] transition-all hover:bg-[#123d78]/45 disabled:opacity-60"
                type="button"
              >
                {explaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {explanation ? "Hide explanation" : "Explain the image"}
              </button>
              <button
                onClick={() => {
                  updateZoomLevel(1.45);
                  setShowZoomed(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white px-4 text-[12px] font-[900] text-[#123d78] transition-all hover:bg-slate-100"
                type="button"
              >
                <ZoomIn className="h-3.5 w-3.5" /> Open focus view
              </button>
            </div>
          </div>

          {explanation && (
            <div className="mb-4 whitespace-pre-line rounded-[20px] border border-[#355fa8]/45 bg-[#123d78]/26 p-4 text-[12px] leading-relaxed text-slate-100"
              style={{ animation: "infographicExpandIn 260ms ease both" }}>
              {explanation}
            </div>
          )}

          {loading ? (
            <div className="flex h-[300px] items-center justify-center rounded-[24px] border border-white/10 bg-white/5">
              <Loader2 className="h-6 w-6 animate-spin text-[#8db8ff]" />
              <span className="ml-2 text-[13px] text-slate-300">Generating infographic...</span>
            </div>
          ) : svg ? (
            <div className="rounded-[26px] border border-white/10 bg-slate-50 p-4 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#4b6592]">{moduleTitle}</p>
                  <p className="text-[13px] font-semibold text-[#27446f]">Designed to be read as a compact visual brief</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-[800] text-[#355fa8] shadow-sm">
                  Click focus view for zoom controls
                </div>
              </div>
              <div className="overflow-hidden rounded-[18px] border border-[#d8deea] bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
                <div
                  className="mx-auto aspect-[3/2] w-full max-w-[860px] [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          ) : error ? (
            <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-[24px] border border-red-400/30 bg-red-500/10">
              <p className="text-[13px] text-red-200">Failed to generate infographic</p>
              <button onClick={generateSvg} className="text-[12px] font-semibold text-[#cfe0ff] hover:underline" type="button">
                Retry
              </button>
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-300">{description}</p>
          )}
        </div>
      )}

      {showZoomed && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center" onClick={() => setShowZoomed(false)}>
          <div className="absolute inset-0 bg-[#020617]/84 backdrop-blur-md" />
          <div className="relative flex h-[min(92vh,980px)] w-[min(1380px,96vw)] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#e5edf7] p-5 shadow-[0_36px_120px_rgba(2,6,23,0.58)]"
            style={{ animation: "infographicZoomIn 240ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
            onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#4b6592]">Focus View</p>
                <p className="text-[20px] font-[900] tracking-tight text-[#123d78]">{moduleTitle} infographic</p>
                <p className="text-[13px] text-[#4b6592]">This is the actual enlarge state. It now supports real zoom instead of just reopening the same cramped frame.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => updateZoomLevel(zoomLevel - 0.2)}
                  className="inline-flex h-10 items-center rounded-full border border-[#c5d3e6] bg-white px-4 text-[12px] font-[900] text-[#123d78] transition-all hover:bg-slate-50"
                  type="button"
                >
                  Zoom out
                </button>
                <button
                  onClick={() => updateZoomLevel(1.45)}
                  className="inline-flex h-10 items-center rounded-full border border-[#c5d3e6] bg-white px-4 text-[12px] font-[900] text-[#123d78] transition-all hover:bg-slate-50"
                  type="button"
                >
                  Reset
                </button>
                <button
                  onClick={() => updateZoomLevel(zoomLevel + 0.2)}
                  className="inline-flex h-10 items-center rounded-full border border-[#355fa8] bg-[#123d78] px-4 text-[12px] font-[900] text-white transition-all hover:bg-[#0f3567]"
                  type="button"
                >
                  Zoom in
                </button>
                <div className="rounded-full bg-white/85 px-4 py-2 text-[12px] font-[900] text-[#355fa8] shadow-sm">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={() => setShowZoomed(false)}
                  className="inline-flex h-10 items-center rounded-full border border-[#c5d3e6] bg-white px-4 text-[12px] font-[900] text-[#123d78] transition-all hover:bg-slate-50"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-[28px] border border-[#c6d2e3] bg-[#f3f7fb] p-5">
              {svg ? (
                <div className="mx-auto min-w-fit">
                  <div className="rounded-[26px] border border-[#d8deea] bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
                    <div
                      className="aspect-[3/2] [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-none"
                      style={{ width: `${Math.round(900 * zoomLevel)}px` }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-[13px] text-muted-foreground">
                  Generate the infographic first, then enlarge it here.
                </div>
              )}
            </div>
          </div>
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
  learnerNotesEnabled?: boolean;
  resourcesPanelEnabled?: boolean;
  glossaryEnabled?: boolean;
  discussionEnabled?: boolean;
  assessmentIntensity?: AssessmentIntensity;
  avatarTrainerId?: string;
  flipStylePreference?: FlipStyle;
  slideLayout?: {
    maxLines: number;
    minFontSize: number;
    lineSpacing: number;
  };
  /** On-screen / body text language selected in the course parameters dialog. */
  textLanguage?: string;
  /** Narration/voice language selected in the course parameters dialog. */
  narratorLanguage?: string;
  onUpdateVisualTopic?: (moduleTitle: string, topicTitle: string, updates: Record<string, unknown>) => void;
  captionsEnabled?: boolean;
}

const PREVIEW_FLIP_STYLE_STORAGE_KEY = "contentforge.preview.flipStyle.default";
const PREVIEW_NOTES_STORAGE_KEY_PREFIX = "contentforge.preview.notes";

type SidebarPanel = "home" | "progress" | "objectives" | "notes" | "resources";
type UtilityPanel = "discussion" | "glossary" | "settings" | null;
type LearningToolPanel = "quiz" | "fact" | "takeaway" | "objectives" | null;

function isFlipStyle(value: string | null): value is FlipStyle {
  return value === "dramatic" || value === "subtle" || value === "bound";
}

function getCourseFlipStyleStorageKey(courseTitle: string): string {
  const normalizedTitle = courseTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `contentforge.preview.flipStyle.${normalizedTitle || "default"}`;
}

function getCourseNotesStorageKey(courseTitle: string): string {
  const normalizedTitle = courseTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${PREVIEW_NOTES_STORAGE_KEY_PREFIX}.${normalizedTitle || "default"}`;
}

export const LearnerPreview: React.FC<LearnerPreviewProps> = ({ courseTitle, rawOutputs, onClose, insertedVideos = [], courseDuration, learnerNotesEnabled = true, resourcesPanelEnabled = true, glossaryEnabled = true, discussionEnabled = true, assessmentIntensity = "standard", avatarTrainerId, flipStylePreference, slideLayout, textLanguage, narratorLanguage, onUpdateVisualTopic, captionsEnabled = true }) => {
  // Prefer the explicit narrator language; fall back to text language; final fallback English.
  const effectiveNarratorLanguage = narratorLanguage || textLanguage || "English";
  const selectedTrainer = AVATAR_TRAINERS.find((trainer) => trainer.id === avatarTrainerId) || AVATAR_TRAINERS[0];
  const avatarEnv = import.meta.env as Record<string, string | undefined>;
  const trainerMedia = getTrainerMedia(selectedTrainer.id, avatarEnv);
  const trainerVoiceId = getTrainerVoiceId(selectedTrainer.id);
  const avatarVideoUrl = trainerMedia.videoUrl;
  const avatarPosterUrl = trainerMedia.posterUrl;
  const avatarImageUrl = trainerMedia.imageUrl;
  const trainerName = selectedTrainer.name;
  const trainerBadgeInitial = trainerName.charAt(0).toUpperCase();
  const hasAvatarVideoNarration = Boolean(avatarVideoUrl);
  const [localVideos, setLocalVideos] = useState<InsertedVideo[]>(insertedVideos);
  const [showPlacer, setShowPlacer] = useState(false);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [highlightPalette, setHighlightPalette] = useState<HighlightPalette>("yellow");
  const [flipStyle, setFlipStyle] = useState<FlipStyle>("dramatic");
  const [activeLearningTool, setActiveLearningTool] = useState<LearningToolPanel>(null);
  const [visualActionState, setVisualActionState] = useState<Record<string, { regenerating?: boolean; error?: string }>>({});
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel>("home");
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanel>(null);
  const [learnerNotes, setLearnerNotes] = useState("");

  // Sync if parent changes
  useEffect(() => { setLocalVideos(insertedVideos); }, [insertedVideos]);

  const unassignedCount = localVideos.filter(v => !v.moduleTitle).length;
  const activeHighlightPalette = HIGHLIGHT_PALETTES[highlightPalette];
  const flipStyleStorageKey = useMemo(() => getCourseFlipStyleStorageKey(courseTitle), [courseTitle]);
  const notesStorageKey = useMemo(() => getCourseNotesStorageKey(courseTitle), [courseTitle]);
  const slideRules = {
    maxLines: slideLayout?.maxLines ?? 10,
    minFontSize: slideLayout?.minFontSize ?? 12.5,
    lineSpacing: slideLayout?.lineSpacing ?? 2,
  };

  useEffect(() => {
    if (flipStylePreference && isFlipStyle(flipStylePreference)) {
      setFlipStyle(flipStylePreference);
      return;
    }

    try {
      const savedCourseStyle = window.localStorage.getItem(flipStyleStorageKey);
      const savedDefaultStyle = window.localStorage.getItem(PREVIEW_FLIP_STYLE_STORAGE_KEY);
      if (isFlipStyle(savedCourseStyle)) {
        setFlipStyle(savedCourseStyle);
        return;
      }
      if (isFlipStyle(savedDefaultStyle)) {
        setFlipStyle(savedDefaultStyle);
      }
    } catch {
      // Ignore storage issues and keep the default flip style.
    }
  }, [flipStylePreference, flipStyleStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(flipStyleStorageKey, flipStyle);
      window.localStorage.setItem(PREVIEW_FLIP_STYLE_STORAGE_KEY, flipStyle);
    } catch {
      // Ignore storage issues; preview selection can remain session-only.
    }
  }, [flipStyle, flipStyleStorageKey]);

  useEffect(() => {
    if (!learnerNotesEnabled) {
      setLearnerNotes("");
      return;
    }

    try {
      const savedNotes = window.localStorage.getItem(notesStorageKey);
      if (typeof savedNotes === "string") {
        setLearnerNotes(savedNotes);
      }
    } catch {
      // Ignore localStorage issues and keep notes in memory only.
    }
  }, [learnerNotesEnabled, notesStorageKey]);

  useEffect(() => {
    if (!learnerNotesEnabled) return;

    try {
      window.localStorage.setItem(notesStorageKey, learnerNotes);
    } catch {
      // Ignore localStorage issues and keep notes in memory only.
    }
  }, [learnerNotes, learnerNotesEnabled, notesStorageKey]);

  useEffect(() => {
    if (!learnerNotesEnabled && activeSidebarPanel === "notes") {
      setActiveSidebarPanel("home");
    }
  }, [activeSidebarPanel, learnerNotesEnabled]);

  const { modules, slides } = React.useMemo(
    () => buildSlides(rawOutputs, localVideos, courseDuration, slideRules.maxLines, assessmentIntensity),
    [rawOutputs, localVideos, courseDuration, slideRules.maxLines, assessmentIntensity]
  );
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, { selected: number; submitted: boolean }>>({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime] = useState(Date.now());
  const [showCompletion, setShowCompletion] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [previewNarrationLanguage, setPreviewNarrationLanguage] = useState<string>("English");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  // BUG FIX #4: Audio Playback Management
  const [audioPlayingSlideId, setAudioPlayingSlideId] = useState<number | null>(null);
  const audioRefMap = useRef<Record<number, HTMLAudioElement | null>>({});
  const [voiceActivityLevel, setVoiceActivityLevel] = useState(0);
  const [activeViseme, setActiveViseme] = useState<VisemeKey>("rest");
  const [slideMotion, setSlideMotion] = useState<"forward" | "backward" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<Record<number, string>>({});
  const visemeTimelinesRef = useRef<Record<number, VisemeCue[]>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lipSyncFrameRef = useRef<number>(0);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const visemeIndexRef = useRef(0);
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slide = slides[currentSlide];
  const totalSlides = slides.length;
  // courseDuration may arrive as "3min", "15min", "3 min", or "3" — normalize once.
  const courseDurationMinutes = (() => {
    const raw = String(courseDuration ?? "15");
    const match: RegExpMatchArray | null = raw.match(/\d+/);
    return match ? `${match[0]} min` : `${raw} min`;
  })();
  const progress = ((currentSlide + 1) / totalSlides) * 100;
  const slideAnimationName = slideMotion
    ? flipStyle === "subtle"
      ? slideMotion === "forward"
        ? "sheetFlipSubtleForward"
        : "sheetFlipSubtleBackward"
      : flipStyle === "bound"
        ? slideMotion === "forward"
          ? "sheetFlipBoundForward"
          : "sheetFlipBoundBackward"
        : slideMotion === "forward"
          ? "sheetFlipForward"
          : "sheetFlipBackward"
    : undefined;
  const showBinding = flipStyle === "bound";
  const showStageGlow = Boolean(slideMotion) && flipStyle !== "subtle";
  const slideAnimationDuration = flipStyle === "dramatic" ? 900 : flipStyle === "bound" ? 620 : 480;

  // Get narration sections
  const voiceParsed = tryParseJSON(rawOutputs.voice);
  const narrationSections = voiceParsed?.sections || [];

  // Word highlight state
  const [highlightWordIdx, setHighlightWordIdx] = useState(-1);
  const animFrameRef = useRef<number>(0);

  const stopLipSync = useCallback(() => {
    if (lipSyncFrameRef.current) {
      cancelAnimationFrame(lipSyncFrameRef.current);
      lipSyncFrameRef.current = 0;
    }

    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch {
        // Ignore disconnect teardown errors.
      }
      mediaSourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Ignore disconnect teardown errors.
      }
      analyserRef.current = null;
    }

    analyserDataRef.current = null;
    setVoiceActivityLevel(0);
    setActiveViseme("rest");
    visemeIndexRef.current = 0;
  }, []);

  useEffect(() => {
    Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    audioUrlsRef.current = {};
    visemeTimelinesRef.current = {};

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsPlaying(false);
    stopLipSync();
  }, [trainerVoiceId, rawOutputs.writer, rawOutputs.voice, stopLipSync]);

  const startLipSync = useCallback(async (audio: HTMLAudioElement, visemeTimeline: VisemeCue[] = []) => {
    stopLipSync();
    visemeIndexRef.current = 0;

    try {
      const AudioContextCtor = window.AudioContext
        || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        setVoiceActivityLevel(audio.paused ? 0 : 0.35);
        setActiveViseme(audio.paused ? "rest" : "aa");
        return;
      }

      const audioContext = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const mediaSource = audioContext.createMediaElementSource(audio);
      mediaSource.connect(analyser);
      analyser.connect(audioContext.destination);

      analyserRef.current = analyser;
      mediaSourceRef.current = mediaSource;
      analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      let smoothedLevel = 0;

      const tick = () => {
        if (audio.paused || audio.ended || !analyserRef.current || !analyserDataRef.current) {
          setVoiceActivityLevel(0);
          setActiveViseme("rest");
          lipSyncFrameRef.current = 0;
          return;
        }

        analyserRef.current.getByteTimeDomainData(analyserDataRef.current);

        let squareSum = 0;
        for (let index = 0; index < analyserDataRef.current.length; index += 1) {
          const centered = (analyserDataRef.current[index] - 128) / 128;
          squareSum += centered * centered;
        }

        const rms = Math.sqrt(squareSum / Math.max(1, analyserDataRef.current.length));
        const normalized = Math.max(0, Math.min(1, (rms - 0.012) / 0.11));
        smoothedLevel = smoothedLevel * 0.62 + normalized * 0.38;
        setVoiceActivityLevel(smoothedLevel);

        if (visemeTimeline.length > 0) {
          const nowMs = audio.currentTime * 1000;
          let timelineIndex = visemeIndexRef.current;

          while (timelineIndex < visemeTimeline.length - 1 && nowMs >= visemeTimeline[timelineIndex].endMs) {
            timelineIndex += 1;
          }

          while (timelineIndex > 0 && nowMs < visemeTimeline[timelineIndex].startMs) {
            timelineIndex -= 1;
          }

          visemeIndexRef.current = timelineIndex;
          const cue = visemeTimeline[timelineIndex];
          setActiveViseme(nowMs >= cue.startMs && nowMs <= cue.endMs ? cue.viseme : "rest");
        } else {
          setActiveViseme(smoothedLevel > 0.18 ? "aa" : "rest");
        }

        lipSyncFrameRef.current = requestAnimationFrame(tick);
      };

      lipSyncFrameRef.current = requestAnimationFrame(tick);
    } catch {
      setVoiceActivityLevel(audio.paused ? 0 : 0.35);
      setActiveViseme(audio.paused ? "rest" : "aa");
    }
  }, [stopLipSync]);

  // Narration text for current slide - with fallback to slide content
  const getNarrationForSlide = useCallback((slideIdx: number) => {
    const s = slides[slideIdx];
    if (!s) return "";

    // Only get narration for content and assessment slides
    if (s.type !== "content" && s.type !== "assessment") return "";

    // Try voice agent output first (for content slides)
    if (s.type === "content" && narrationSections.length) {
      const contentSlides = slides.filter(sl => sl.type === "content");
      const contentIdx = contentSlides.indexOf(s);
      if (contentIdx >= 0 && narrationSections[contentIdx]) {
        const txt = narrationSections[contentIdx].narration_text || "";
        if (txt) return txt;
      }
    }

    // For content slides, fallback: build narration from slide content
    if (s.type === "content") {
      const parts = parseContentParts(s.content || "");
      const lines: string[] = [];
      if (parts.hook) lines.push(parts.hook);
      parts.body.forEach(p => lines.push(p));
      if (parts.takeaway) lines.push(`Key takeaway: ${parts.takeaway}`);
      return lines.join(". ").replace(/\.\./g, ".").slice(0, 2500) || "";
    }

    // For assessment slides, use the question as narration
    if (s.type === "assessment" && s.question) {
      const q = s.question;
      return q.question || "";
    }

    return "";
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

  const navigateToSlide = useCallback((targetSlide: number) => {
    if (targetSlide === currentSlide || targetSlide < 0 || targetSlide >= totalSlides) return;
    setSlideMotion(targetSlide > currentSlide ? "forward" : "backward");
    setCurrentSlide(targetSlide);
  }, [currentSlide, totalSlides]);

  // Stop audio on slide change (BUG FIX #4: Stop ALL audio)
  useEffect(() => {
    // Stop primary audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    }
    // Stop all audio in map
    Object.values(audioRefMap.current).forEach(audioElement => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    });
    setAudioPlayingSlideId(null);
    setHighlightWordIdx(-1);
    setHighlightSentenceIdx(-1);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    stopLipSync();
  }, [currentSlide, stopLipSync]);

  useEffect(() => {
    if (!slideMotion) return;
    const timeoutId = window.setTimeout(() => setSlideMotion(null), 520);
    return () => window.clearTimeout(timeoutId);
  }, [currentSlide, slideMotion]);

  // Animate sentence highlight while playing
  const startWordHighlight = useCallback((audio: HTMLAudioElement) => {
    const totalSentences = narrationSentences.length;
    const totalWords = narrationWords.length;
    if (!totalSentences || !totalWords) return;

    // Pre-compute cumulative word counts per sentence to map audio progress to a sentence
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
    audio.onplay = () => {
      setIsPlaying(true);
      visemeIndexRef.current = 0;
      startWordHighlight(audio);
      void startLipSync(audio, visemeTimelinesRef.current[currentSlide] || []);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setHighlightWordIdx(-1);
      setHighlightSentenceIdx(-1);
      stopLipSync();
    };
    audio.onpause = () => {
      setIsPlaying(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopLipSync();
    };
  }, [currentSlide, muted, startLipSync, startWordHighlight, stopLipSync]);

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
            voiceId: trainerVoiceId,
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error("TTS error:", response.status, errText);
        return;
      }
      const { audioUrl, visemeTimeline } = await parseTtsResponse(response);
      visemeTimelinesRef.current[currentSlide] = visemeTimeline;
      const url = audioUrl;
      audioUrlsRef.current[currentSlide] = url;
      const audio = new Audio(url);
      wireAudio(audio);
      await audio.play().catch((err) => {
        console.error("Audio playback failed:", err);
      });

      // Log ElevenLabs TTS usage
      try {
        const textLength = narrationText.slice(0, 2500).length;
        const costInr = (textLength * 0.0003) / 1000 * 10; // Rough estimate
        await logApiUsage(
          "ElevenLabs",
          textLength,
          costInr,
          "Text-to-speech narration playback",
          undefined
        ).catch(() => {});
      } catch (e) {
        // Silently fail
      }
    } catch (err) {
      console.error("TTS fetch failed:", err);
    } finally {
      setAudioLoading(false);
    }
  }, [currentSlide, getNarrationForSlide, trainerVoiceId, wireAudio]);

  // Auto-play narration when slide changes
  useEffect(() => {
    if (hasAvatarVideoNarration || muted) return;
    const narration = getNarrationForSlide(currentSlide);
    if (!narration) return;
    // If audio already cached for this slide, play it
    if (audioUrlsRef.current[currentSlide]) {
      const audio = new Audio(audioUrlsRef.current[currentSlide]);
      wireAudio(audio);
      audio.play().catch((err) => {
        console.error("Cached audio playback failed:", err);
      });
      return;
    }
    // Otherwise fetch and play
    void playNarration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]);

  // Mute/unmute live
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === previewRootRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => () => {
    stopLipSync();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
  }, [stopLipSync]);

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
      // BUG FIX #4: Stop audio on keyboard navigation
      const stopAllAudio = () => {
        Object.values(audioRefMap.current).forEach(audio => {
          if (audio) { audio.pause(); audio.currentTime = 0; }
        });
      };
      if (e.key === "ArrowRight" || e.key === " ") { stopAllAudio(); goNext(); }
      if (e.key === "ArrowLeft") { stopAllAudio(); goPrev(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentSlide]);

  const isAssessmentLocked = useCallback((idx: number) => {
    const s = slides[idx];
    if (!s || s.type !== "assessment") return false;
    const ans = assessmentAnswers[idx];
    return !ans?.submitted;
  }, [slides, assessmentAnswers]);

  const goNext = useCallback(() => {
    if (isAssessmentLocked(currentSlide)) return;
    if (currentSlide < totalSlides - 1) {
      navigateToSlide(currentSlide + 1);
    }
  }, [currentSlide, totalSlides, navigateToSlide, isAssessmentLocked]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      navigateToSlide(currentSlide - 1);
    }
  }, [currentSlide, navigateToSlide]);

  const currentModuleSlides = slides
    .map((s, i) => ({ ...s, idx: i }))
    .filter(s => s.moduleIndex === slide.moduleIndex);

  const toc = modules.map((mod, mi) => ({
    title: mod.title,
    moduleIndex: mi,
    slides: slides.map((s, i) => ({ ...s, idx: i })).filter(s => s.moduleIndex === mi),
  }));

  const currentModule = modules[slide.moduleIndex] || modules[0];
  const currentModuleTopics = Array.from(new Set(
    currentModuleSlides
      .filter((moduleSlide) => moduleSlide.type === "content" && moduleSlide.topicTitle)
      .map((moduleSlide) => moduleSlide.topicTitle as string)
  ));
  const currentModuleCompletion = currentModuleSlides.length > 0
    ? Math.round((currentModuleSlides.filter((moduleSlide) => visited.has(moduleSlide.idx)).length / currentModuleSlides.length) * 100)
    : 0;
  const currentModuleAssessmentSlide = currentModuleSlides.find((moduleSlide) => moduleSlide.type === "assessment" && moduleSlide.question);
  const currentModuleTitleSlide = currentModuleSlides.find((moduleSlide) => moduleSlide.type === "title");
  const currentModuleSummarySlide = currentModuleSlides.find((moduleSlide) => moduleSlide.type === "summary");
  const currentModuleVideoSlide = currentModuleSlides.find((moduleSlide) => moduleSlide.type === "video");
  const currentModuleAssessment = currentModuleAssessmentSlide?.question;
  const currentModuleVideoCount = currentModuleSlides.filter((moduleSlide) => moduleSlide.type === "video").length;
  const currentModuleVisualCount = currentModuleSlides.filter((moduleSlide) => moduleSlide.type === "content" && (moduleSlide.visualImageDataUrl || moduleSlide.visualSvg)).length;
  const currentModuleObjectiveCount = Math.min(3, currentModuleTopics.length || currentModule?.topics?.length || 0);
  const currentLessonObjectives = getTopicLearningObjectives(
    currentModuleTopics.length > 0 ? currentModuleTopics : currentModule?.topics || [],
    slide.type === "content" ? slide.topicTitle : undefined,
  );
  const courseCompletion = totalSlides > 0 ? Math.round((visited.size / totalSlides) * 100) : 0;
  const shellPageTitle = slide.type === "title"
    ? currentModule?.title || courseTitle
    : slide.type === "assessment"
      ? "Knowledge Check"
      : slide.type === "summary"
        ? "Module Summary"
        : slide.type === "video"
          ? slide.video?.title || "Video Resource"
          : slide.topicTitle || currentModule?.title || courseTitle;
  const shellPageSubtitle = slide.type === "title"
    ? `Module ${slide.moduleIndex + 1} overview and learner setup`
    : slide.type === "assessment"
      ? currentModuleAssessment?.question || "Check your understanding before moving on."
      : slide.type === "summary"
        ? `Key takeaways and completion for ${currentModule?.title || "this module"}`
        : slide.type === "video"
          ? `${slide.video?.channelTitle || "Curated resource"} for this lesson`
          : `Lesson ${(slide.topicIndex || 0) + 1}${slide.topicPartCount && slide.topicPartCount > 1 ? ` - Part ${(slide.topicPartIndex || 0) + 1} of ${slide.topicPartCount}` : ""}`;
  const layoutTrimNotice = slide.type === "content" && slide.wasTrimmedForLayout;
  const firstContentSlide = currentModuleSlides.find((moduleSlide) => moduleSlide.type === "content");
  const platformNavItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "progress" as const, label: "Progress", icon: BarChart3 },
    { id: "objectives" as const, label: "Objectives", icon: BookOpenText },
    ...(learnerNotesEnabled ? [{ id: "notes" as const, label: "Notes", icon: NotebookPen }] : []),
    ...(resourcesPanelEnabled ? [{ id: "resources" as const, label: "Resources", icon: FolderOpen }] : []),
  ];
  const utilityActions = [
    ...(discussionEnabled ? [{ label: "Discussion", icon: MessageSquareText, panel: "discussion" as const }] : []),
    ...(glossaryEnabled ? [{ label: "Glossary", icon: BookOpenText, panel: "glossary" as const }] : []),
    { label: "Settings", icon: Settings2, panel: "settings" as const },
  ];

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
    const optClean = stripOptionPrefix(q.options[ans.selected] || "");
    const correctClean = stripOptionPrefix(q.correct_answer || "");
    const correct = optClean === correctClean ||
      q.options[ans.selected] === q.correct_answer ||
      String.fromCharCode(65 + ans.selected) === q.correct_answer ||
      q.correct_answer?.includes(optClean);
    setAssessmentAnswers(prev => ({ ...prev, [slideIdx]: { ...ans, submitted: true } }));
    setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  };

  const currentNarration = getNarrationForSlide(currentSlide);
  const currentVisualKey = slide.type === "content" && slide.topicTitle ? `${slide.moduleTitle}::${slide.topicTitle}` : "";

  const handleToggleVoiceover = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);

    if (nextMuted) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      stopLipSync();
      return;
    }

    if (currentNarration && !hasAvatarVideoNarration) {
      void playNarration();
    }
  }, [currentNarration, hasAvatarVideoNarration, muted, playNarration, stopLipSync]);

  const handleToggleFullscreen = useCallback(async () => {
    const target = previewRootRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (target.requestFullscreen) {
        await target.requestFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen toggle failed:", error);
    }
  }, []);

  const handleSidebarSelect = useCallback((panel: SidebarPanel) => {
    setActiveSidebarPanel(panel);

    if (panel === "home") {
      navigateToSlide(0);
    }
  }, [navigateToSlide]);

  const handleApproveVisual = useCallback(() => {
    if (!onUpdateVisualTopic || slide.type !== "content" || !slide.topicTitle) {
      toast.error("Cannot approve: visual editor isn't available in this preview.");
      return;
    }
    const willApprove = !slide.visualApproved;
    onUpdateVisualTopic(slide.moduleTitle, slide.topicTitle, {
      image_approved: willApprove,
    });
    toast.success(willApprove ? "Visual approved" : "Approval removed");
  }, [onUpdateVisualTopic, slide]);

  const handleRegenerateVisual = useCallback(async () => {
    if (!onUpdateVisualTopic || slide.type !== "content" || !slide.topicTitle || !currentVisualKey) return;

    setVisualActionState((prev) => ({
      ...prev,
      [currentVisualKey]: {
        regenerating: true,
        error: "",
      },
    }));

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("generate-slide-image", {
        body: {
          prompt: slide.visualPrompt || `A realistic workplace training scene for ${slide.topicTitle}.`,
          moduleTitle: slide.moduleTitle,
          topicTitle: slide.topicTitle,
          altText: slide.visualAltText || `AI-generated visual for ${slide.topicTitle}`,
        },
      });

      if (error || !data?.imageDataUrl) {
        throw new Error(data?.error || error?.message || "Image regeneration failed");
      }

      onUpdateVisualTopic(slide.moduleTitle, slide.topicTitle, {
        generated_image_data_url: data.imageDataUrl,
        generated_image_mime_type: data.mimeType || "image/png",
        image_approved: false,
      });

      setVisualActionState((prev) => ({
        ...prev,
        [currentVisualKey]: {
          regenerating: false,
          error: "",
        },
      }));
      toast.success("Visual regenerated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image regeneration failed";
      setVisualActionState((prev) => ({
        ...prev,
        [currentVisualKey]: {
          regenerating: false,
          error: message,
        },
      }));
      toast.error(`Regeneration failed: ${message}`);
    }
  }, [currentVisualKey, onUpdateVisualTopic, slide]);

  /* COMPLETION SCREEN */
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

  /* SLIDE RENDERERS */
  const renderSlide = () => {
    switch (slide.type) {
      case "title":
        return (
          <div className="flex flex-col h-full bg-white" key={currentSlide}>
            {/* Header with Logo and Course Title */}
            <div className="border-b border-slate-200 px-8 py-6">
              <div className="max-w-[1200px] mx-auto">
                {/* Company Logo */}
                {(slide as any).courseLogoUrl && (
                  <div className="mb-4">
                    <img
                      src={(slide as any).courseLogoUrl}
                      alt="Company Logo"
                      className="h-16 object-contain"
                    />
                  </div>
                )}

                {/* Title Section */}
                <div>
                  <h1 className="text-[42px] font-[900] text-slate-900 leading-tight mb-2">
                    {slide.moduleTitle}
                  </h1>
                  <p className="text-[18px] text-slate-600 mb-4">{courseTitle}</p>

                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-[13px] font-semibold px-4 py-2 rounded-full">
                      <Clock className="w-4 h-4" />
                      ~{courseDurationMinutes} minutes
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area - 50% Image, 50% Info */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full max-w-[1200px] mx-auto px-8 py-8 flex gap-8">
                {/* Left: Course Description and Info */}
                <div className="flex-1 flex flex-col justify-center anim-fade-in-left">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[13px] font-bold uppercase tracking-wider text-blue-600 mb-2">
                        Module {String(slide.moduleIndex + 1).padStart(2, "0")}
                      </p>
                      <p className="text-[16px] leading-relaxed text-slate-700">
                        Welcome to this learning module. This course is designed to help you master the key concepts and practical skills you need to succeed.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[14px] text-slate-700">Interactive learning experience</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[14px] text-slate-700">Comprehensive assessments</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[14px] text-slate-700">Professional certification ready</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Representative Image (50%) - use first generated image from this module */}
                {(() => {
                  const findImageIn = (list: any[]): string | undefined => {
                    for (const s of list) {
                      if (s?.visualImageDataUrl) return s.visualImageDataUrl;
                      const scenes = s?.narrative?.scenes || [];
                      for (const sc of scenes) {
                        if (sc?.imageDataUrl) return sc.imageDataUrl;
                      }
                    }
                    return undefined;
                  };
                  const repImage = findImageIn(currentModuleSlides) || findImageIn(slides as any[]);
                  return (
                    <div className="flex-1 flex items-center justify-center anim-fade-in-right" style={{ animationDelay: "0.1s" }}>
                      <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                        {repImage ? (
                          <img src={repImage} alt={slide.moduleTitle} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-8">
                            <svg viewBox="0 0 400 400" className="w-full h-full text-blue-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="80" y="100" width="240" height="200" rx="20" fill="none" />
                              <line x1="100" y1="120" x2="300" y2="120" />
                              <line x1="100" y1="150" x2="300" y2="150" />
                              <line x1="100" y1="180" x2="300" y2="180" />
                              <line x1="100" y1="210" x2="300" y2="210" />
                              <line x1="100" y1="240" x2="300" y2="240" />
                              <circle cx="200" cy="280" r="30" fill="none" strokeWidth="2" />
                              <path d="M200 270 L200 290 M190 280 L210 280" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer - Navigation hint */}
            <div className="border-t border-slate-200 bg-slate-50 px-8 py-4">
              <div className="max-w-[1200px] mx-auto text-center">
                <p className="text-[13px] text-slate-600">
                  Click <span className="font-semibold">Next</span> to begin the learning module
                </p>
              </div>
            </div>
          </div>
        );

      case "narrative-flipbook": {
        const narrative = (slide as any).narrative as TopicNarrative;
        const sceneIndex = ((slide as any).sceneIndex || 0);
        const scenes = narrative?.scenes || [];

        return (
          <div className="mx-auto max-w-[1280px] space-y-6" key={currentSlide}>
            <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-8 shadow-[0_22px_54px_rgba(15,23,42,0.1)] space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Interactive Story</p>
                  <h2 className="mt-1 text-[32px] font-[900] leading-tight text-[#123d78]">{slide.topicTitle}</h2>
                  <p className="mt-2 text-[14px] text-[#5f7898]">{narrative.topicObjective}</p>
                </div>
              </div>

              {/* Flipbook */}
              <NarrativeFlipbook
                narratives={[narrative]}
                displayStyle="smooth-slide"
                captionsEnabled={captionsEnabled}
                onSceneChange={(topicIdx, sceneIdx) => {
                  // Update scene index for voice sync
                }}
              />

              {/* Narration below flipbook */}
              {scenes.length > 0 && (
                <div className="rounded-[22px] bg-[#f3f8fd] border border-[#d8e2ef] p-6">
                  <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] mb-3">Scene Narration</p>
                  <p className="text-[16px] leading-relaxed text-[#1a3a5c] font-[500]">
                    {scenes[0]?.narration || scenes[0]?.caption || "Listen to the scene narration as you view the image."}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "content": {
        const parts = parseContentParts(slide.content || "");
        const moduleLabel = `MODULE ${slide.moduleIndex + 1} - ${slide.moduleTitle}`.toUpperCase();
        const narratorSource = [parts.hook, ...parts.body].filter(Boolean).join(" ");
        const narratorExcerpt = getNarratorExcerpt(narratorSource || slide.content || "");
        const chartLines = buildFlipChartLines(parts, slideRules.maxLines);
        const contentTextStyle = {
          fontSize: `${Math.max(14, slideRules.minFontSize)}px`,
          lineHeight: slideRules.lineSpacing,
        } as React.CSSProperties;
        const clampSingleLine = {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
        } as React.CSSProperties;

        const normalizedNarrationSentences = narrationSentences.map((sentence) => stripNarratorMarkdown(sentence));
        let narrationCursor = 0;
        const chartSentenceEntries = chartLines.map((line, index) => {
          const normalizedLine = stripNarratorMarkdown(line.text);
          let sentenceIndex = -1;

          for (let i = narrationCursor; i < normalizedNarrationSentences.length; i++) {
            if (normalizedNarrationSentences[i] === normalizedLine) {
              sentenceIndex = i;
              narrationCursor = i + 1;
              break;
            }
          }

          return {
            ...line,
            sentenceIndex: sentenceIndex >= 0 ? sentenceIndex : index,
          };
        });
        const visualMarkup = slide.visualImageDataUrl ? (
          <img
            src={slide.visualImageDataUrl}
            alt={slide.visualAltText || `${slide.topicTitle} visual`}
            className="h-full w-full object-cover"
          />
        ) : slide.visualSvg ? (
          <div
            className="h-full w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: slide.visualSvg }}
          />
        ) : null;
        const showHeroVisual = Boolean(visualMarkup) && slide.visualPlacement !== "side-panel";
        const showSideVisual = Boolean(visualMarkup) && slide.visualPlacement === "side-panel";
        const contentTemplate: ContentTemplate = inferContentTemplate(slide, Boolean(visualMarkup));
        const lessonObjectives = getTopicLearningObjectives(currentModuleTopics, slide.topicTitle);
        const quickFact = getQuickFact(parts);
        const scenarioLead = parts.body[0] || parts.hook || narratorExcerpt;
        const scenarioSupport = parts.body[1] || parts.challenge || parts.takeaway || quickFact;
        const summaryBullets = Array.from(new Set(chartSentenceEntries.map((entry) => entry.text))).slice(0, 4);
        const fallbackChartText = safeLearnerText(parts.hook)
          || safeLearnerText(narratorExcerpt)
          || (slide.topicTitle ? `This section covers ${slide.topicTitle}.` : "");
        const safeChartEntries = chartSentenceEntries.length > 0
          ? chartSentenceEntries
          : fallbackChartText
            ? [{ text: fallbackChartText, tone: "body" as const, sentenceIndex: -1 }]
            : [];
        const visualState = currentVisualKey ? visualActionState[currentVisualKey] : undefined;
        const visualControls = onUpdateVisualTopic && slide.topicTitle ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleApproveVisual}
              className={`rounded-full px-3 py-1 text-[11px] font-[800] ${slide.visualApproved ? "bg-emerald-100 text-emerald-700" : "border border-[#d8deea] bg-white text-[#1e3a5f]"}`}
              type="button"
            >
              {slide.visualApproved ? "Unapprove" : "Approve"}
            </button>
            <button
              onClick={handleRegenerateVisual}
              disabled={visualState?.regenerating}
              className="inline-flex items-center gap-1 rounded-full border border-[#d8deea] bg-white px-3 py-1 text-[11px] font-[800] text-[#1e3a5f] disabled:opacity-60"
              type="button"
            >
              {visualState?.regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate
            </button>
          </div>
        ) : null;

        if (contentTemplate === "scenario") {
          return (
            <div className="mx-auto max-w-[1280px]" key={currentSlide}>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

                {/* LEFT: scenario content */}
                <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-8 shadow-[0_22px_54px_rgba(15,23,42,0.1)] space-y-6">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Scenario</p>
                      <h2 className="mt-1 text-[32px] font-[900] leading-tight text-[#123d78]">{slide.topicTitle}</h2>
                    </div>
                    {visualControls}
                  </div>

                  {/* Situation */}
                  <div className="rounded-[22px] bg-[#f3f8fd] border border-[#d8e2ef] p-6">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] mb-3">Situation</p>
                    <p className="text-[18px] leading-relaxed text-[#1a3a5c] font-[500]">
                      {scenarioLead || `This scenario explores the challenges of ${slide.topicTitle || "this topic"}.`}
                    </p>
                  </div>

                  {/* What to Notice + Better Move side by side */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-[#d8e2ef] bg-white p-5 shadow-sm">
                      <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] mb-3">What to Notice</p>
                      <div className="space-y-2.5">
                        {summaryBullets.length > 0 ? (
                          summaryBullets.slice(0, 4).map((bullet, index) => (
                            <div key={`${bullet}-${index}`} className="flex items-start gap-2.5 text-[14px] text-[#24486f]">
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2b5fa4]" />
                              <span>{bullet}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[13px] text-[#7c8eb0] italic">Key observations will appear after the course has been fully generated.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#f0d8a8] bg-[#fffbf0] p-5 shadow-sm">
                      <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#9a6a1a] mb-3">Better Move</p>
                      <p className="text-[15px] leading-relaxed text-[#6f5b35]">
                        {scenarioSupport || `A recommended approach for handling ${slide.topicTitle || "this situation"}.`}
                      </p>
                    </div>
                  </div>

                  {/* Scenario visual - only show if there's actual content */}
                  {visualMarkup ? (
                    <div className="overflow-hidden rounded-[22px] border border-[#d8e2ef] bg-[#eef3f8]">
                      <div className="aspect-video w-full">{visualMarkup}</div>
                    </div>
                  ) : null}
                </div>

                {/* RIGHT: avatar coach */}
                <div className="xl:sticky xl:top-6 xl:self-start">
                  <AvatarNarrator
                    topic={slide.topicTitle || slide.moduleTitle}
                    moduleContent={narratorExcerpt || `This scenario explains ${slide.topicTitle || slide.moduleTitle}.`}
                    systemHint="Coach the learner through the scenario and emphasize the stronger practical response."
                    trainerName={trainerName}
                    avatarImageUrl={avatarImageUrl}
                    avatarVideoUrl={avatarVideoUrl}
                    avatarPosterUrl={avatarPosterUrl}
                    trainerId={selectedTrainer.id}
                    isVoiceActive={isPlaying}
                    isVoiceLoading={audioLoading}
                    currentViseme={activeViseme}
                    narratorLanguage={effectiveNarratorLanguage}
                  />
                </div>
              </div>
            </div>
          );
        }

        if (contentTemplate === "media-quiz") {
          return (
            <div className="mx-auto max-w-[1180px]" key={currentSlide}>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-6 shadow-[0_22px_54px_rgba(15,23,42,0.1)]">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Media + Quiz Screen</p>
                      <h2 className="mt-2 text-[34px] font-[900] leading-tight text-[#123d78]">{slide.topicTitle}</h2>
                      <p className="mt-1 text-[15px] text-[#5f7898]">{parts.hook || narratorExcerpt}</p>
                    </div>
                    {visualControls}
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="overflow-hidden rounded-[24px] border border-[#d8e2ef] bg-[#f4f8fc] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Featured Media</p>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-[800] text-[#355fa8] shadow-sm">Interactive asset zone</span>
                      </div>
                      <div className="overflow-hidden rounded-[18px] border border-[#d8deea] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
                        <div className="aspect-[16/10] w-full bg-[#eef3f8]">
                          {visualMarkup ? visualMarkup : <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-[#607896]">Hero media or animation placeholder for this lesson.</div>}
                        </div>
                      </div>
                      <div className="mt-4 rounded-[18px] border border-[#d8e2ef] bg-white p-4">
                        <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Key Explanation</p>
                        <p className="mt-3 text-[14px] leading-relaxed text-[#35506f]">{parts.body[0] || parts.takeaway || narratorExcerpt}</p>
                      </div>
                    </div>

                    <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                      <div className="overflow-hidden rounded-[24px] border border-[#d8e2ef] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
                        <div className="border-b border-[#e2e8f0] px-4 py-3">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">{trainerName}'s Guide</p>
                          <p className="mt-0.5 text-[12px] text-[#607896]">Presenter-led explanation and follow-up example</p>
                        </div>
                        <div className="p-4">
                          <AvatarNarrator
                            topic={slide.topicTitle || slide.moduleTitle}
                            moduleContent={narratorExcerpt || `This section explains ${slide.topicTitle || slide.moduleTitle}.`}
                            systemHint="Focus on the practical benefit to an office worker."
                            trainerName={trainerName}
                            avatarImageUrl={avatarImageUrl}
                            avatarVideoUrl={avatarVideoUrl}
                            avatarPosterUrl={avatarPosterUrl}
                            trainerId={selectedTrainer.id}
                            isVoiceActive={isPlaying}
                            isVoiceLoading={audioLoading}
                            currentViseme={activeViseme}
                            narratorLanguage={effectiveNarratorLanguage}
                          />
                        </div>
                      </div>

                      {(slide.topicPartIndex || 0) === 0 && lessonObjectives.length > 0 && (
                        <div className="rounded-[22px] border border-[#d8e2ef] bg-[#f4f8fc] p-4 shadow-sm">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Learning Objectives</p>
                          <div className="mt-3 space-y-3">
                            {lessonObjectives.map((objective, index) => (
                              <div key={`${objective}-${index}`} className="flex items-start gap-2 text-[13px] text-[#24486f]">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b]" />
                                <span>{objective}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-[22px] border border-[#d8e2ef] bg-white p-4 shadow-sm">
                        <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Quick Check</p>
                        <p className="mt-3 text-[15px] font-[800] leading-snug text-[#123d78]">{currentModuleAssessment?.question || parts.challenge || "Use this area for a quick embedded check."}</p>
                        <div className="mt-3 space-y-2">
                          {(currentModuleAssessment?.options || lessonObjectives).slice(0, 3).map((option, index) => (
                            <div key={`${option}-${index}`} className="rounded-xl border border-[#e2e8f0] bg-[#fbfdff] px-3 py-2 text-[13px] text-[#35506f]">
                              <span className="mr-2 font-[800] text-[#123d78]">{String.fromCharCode(65 + index)}.</span>
                              {stripOptionPrefix(option)}
                            </div>
                          ))}
                        </div>
                        {currentModuleAssessmentSlide ? (
                          <button
                            onClick={() => navigateToSlide(currentModuleAssessmentSlide.idx)}
                            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#1d4f93] px-4 text-[13px] font-[800] text-white transition-all hover:bg-[#173f78]"
                            type="button"
                          >
                            Launch Knowledge Check
                          </button>
                        ) : null}
                      </div>

                      <div className="rounded-[22px] border border-[#f2d089] bg-[#fff5d6] p-4 shadow-sm">
                        <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Quick Fact</p>
                        <p className="mt-3 text-[14px] leading-relaxed text-[#6f5b35]">{quickFact}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (contentTemplate === "summary-panel") {
          return (
            <div className="mx-auto max-w-[1140px]" key={currentSlide}>
              <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-6 shadow-[0_22px_54px_rgba(15,23,42,0.1)]">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Consolidation Screen</p>
                    <h2 className="mt-2 text-[34px] font-[900] leading-tight text-[#123d78]">{slide.topicTitle}</h2>
                    <p className="mt-1 text-[15px] text-[#5f7898]">{parts.hook || "Review the core ideas, lock in the takeaway, and carry the behavior forward."}</p>
                  </div>
                  {slide.topicPartCount && slide.topicPartCount > 1 ? (
                    <span className="inline-flex rounded-full bg-[#e8eef9] px-4 py-2 text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592]">
                      Consolidation View
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[22px] border border-[#d8e2ef] bg-[#f4f8fc] p-4 shadow-sm">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">What Matters</p>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#35506f]">{parts.takeaway || quickFact}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#d8e2ef] bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">What to Watch</p>
                    <div className="mt-3 space-y-2.5">
                      {summaryBullets.slice(0, 3).map((bullet, index) => (
                        <div key={`${bullet}-${index}`} className="flex items-start gap-2 text-[14px] text-[#24486f]">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2b5fa4]" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-[#f2d089] bg-[#fff5d6] p-4 shadow-sm">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">What to Do Next</p>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#6f5b35]">{parts.challenge || narratorExcerpt || "Translate the lesson into your next real-world decision."}</p>
                  </div>
                </div>

                {slide.infographicSvg?.trim() && (
                  <div className="mt-5">
                    <InfographicVisualAid
                      description={slide.infographicSvg}
                      moduleTitle={slide.moduleTitle}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (contentTemplate === "dashboard") {
          return (
            <div className="mx-auto max-w-[1320px]" key={currentSlide}>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
                <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-6 shadow-[0_22px_54px_rgba(15,23,42,0.1)] md:p-7">
                  <div className="mb-8">
                    <h2 className="text-[44px] font-[900] leading-tight text-[#123d78] mb-10">Course Overview</h2>

                    {/* Course Objective Section */}
                    {(parts.hook || narratorExcerpt) && (
                      <div className="mb-16">
                        <p className="text-[18px] font-bold italic text-[#123d78] mb-8">
                          Course Objective: <span className="font-normal not-italic text-[#35506f]">{parts.hook || narratorExcerpt}</span>
                        </p>
                      </div>
                    )}

                    {/* Course Content Section */}
                    {parts.body && parts.body.length > 0 && (
                      <div>
                        <p className="text-[16px] font-[900] text-[#123d78] mb-5">Course Content:</p>
                        <div className="space-y-3">
                          {parts.body.map((item, index) => (
                            <div key={index} className="flex items-start gap-3 text-[15px] leading-[1.5] text-[#35506f]">
                              <span className="font-[800] text-[#4f46e5] shrink-0 mt-1">•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {slide.topicPartCount && slide.topicPartCount > 1 ? (
                      <span className="inline-flex rounded-full bg-[#e8eef9] px-4 py-2 text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] mt-6">
                        Part {(slide.topicPartIndex || 0) + 1} of {slide.topicPartCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
                    <div className="space-y-5">
                      <div className="overflow-hidden rounded-[24px] border border-[#d8e2ef] bg-[#f5f8fc] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Lesson Canvas</p>
                          {visualControls}
                        </div>
                        {visualMarkup ? (
                          <div className="overflow-hidden rounded-[18px] border border-[#d8deea] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
                            <div className="aspect-[16/10] w-full overflow-hidden bg-[#eef3f8]">
                              {visualMarkup}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[#bfd0e4] bg-white/70 p-7 text-[14px] leading-relaxed text-[#607896]">
                            {parts.body[0] || parts.hook || "This lesson opens with a guided explanation before moving into activities and knowledge checks."}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[22px] border border-[#d8e2ef] bg-[#fbfdff] p-5 shadow-sm">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Core Explanation</p>
                          <div className="mt-3 space-y-2.5">
                            {chartSentenceEntries.slice(0, 4).map((line, index) => (
                              <div key={`${line.tone}-${index}`} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[#24486f]">
                                <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: line.tone === "takeaway" ? "#f59e0b" : line.tone === "challenge" ? "#7c3aed" : "#2b5fa4" }} />
                                <span>{line.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-[#d8e2ef] bg-[#fffaf3] p-5 shadow-sm">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Guided Coaching</p>
                          <p className="mt-3 text-[14px] leading-relaxed text-[#5f5a4a]">{parts.challenge || narratorExcerpt || "Think about how this would play out in your own workflow and where you would change your behavior."}</p>
                          <div className="mt-4 rounded-[18px] border border-[#f3d9a3] bg-white/80 p-3">
                            <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Key Takeaway</p>
                            <p className="mt-2 text-[13px] leading-relaxed text-[#6f5b35]">{parts.takeaway || quickFact}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(slide.topicPartIndex || 0) === 0 && lessonObjectives.length > 0 && (
                        <div className="rounded-[22px] border border-[#d8e2ef] bg-[#f4f8fc] p-4 shadow-sm">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Learning Objectives</p>
                          <div className="mt-3 space-y-3">
                            {lessonObjectives.map((objective, index) => (
                              <div key={`${objective}-${index}`} className="flex items-start gap-2 text-[13px] text-[#24486f]">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b]" />
                                <span>{objective}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentModuleAssessment ? (
                        <div className="rounded-[22px] border border-[#d8e2ef] bg-white p-4 shadow-sm">
                          <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Interactive Quiz</p>
                          <p className="mt-3 text-[15px] font-[800] leading-snug text-[#123d78]">{currentModuleAssessment.question}</p>
                          <div className="mt-3 space-y-2">
                            {currentModuleAssessment.options.slice(0, 3).map((option, index) => (
                              <div key={`${option}-${index}`} className="rounded-xl border border-[#e2e8f0] bg-[#fbfdff] px-3 py-2 text-[13px] text-[#35506f]">
                                <span className="mr-2 font-[800] text-[#123d78]">{String.fromCharCode(65 + index)}.</span>
                                {stripOptionPrefix(option)}
                              </div>
                            ))}
                          </div>
                          {currentModuleAssessmentSlide ? (
                            <button
                              onClick={() => navigateToSlide(currentModuleAssessmentSlide.idx)}
                              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#1d4f93] px-4 text-[13px] font-[800] text-white transition-all hover:bg-[#173f78]"
                              type="button"
                            >
                              Open Quiz
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-[22px] border border-[#f2d089] bg-[#fff5d6] p-4 shadow-sm">
                        <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Did You Know?</p>
                        <p className="mt-3 text-[14px] leading-relaxed text-[#6f5b35]">{quickFact}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="mx-auto max-w-[1140px]" key={currentSlide}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
              <div className="relative px-6 pt-8 pb-7 md:px-9 md:pt-10 md:pb-9"
                style={{
                  background: "#E5EAF1",
                  borderRadius: "32px",
                  boxShadow: "0 24px 50px rgba(15,23,42,0.18)",
                }}>
                <div className="pointer-events-none absolute left-6 right-6 top-4 h-4 rounded-full md:left-9 md:right-9"
                  style={{ background: "#CAD3DF", boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.85), 0 2px 6px rgba(15,23,42,0.18)" }}
                />
                <div className="pointer-events-none absolute left-[18%] top-[10px] h-10 w-4 -translate-x-1/2 rounded-full border-2 border-[#505867] bg-[#f8fafc] md:left-[22%]" />
                <div className="pointer-events-none absolute right-[18%] top-[10px] h-10 w-4 translate-x-1/2 rounded-full border-2 border-[#505867] bg-[#f8fafc] md:right-[22%]" />
                <div className="relative overflow-hidden rounded-[8px] border border-[#d8deea] bg-white px-6 py-6 md:px-8 md:py-7"
                  style={{ boxShadow: "0 16px 30px rgba(15,23,42,0.08)" }}>
                  <div className="absolute inset-0 opacity-[0.12] bg-[#dbe4f0]" />
                  <div className="relative z-10">
                    {showHeroVisual && (
                      <div className="mb-5 overflow-hidden rounded-[18px] border border-[#d8deea] bg-[#eef3f8] p-3"
                        aria-label={slide.visualAltText || `${slide.topicTitle} illustration`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#e8eef9] px-3 py-1 text-[11px] font-[800] uppercase tracking-[0.14em] text-[#4b6592]">AI visual</span>
                            {slide.visualApproved ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-[800] text-emerald-700">Approved</span> : null}
                          </div>
                          {visualControls}
                        </div>
                        <div className="mx-auto aspect-[8/5] w-full overflow-hidden rounded-[14px]">
                          {visualMarkup}
                        </div>
                        {visualState?.error ? <p className="mt-2 text-[12px] font-semibold text-red-600">{visualState.error}</p> : null}
                      </div>
                    )}
                    <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em]"
                      style={{ color: "#355fa8" }}>
                      {moduleLabel}
                    </p>
                    <h2 className="mb-5 text-[28px] font-[900] leading-tight"
                      style={{ color: "#123d78" }}>
                      {slide.topicTitle}
                      {slide.topicPartCount && slide.topicPartCount > 1 ? (
                        <span className="ml-3 inline-flex rounded-full bg-[#e8eef9] px-3 py-1 align-middle text-[11px] font-[800] uppercase tracking-[0.14em] text-[#4b6592]">
                          Part {(slide.topicPartIndex || 0) + 1} of {slide.topicPartCount}
                        </span>
                      ) : null}
                    </h2>

                    <div className="space-y-2.5">
                      {safeChartEntries.length > 0 ? (
                        safeChartEntries.map((line, index) => {
                          const isActive = highlightEnabled && isPlaying && highlightSentenceIdx >= 0 && line.sentenceIndex === highlightSentenceIdx;

                          return (
                          <div key={`${line.tone}-${index}`} className="flex items-start gap-3"
                            style={{ animation: `chartLineIn 360ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + index * 55}ms both` }}>
                            <div className="mt-[0.72em] h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: line.tone === "takeaway" ? "#f59e0b" : line.tone === "challenge" ? "#7c3aed" : "#1d4ed8" }}
                            />
                            <p
                              className="font-[700] tracking-[0.01em]"
                              style={{
                                color: isActive
                                  ? activeHighlightPalette.foreground
                                  : line.tone === "takeaway"
                                    ? "#92400e"
                                    : line.tone === "challenge"
                                      ? "#5b21b6"
                                      : line.tone === "lead"
                                        ? "#1e3a8a"
                                        : "#2c5ea5",
                                ...contentTextStyle,
                                ...clampSingleLine,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                transition: "background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
                                ...(isActive
                                  ? {
                                      background: activeHighlightPalette.background,
                                      boxShadow: `inset 4px 0 0 ${activeHighlightPalette.border}`,
                                    }
                                  : {}),
                              }}
                            >
                              {line.text}
                            </p>
                          </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-[14px] font-medium text-[#7c8eb0]">
                            Content for this section will appear after the course has been fully generated.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
                {showSideVisual && (
                  <div className="overflow-hidden rounded-[28px] border p-3 shadow-sm"
                    style={{
                      background: "rgba(255,255,255,0.98)",
                      borderColor: "rgba(148,163,184,0.22)",
                      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
                    }}
                    aria-label={slide.visualAltText || `${slide.topicTitle} illustration`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#e8eef9] px-3 py-1 text-[11px] font-[800] uppercase tracking-[0.14em] text-[#4b6592]">AI visual</span>
                        {slide.visualApproved ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-[800] text-emerald-700">Approved</span> : null}
                      </div>
                      {visualControls}
                    </div>
                    <div className="mx-auto aspect-[8/5] w-full overflow-hidden rounded-[18px]">
                      {visualMarkup}
                    </div>
                    {visualState?.error ? <p className="mt-2 text-[12px] font-semibold text-red-600">{visualState.error}</p> : null}
                  </div>
                )}
                <div
                  className="rounded-[28px] border p-6 shadow-sm"
                  style={{
                    background: "rgba(37,99,235,0.08)",
                    borderColor: "rgba(99,102,241,0.22)",
                    boxShadow: "0 16px 36px rgba(79, 70, 229, 0.08)",
                    animation: "guidePanelIn 480ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both",
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold"
                      style={{ background: "rgba(79,70,229,0.14)", color: "#4f46e5" }}
                    >
                            {trainerBadgeInitial}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold uppercase tracking-[0.16em]" style={{ color: "#4f46e5" }}>
                        {trainerName}'s Guide
                      </p>
                      <p className="text-[12px] font-medium" style={{ color: "#475569" }}>
                        Narrator panel for quick explanation and examples.
                      </p>
                    </div>
                  </div>

                  <AvatarNarrator
                    topic={slide.topicTitle || slide.moduleTitle}
                    moduleContent={narratorExcerpt || `This section explains ${slide.topicTitle || slide.moduleTitle}.`}
                    systemHint="Focus on the practical benefit to an office worker."
                    trainerName={trainerName}
                    avatarImageUrl={avatarImageUrl}
                    avatarVideoUrl={avatarVideoUrl}
                    avatarPosterUrl={avatarPosterUrl}
                    trainerId={selectedTrainer.id}
                    isVoiceActive={isPlaying}
                    isVoiceLoading={audioLoading}
                    
                    currentViseme={activeViseme}
                    narratorLanguage={effectiveNarratorLanguage}
                  />
                </div>

                <div className="rounded-[22px] border border-[#d8e2ef] bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Learning Tools</p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {[
                      { key: "quiz" as const, label: "Quiz", available: !!currentModuleAssessment },
                      { key: "fact" as const, label: "Did You Know", available: !!safeLearnerText(quickFact).trim() },
                      { key: "takeaway" as const, label: "Key Takeaway", available: !!safeLearnerText(parts.takeaway).trim() },
                      { key: "objectives" as const, label: "Objectives", available: lessonObjectives.length > 0 },
                    ].filter((tool) => tool.available).map((tool) => (
                      <button
                        key={tool.key}
                        onClick={() => setActiveLearningTool((prev) => (prev === tool.key ? null : tool.key))}
                        className={`rounded-full border px-3.5 py-1.5 text-[12px] font-[800] transition-all ${
                          activeLearningTool === tool.key
                            ? "border-[#1d4f93] bg-[#eaf2ff] text-[#1d4f93]"
                            : "border-[#d8e2ef] bg-white text-[#4b6592] hover:border-[#9fb6d8]"
                        }`}
                        type="button"
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>

                  {activeLearningTool === "objectives" ? (
                    lessonObjectives.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] p-3.5">
                        <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Learning Objectives</p>
                        <div className="mt-2 space-y-2">
                          {lessonObjectives.map((objective, index) => (
                            <div key={`${objective}-${index}`} className="flex items-start gap-2 text-[13px] text-[#24486f]">
                              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b]" />
                              <span>{objective}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  ) : null}

                  {activeLearningTool === "takeaway" && safeLearnerText(parts.takeaway).trim() ? (
                    <div className="mt-3 rounded-xl border border-[#f3d9a3] bg-[#fffaf3] p-3.5">
                      <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Key Takeaway</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#6f5b35]">{safeLearnerText(parts.takeaway)}</p>
                    </div>
                  ) : null}

                  {activeLearningTool === "fact" && safeLearnerText(quickFact).trim() ? (
                    <div className="mt-3 rounded-xl border border-[#f2d089] bg-[#fff5d6] p-3.5">
                      <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">Did You Know?</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#6f5b35]">{safeLearnerText(quickFact)}</p>
                    </div>
                  ) : null}

                  {activeLearningTool === "quiz" && currentModuleAssessment ? (
                    <div className="mt-3 rounded-xl border border-[#d8e2ef] bg-[#fbfdff] p-3.5">
                      <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">Interactive Quiz</p>
                      <p className="mt-2 text-[14px] font-[800] leading-snug text-[#123d78]">{currentModuleAssessment.question}</p>
                      <div className="mt-2 space-y-1.5">
                        {currentModuleAssessment.options.slice(0, 3).map((option, index) => (
                          <div key={`${option}-${index}`} className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] text-[#35506f]">
                            <span className="mr-2 font-[800] text-[#123d78]">{String.fromCharCode(65 + index)}.</span>
                            {stripOptionPrefix(option)}
                          </div>
                        ))}
                      </div>
                      {currentModuleAssessmentSlide ? (
                        <button
                          onClick={() => navigateToSlide(currentModuleAssessmentSlide.idx)}
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-[#1d4f93] px-3 text-[12px] font-[800] text-white transition-all hover:bg-[#173f78]"
                          type="button"
                        >
                          Open Quiz
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {slide.infographicSvg?.trim() && (
                  <div style={{ animation: "infographicExpandIn 360ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both" }}>
                    <InfographicVisualAid
                      description={slide.infographicSvg}
                      moduleTitle={slide.moduleTitle}
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <span className="rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{ color: "#cbd5e1", background: "rgba(255,255,255,0.08)" }}>
                    Slide {currentSlide + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "assessment": {
        const ans = assessmentAnswers[currentSlide];
        const q = slide.question as any;
        if (!q) return null;

        // If this is a scenario-based assessment, render it with avatar and 2-column layout
        if (slide.contentTemplate === "scenario" && (q.situation || q.scenario)) {
          return (
            <div className="mx-auto max-w-[1280px]" key={currentSlide}>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

                {/* LEFT: scenario content */}
                <div className="rounded-[30px] border border-[#d6e1ef] bg-white p-8 shadow-[0_22px_54px_rgba(15,23,42,0.1)] space-y-6">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Scenario</p>
                      <h2 className="mt-1 text-[32px] font-[900] leading-tight text-[#123d78]">{slide.topicTitle || slide.moduleTitle}</h2>
                    </div>
                  </div>

                  {/* Situation */}
                  <div className="rounded-[22px] bg-[#f3f8fd] border border-[#d8e2ef] p-6">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] mb-3">Situation</p>
                    <p className="text-[18px] leading-relaxed text-[#1a3a5c] font-[500]">
                      {q.situation || q.scenario || "Scenario context"}
                    </p>
                  </div>

                  {/* Options (Responses) */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.14em] text-[#4b6592]">Your Response Options</p>
                    {(q.options || []).map((option: string, optionIdx: number) => {
                      const isCorrect = option === q.best_response || option === q.correct_answer;
                      let style = "border-2 border-slate-200 bg-white hover:border-slate-300";

                      if (ans?.submitted) {
                        if (isCorrect) {
                          style = "border-2 border-emerald-500 bg-emerald-50";
                        } else if (optionIdx === ans.selected) {
                          style = "border-2 border-red-400 bg-red-50";
                        }
                      } else if (ans?.selected === optionIdx) {
                        style = "border-2 border-blue-500 bg-blue-50";
                      }

                      return (
                        <button
                          key={optionIdx}
                          onClick={() => !ans?.submitted && handleSelectAnswer(currentSlide, optionIdx)}
                          disabled={ans?.submitted}
                          className={`w-full px-6 py-4 rounded-lg text-left transition-all ${style} ${ans?.submitted ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${
                              ans?.submitted && isCorrect ? 'bg-emerald-500 text-white' :
                              ans?.submitted && optionIdx === ans.selected ? 'bg-red-400 text-white' :
                              ans?.selected === optionIdx ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {String.fromCharCode(65 + optionIdx)}
                            </div>
                            <div className="flex-1">
                              <p className="text-[16px] font-medium text-slate-900">{option}</p>
                            </div>
                            {ans?.submitted && isCorrect && (
                              <div className="flex-shrink-0 text-emerald-600">
                                <Check className="w-5 h-5" />
                              </div>
                            )}
                            {ans?.submitted && optionIdx === ans.selected && !isCorrect && (
                              <div className="flex-shrink-0 text-red-400">
                                <X className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Rationale/Explanation */}
                  {ans?.submitted && (q.rationale || q.explanation) && (
                    <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-[14px] text-slate-700">
                        <span className="font-semibold text-blue-700">Explanation: </span>
                        {q.rationale || q.explanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT: avatar coach */}
                <div className="xl:sticky xl:top-6 xl:self-start">
                  <AvatarNarrator
                    topic={slide.topicTitle || slide.moduleTitle}
                    moduleContent={q.situation || "Review this scenario carefully."}
                    systemHint="Coach the learner through this scenario response and emphasize the best approach."
                    trainerName={trainerName}
                    avatarImageUrl={avatarImageUrl}
                    avatarVideoUrl={avatarVideoUrl}
                    avatarPosterUrl={avatarPosterUrl}
                    trainerId={selectedTrainer.id}
                    isVoiceActive={isPlaying}
                    isVoiceLoading={audioLoading}
                    currentViseme={activeViseme}
                    narratorLanguage={effectiveNarratorLanguage}
                  />
                </div>
              </div>
            </div>
          );
        }

        // Regular MCQ assessment rendering
        // Clean up question text - remove any answer hints or "Correct Answer:" labels
        let cleanQuestion = q.question || "";
        cleanQuestion = cleanQuestion.replace(/Correct Answer:.*$/gi, '').replace(/Options:.*$/gi, '').trim();

        // Randomize option order each time this question loads (deterministic per question/slide)
        const optionsWithIndices = q.options.map((opt: string, idx: number) => ({ opt, originalIdx: idx }));
        const seed = currentSlide + 12345; // Consistent seed per slide
        const shuffledOptions = [...optionsWithIndices].sort(() => {
          const hash = Math.sin(seed * (optionsWithIndices.indexOf(optionsWithIndices[0]) + 1)) * 10000;
          return hash - Math.floor(hash);
        });

        const getShuffledIndex = (originalIdx: number) => shuffledOptions.findIndex(item => item.originalIdx === originalIdx);

        return (
          <div className="w-full h-full flex flex-col" key={currentSlide}>
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="max-w-[900px] mx-auto">
                {/* Header */}
                <div className="mb-8">
                  <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[12px] font-bold uppercase tracking-wider mb-4">
                    Q{currentSlide + 1}
                  </span>
                  <h2 className="text-[28px] font-bold text-slate-900 leading-relaxed text-left">
                    {cleanQuestion}
                  </h2>
                </div>

                {/* Options */}
                <div className="space-y-4 mb-8">
                  {shuffledOptions.map(({ opt: originalOpt, originalIdx }, displayIdx) => {
                    let style = "border-2 border-slate-200 bg-white hover:border-slate-300 hover:shadow-md";
                    const optClean = stripOptionPrefix(originalOpt);
                    const correctClean = stripOptionPrefix(q.correct_answer || "");

                    if (ans?.submitted) {
                      const isCorrect = optClean === correctClean ||
                        originalOpt === q.correct_answer ||
                        String.fromCharCode(65 + originalIdx) === q.correct_answer ||
                        q.correct_answer?.includes(optClean);
                      if (isCorrect) style = "border-2 border-emerald-500 bg-emerald-50 shadow-md";
                      else if (displayIdx === ans.selected) style = "border-2 border-red-400 bg-red-50";
                    } else if (ans?.selected === displayIdx) {
                      style = "border-2 border-blue-500 bg-blue-50 shadow-md";
                    }

                    return (
                      <button
                        key={displayIdx}
                        onClick={() => !ans?.submitted && handleSelectAnswer(currentSlide, displayIdx)}
                        disabled={ans?.submitted}
                        className={`w-full px-6 py-4 rounded-lg text-left transition-all anim-fade-in-up ${style} ${ans?.submitted ? 'cursor-default' : 'cursor-pointer'}`}
                        style={{ animationDelay: `${0.1 + displayIdx * 0.08}s` }}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${
                            ans?.submitted && (
                              optClean === correctClean || originalOpt === q.correct_answer ||
                              String.fromCharCode(65 + originalIdx) === q.correct_answer ||
                              q.correct_answer?.includes(optClean)
                            ) ? 'bg-emerald-500 text-white' :
                            ans?.submitted && displayIdx === ans.selected ? 'bg-red-400 text-white' :
                            ans?.selected === displayIdx ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {String.fromCharCode(65 + displayIdx)}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[18px] font-medium text-slate-900 leading-relaxed">
                              {stripOptionPrefix(originalOpt)}
                            </p>
                          </div>
                          {ans?.submitted && (
                            optClean === correctClean || originalOpt === q.correct_answer ||
                            String.fromCharCode(65 + originalIdx) === q.correct_answer ||
                            q.correct_answer?.includes(optClean)
                          ) && (
                            <div className="flex-shrink-0 text-emerald-600">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                          {ans?.submitted && displayIdx === ans.selected && !(
                            optClean === correctClean || originalOpt === q.correct_answer ||
                            String.fromCharCode(65 + originalIdx) === q.correct_answer ||
                            q.correct_answer?.includes(optClean)
                          ) && (
                            <div className="flex-shrink-0 text-red-400">
                              <X className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback after submission */}
                {ans?.submitted && q.rationale && (
                  <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-[14px] text-slate-700">
                      <span className="font-semibold text-blue-700">Explanation: </span>
                      {q.rationale}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with button */}
            <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <span>Question {currentSlide + 1} of {totalSlides}</span>
              </div>
              <div className="flex gap-3">
                {ans && !ans.submitted && (
                  <button
                    onClick={() => handleSubmitAnswer(currentSlide)}
                    className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
                  >
                    Submit Answer
                  </button>
                )}
                {ans?.submitted && (
                  <button
                    onClick={goNext}
                    disabled={currentSlide === totalSlides - 1}
                    className="px-6 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {currentSlide === totalSlides - 1 ? "Finish" : "Next Question"}
                  </button>
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
              style={{ background: "#2563EB" }}>
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
                  Next Module -&gt;
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
                <p className="text-[13px] text-white/60 mt-1">{vid.channelTitle} - {durStr}</p>
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
                <p className="text-[11px] text-white/40">Source: YouTube - included for educational purposes</p>
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
    <div ref={previewRootRef} className="fixed inset-0 z-[9999] flex flex-col overflow-hidden p-3 md:p-5 learner-preview-3d" style={{ background: "#DCE6F1" }}>
      <style>
        {`/* ── 3D lift for buttons ─────────────────────────────────────── */
        .learner-preview-3d button {
          box-shadow:
            0 2px 0 rgba(0,0,0,0.10),
            0 4px 8px rgba(0,0,0,0.06),
            inset 0 1px 0 rgba(255,255,255,0.18);
          transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
        }
        .learner-preview-3d button:hover {
          transform: translateY(-1px);
          box-shadow:
            0 4px 2px rgba(0,0,0,0.08),
            0 8px 16px rgba(0,0,0,0.10),
            inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .learner-preview-3d button:active {
          transform: translateY(1px);
          box-shadow:
            0 1px 0 rgba(0,0,0,0.12),
            0 2px 4px rgba(0,0,0,0.06),
            inset 0 2px 4px rgba(0,0,0,0.08);
        }
        /* Slide dots — keep them flat, they're too small for 3D */
        .learner-preview-3d .slide-dot-nav button {
          box-shadow: none !important;
          transform: none !important;
        }

        /* ── 3D lift for cards & panels ─────────────────────────────── */
        .learner-preview-3d [class*="rounded-2xl"][class*="border"],
        .learner-preview-3d [class*="rounded-[2"][class*="border"],
        .learner-preview-3d [class*="rounded-[3"][class*="border"],
        .learner-preview-3d [class*="rounded-xl"][class*="shadow"] {
          box-shadow:
            0 3px 0 rgba(0,0,0,0.06),
            0 6px 14px rgba(0,0,0,0.07),
            inset 0 1px 0 rgba(255,255,255,0.55);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .learner-preview-3d [class*="rounded-2xl"][class*="border"]:hover,
        .learner-preview-3d [class*="rounded-[2"][class*="border"]:hover,
        .learner-preview-3d [class*="rounded-[3"][class*="border"]:hover {
          box-shadow:
            0 5px 2px rgba(0,0,0,0.05),
            0 10px 22px rgba(0,0,0,0.09),
            inset 0 1px 0 rgba(255,255,255,0.60);
        }

        /* ── sidebar cards (dark bg — needs lighter inset) ──────── */
        .learner-preview-3d aside [class*="rounded-2xl"] {
          box-shadow:
            0 3px 0 rgba(0,0,0,0.18),
            0 6px 14px rgba(0,0,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.10);
        }

        /* ── bottom toolbar buttons — stronger 3D ───────────────── */
        .learner-preview-3d .bottom-toolbar button {
          box-shadow:
            0 3px 0 rgba(0,0,0,0.12),
            0 6px 12px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .learner-preview-3d .bottom-toolbar button:active {
          transform: translateY(2px);
          box-shadow:
            0 1px 0 rgba(0,0,0,0.15),
            inset 0 2px 6px rgba(0,0,0,0.10);
        }

        /* BUG FIX #3: Text Alignment Rules */
        .slide-container {
          text-align: left;
          word-wrap: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
        }

        .slide-container p,
        .slide-container h1,
        .slide-container h2,
        .slide-container h3,
        .slide-container h4,
        .slide-container button {
          text-align: left;
          white-space: normal;
        }

        .scenario-text,
        .question-text {
          display: block;
          width: 100%;
          word-break: break-word;
        }

        .page-counter {
          position: absolute;
          bottom: 20px;
          right: 28px;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }

        @keyframes sheetFlipForward {
          0% {
            opacity: 0.8;
            transform: perspective(2200px) rotateX(22deg) translateY(10px) scaleY(0.992);
            transform-origin: top center;
            box-shadow: 0 14px 24px rgba(15, 23, 42, 0.14);
          }
          58% {
            opacity: 0.98;
            transform: perspective(2200px) rotateX(-3deg) translateY(-7px) scaleY(1.005);
            transform-origin: top center;
            box-shadow: 0 8px 14px rgba(15, 23, 42, 0.1);
          }
          82% {
            opacity: 1;
            transform: perspective(2200px) rotateX(1deg) translateY(-1px) scaleY(1.001);
            transform-origin: top center;
            box-shadow: 0 4px 8px rgba(15, 23, 42, 0.06);
          }
          100% {
            opacity: 1;
            transform: perspective(2200px) rotateX(0deg) translateY(0) scaleY(1);
            transform-origin: top center;
            box-shadow: 0 0 0 rgba(15, 23, 42, 0);
          }
        }

        @keyframes sheetFlipBackward {
          0% {
            opacity: 0.8;
            transform: perspective(2200px) rotateX(20deg) translateY(9px) scaleY(0.994);
            transform-origin: top center;
            box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
          }
          56% {
            opacity: 0.98;
            transform: perspective(2200px) rotateX(-2deg) translateY(-6px) scaleY(1.004);
            transform-origin: top center;
            box-shadow: 0 7px 12px rgba(15, 23, 42, 0.08);
          }
          80% {
            opacity: 1;
            transform: perspective(2200px) rotateX(1deg) translateY(-1px) scaleY(1.001);
            transform-origin: top center;
            box-shadow: 0 3px 6px rgba(15, 23, 42, 0.05);
          }
          100% {
            opacity: 1;
            transform: perspective(2200px) rotateX(0deg) translateY(0) scaleY(1);
            transform-origin: top center;
            box-shadow: 0 0 0 rgba(15, 23, 42, 0);
          }
        }

        @keyframes sheetFlipSubtleForward {
          0% {
            opacity: 0.78;
            transform: perspective(1600px) rotateX(18deg) translateY(18px) scale(0.992);
            transform-origin: top center;
          }
          100% {
            opacity: 1;
            transform: perspective(1600px) rotateX(0deg) translateY(0) scale(1);
            transform-origin: top center;
          }
        }

        @keyframes sheetFlipSubtleBackward {
          0% {
            opacity: 0.82;
            transform: perspective(1600px) rotateX(12deg) translateY(12px) scale(0.994);
            transform-origin: top center;
          }
          100% {
            opacity: 1;
            transform: perspective(1600px) rotateX(0deg) translateY(0) scale(1);
            transform-origin: top center;
          }
        }

        @keyframes sheetFlipBoundForward {
          0% {
            opacity: 0.5;
            transform: perspective(2400px) rotateX(84deg) translateY(56px) scaleY(0.93) rotateZ(0.3deg);
            transform-origin: top center;
            box-shadow: 0 32px 56px rgba(15, 23, 42, 0.24);
          }
          48% {
            opacity: 0.96;
            transform: perspective(2400px) rotateX(16deg) translateY(6px) scaleY(1.01) rotateZ(0deg);
            transform-origin: top center;
            box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
          }
          100% {
            opacity: 1;
            transform: perspective(2400px) rotateX(0deg) translateY(0) scaleY(1) rotateZ(0deg);
            transform-origin: top center;
            box-shadow: 0 0 0 rgba(15, 23, 42, 0);
          }
        }

        @keyframes sheetFlipBoundBackward {
          0% {
            opacity: 0.56;
            transform: perspective(2400px) rotateX(72deg) translateY(44px) scaleY(0.95) rotateZ(-0.25deg);
            transform-origin: top center;
            box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
          }
          48% {
            opacity: 0.94;
            transform: perspective(2400px) rotateX(14deg) translateY(5px) scaleY(1.01) rotateZ(0deg);
            transform-origin: top center;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
          }
          100% {
            opacity: 1;
            transform: perspective(2400px) rotateX(0deg) translateY(0) scaleY(1) rotateZ(0deg);
            transform-origin: top center;
            box-shadow: 0 0 0 rgba(15, 23, 42, 0);
          }
        }

        @keyframes flipchartStageGlow {
          0% { opacity: 0.42; transform: scaleY(0.86); }
          100% { opacity: 0; transform: scaleY(1.08); }
        }

        @keyframes chartLineIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes guidePanelIn {
          0% { opacity: 0; transform: translateX(18px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }

        @keyframes infographicExpandIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes infographicZoomIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }`}
      </style>
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[30px] border border-[#c7d6ea] bg-[#edf3f9] shadow-[0_40px_120px_rgba(15,23,42,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-transparent" />

        <aside className="relative hidden w-[260px] shrink-0 flex-col border-r border-[#335f99]/40 bg-[#1d4f93] text-white md:flex">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-white/55">ContentForge LMS</p>
            <p className="mt-1 text-[18px] font-[900] tracking-tight">{courseTitle}</p>
            <p className="mt-1 text-[12px] text-white/65">Structured learner preview with persistent navigation and course utilities.</p>
          </div>

          <div className="px-3 py-4">
            {platformNavItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeSidebarPanel === item.id;
              return (
                <button
                  key={item.label}
                  onClick={() => handleSidebarSelect(item.id)}
                  type="button"
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition-all ${isActive ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" : "text-white/72 hover:bg-white/8 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-4 py-4">
            <div className="mb-4 rounded-2xl bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-white/55">Current Module</p>
              <p className="mt-2 text-[15px] font-[900] leading-snug text-white">{currentModule?.title || "Course Overview"}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
                <div className="h-full rounded-full bg-[#8ec5ff]" style={{ width: `${currentModuleCompletion}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                <span>{currentModuleCompletion}% viewed</span>
                <span>{currentModuleSlides.filter((moduleSlide) => visited.has(moduleSlide.idx)).length}/{currentModuleSlides.length} screens</span>
              </div>
            </div>

            <p className="mb-3 text-[11px] font-[900] uppercase tracking-[0.18em] text-white/48">Lesson Map</p>
            {toc.map((mod, mi) => (
              <div key={mi} className="mb-3 rounded-2xl border border-white/8 bg-white/4 p-2.5">
                <p className={`mb-2 px-2 text-[13px] font-[800] ${slide.moduleIndex === mi ? "text-white" : "text-white/68"}`}>
                  {mod.title}
                </p>
                <div className="space-y-1">
                  {mod.slides.map((s) => (
                    <button
                      key={s.idx}
                      onClick={() => navigateToSlide(s.idx)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] transition-all ${s.idx === currentSlide ? "bg-white text-[#143a6f] shadow-sm" : "text-white/72 hover:bg-white/10 hover:text-white"}`}
                      type="button"
                    >
                      {visited.has(s.idx) && s.idx !== currentSlide ? (
                        <Check className={`h-3 w-3 shrink-0 ${s.idx === currentSlide ? "text-[#143a6f]" : "text-emerald-300"}`} />
                      ) : s.idx === currentSlide ? (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#1d4f93]" />
                      ) : s.type === "video" ? (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#f97316]" />
                      ) : s.type === "assessment" ? (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#fbbf24]" />
                      ) : (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-white/25" />
                      )}
                      <span className="truncate">
                        {s.type === "title" ? "Introduction" :
                          s.type === "assessment" ? "Knowledge Check" :
                          s.type === "summary" ? "Summary" :
                          s.type === "video" ? `Video: ${s.topicTitle?.slice(0, 20) || "Resource"}` :
                          s.topicTitle || `Topic ${(s.topicIndex || 0) + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-4">
            <div className="rounded-2xl bg-white/8 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-[800] text-white">
                  {activeSidebarPanel === "home"
                    ? "Preview Home"
                    : activeSidebarPanel === "progress"
                      ? "Progress Snapshot"
                      : activeSidebarPanel === "objectives"
                        ? "Learning Objectives"
                        : activeSidebarPanel === "notes"
                          ? "Learner Notes"
                          : "Module Resources"}
                </p>
                <HelpCircle className="h-4 w-4 text-white/70" />
              </div>
              {activeSidebarPanel === "home" ? (
                <div className="space-y-3 text-[12px] leading-relaxed text-white/70">
                  <p>This preview is focused on the current learning experience, not LMS-level course browsing.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigateToSlide(0)}
                      className="rounded-full bg-white px-3 py-1.5 text-[11px] font-[800] text-[#123d78] transition-all hover:bg-slate-100"
                      type="button"
                    >
                      Restart Course
                    </button>
                    {currentModuleTitleSlide && currentSlide !== currentModuleTitleSlide.idx ? (
                      <button
                        onClick={() => navigateToSlide(currentModuleTitleSlide.idx)}
                        className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] font-[800] text-white transition-all hover:bg-white/12"
                        type="button"
                      >
                        Module Overview
                      </button>
                    ) : null}
                    {firstContentSlide ? (
                      <button
                        onClick={() => navigateToSlide(firstContentSlide.idx)}
                        className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] font-[800] text-white transition-all hover:bg-white/12"
                        type="button"
                      >
                        {currentSlide === firstContentSlide.idx ? "Current Lesson" : "Start Lesson"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {activeSidebarPanel === "progress" ? (
                <div className="space-y-3 text-[12px] leading-relaxed text-white/70">
                  <div className="rounded-xl bg-white/8 px-3 py-2">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-white/52">Course Completion</p>
                    <p className="mt-1 text-[24px] font-[900] text-white">{courseCompletion}%</p>
                    <p>{visited.size} of {totalSlides} screens viewed.</p>
                  </div>
                  <div className="rounded-xl bg-white/8 px-3 py-2">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-white/52">Current Module</p>
                    <p className="mt-1 text-[18px] font-[900] text-white">{currentModuleCompletion}%</p>
                    <p>{currentModuleSlides.filter((moduleSlide) => visited.has(moduleSlide.idx)).length} of {currentModuleSlides.length} screens viewed.</p>
                  </div>
                  {currentModuleSummarySlide ? (
                    <button
                      onClick={() => navigateToSlide(currentModuleSummarySlide.idx)}
                      className="rounded-full bg-white px-3 py-1.5 text-[11px] font-[800] text-[#123d78] transition-all hover:bg-slate-100"
                      type="button"
                    >
                      Jump to Module Summary
                    </button>
                  ) : null}
                </div>
              ) : null}
              {activeSidebarPanel === "notes" ? (
                <div className="space-y-2">
                  <p className="text-[12px] leading-relaxed text-white/70">These notes are saved locally for this course preview.</p>
                  <textarea
                    value={learnerNotes}
                    onChange={(event) => setLearnerNotes(event.target.value)}
                    placeholder={`Capture takeaways for ${shellPageTitle}...`}
                    className="min-h-[128px] w-full rounded-xl border border-white/14 bg-white/10 px-3 py-2 text-[12px] text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                  />
                </div>
              ) : null}
              {activeSidebarPanel === "objectives" ? (
                <div className="space-y-3 text-[12px] leading-relaxed text-white/70">
                  {currentLessonObjectives.length > 0 ? (
                    <>
                      <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-white/52 mb-3">This lesson covers:</p>
                      <div className="space-y-2">
                        {currentLessonObjectives.map((objective, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-xl bg-white/8 p-3">
                            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8ec5ff]" />
                            <span className="text-white/80">{objective}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-white/60 italic">Learning objectives will appear as you progress through the course.</p>
                  )}
                </div>
              ) : null}
              {activeSidebarPanel === "resources" ? (
                <div className="space-y-3 text-[12px] leading-relaxed text-white/70">
                  <div className="rounded-xl bg-white/8 px-3 py-2">
                    <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-white/52">Current Module Assets</p>
                    <p className="mt-1">{currentModuleVideoCount} video resource{currentModuleVideoCount === 1 ? "" : "s"}</p>
                    <p>{currentModuleVisualCount} visual lesson screen{currentModuleVisualCount === 1 ? "" : "s"}</p>
                    <p>{currentModuleAssessment ? "Knowledge check available" : "No module quiz yet"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentModuleVideoSlide ? (
                      <button
                        onClick={() => navigateToSlide(currentModuleVideoSlide.idx)}
                        className="rounded-full bg-white px-3 py-1.5 text-[11px] font-[800] text-[#123d78] transition-all hover:bg-slate-100"
                        type="button"
                      >
                        Open Video Resource
                      </button>
                    ) : null}
                    {currentModuleAssessmentSlide ? (
                      <button
                        onClick={() => navigateToSlide(currentModuleAssessmentSlide.idx)}
                        className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] font-[800] text-white transition-all hover:bg-white/12"
                        type="button"
                      >
                        Open Quiz
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="relative min-w-0 flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[#31598d] bg-[#1f4f8a] px-5 py-4 text-white md:px-7">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-white/70">
                  <span className="truncate font-[900] text-white">{courseTitle}</span>
                  {currentModule?.title && currentModule.title !== courseTitle ? (
                    <>
                      <span>&gt;</span>
                      <span className="truncate">{currentModule.title}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 text-[18px] font-[900] tracking-tight">{currentModule?.title || shellPageTitle}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Help Button */}
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/14 bg-white/8 px-3 text-[12px] font-[800] text-white/90 transition-all hover:bg-white/14"
                  type="button"
                  title="Help & Support"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>

                {/* Utility menu dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveUtilityPanel(activeUtilityPanel ? null : "discussion")}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/14 bg-white/8 px-3 text-[12px] font-[800] text-white/90 transition-all hover:bg-white/14"
                    title="Tools & Resources"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/14 bg-white/8 px-3 text-[12px] font-[800] text-white/90 transition-all hover:bg-white/14"
                  type="button"
                  title="Exit Preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {activeUtilityPanel && (
            <div className="shrink-0 border-b border-[#d7e1ee] bg-[#f0f5fc] px-6 py-3">
              <div className="mx-auto max-w-[900px]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-[900] uppercase tracking-[0.12em] text-[#3a5a8a]">
                    {activeUtilityPanel === "discussion" ? "Discussion" : activeUtilityPanel === "glossary" ? "Glossary" : "Settings"}
                  </p>
                  <button type="button" onClick={() => setActiveUtilityPanel(null)} className="p-1 text-[#5f7b9e] hover:bg-white/40 hover:text-[#123d78] rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[12px] leading-relaxed text-[#4a6585]">
                  {activeUtilityPanel === "discussion"
                    ? "Discussion threads will be available when the course is published to your LMS. Learners can post questions, reply to peers, and interact with facilitators here."
                    : activeUtilityPanel === "glossary"
                      ? "The glossary will be auto-generated from key terms in the course content once published. Learners can search and browse definitions inline."
                      : "Playback settings such as narration speed, closed captions, font size adjustments, and accessibility preferences will be available in the published course."}
                </p>
              </div>
            </div>
          )}

          <div className="shrink-0 border-b border-[#d7e1ee] bg-white/80 px-4 py-2 backdrop-blur md:px-6">
            <div className="flex gap-4 items-center justify-start text-[12px]">
              <div className="flex items-center gap-1 text-[#5f7b9e]">
                <span className="font-[900]">{currentModuleCompletion}%</span>
                <span className="text-[11px]">Progress</span>
              </div>
              <div className="h-4 w-px bg-[#d8e2ef]"></div>
              <div className="flex items-center gap-1 text-[#5f7b9e]">
                <span className="font-[900]">{currentModuleSlides.filter((moduleSlide) => visited.has(moduleSlide.idx)).length}/{currentModuleSlides.length}</span>
                <span className="text-[11px]">Screens</span>
              </div>
              <div className="h-4 w-px bg-[#d8e2ef]"></div>
              <div className="flex items-center gap-1 text-[#5f7b9e]">
                <span className="font-[900]">{currentModuleObjectiveCount}</span>
                <span className="text-[11px]">Objectives</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#eef3f9] px-5 py-6 md:px-8 md:py-8">
            <div className="mx-auto mb-5 grid max-w-[1260px] gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-[26px] border border-[#d6e1ef] bg-white/88 px-5 py-4 shadow-sm backdrop-blur">
                <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Lesson Context</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#48627f]">
                  <span className="rounded-full bg-[#eef3f8] px-3 py-1 font-semibold">Module {slide.moduleIndex + 1}</span>
                  <span className="rounded-full bg-[#eef3f8] px-3 py-1 font-semibold">Screen {currentSlide + 1} of {totalSlides}</span>
                  <span className="rounded-full bg-[#eef3f8] px-3 py-1 font-semibold">Estimated {courseDurationMinutes}</span>
                </div>
              </div>
              <div className="rounded-[26px] border border-[#d6e1ef] bg-white/88 px-5 py-4 shadow-sm backdrop-blur">
                <p className="text-[11px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">Learning Objectives</p>
                <div className="mt-3 space-y-2">
                  {(currentModuleTopics.length > 0 ? currentModuleTopics : currentModule?.topics || []).slice(0, 3).map((topic, index) => (
                    <div key={`${topic}-${index}`} className="flex items-start gap-2 text-[13px] text-[#24486f]">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b]" />
                      <span>{topic}</span>
                    </div>
                  ))}
                  {currentModuleTopics.length === 0 && !(currentModule?.topics || []).length && (
                    <p className="text-[13px] text-[#6a809c]">Objectives will appear once topic structure is available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="relative mx-auto max-w-[1280px] [perspective:2200px]">
              {showStageGlow && (
                <div
                  className="pointer-events-none absolute inset-x-10 top-10 z-0 h-24 rounded-full blur-3xl"
                  style={{
                    background: "rgba(148,163,184,0.24)",
                    animation: "flipchartStageGlow 520ms ease-out both",
                  }}
                />
              )}
              {showBinding && (
                <div className="pointer-events-none absolute inset-x-12 top-1 z-20 hidden md:block">
                  <div className="mx-auto h-2 max-w-[980px] rounded-full bg-white/25" />
                  <div className="mx-auto mt-1 flex max-w-[900px] items-center justify-between px-10">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-6 w-4 rounded-b-full border-2 border-slate-300/80 border-t-0 bg-transparent"
                        style={{ boxShadow: "0 2px 4px rgba(15,23,42,0.12)" }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div
                className="relative z-10 [transform-style:preserve-3d]"
                style={{
                  animation: slideAnimationName
                    ? `${slideAnimationName} ${slideAnimationDuration}ms cubic-bezier(0.2, 0.88, 0.24, 1)`
                    : undefined,
                  transformOrigin: "top center",
                  willChange: slideMotion ? "transform, opacity" : undefined,
                }}
              >
                {renderSlide()}
              </div>
              <div className="pointer-events-none absolute bottom-[-18px] left-1/2 z-0 h-10 w-[82%] -translate-x-1/2 rounded-full bg-black/15 blur-2xl" />
              <div className="pointer-events-none absolute bottom-[-26px] left-1/2 z-0 h-6 w-[68%] -translate-x-1/2 rounded-full bg-black/20 blur-3xl" />
            </div>
          </div>

          <div className="bottom-toolbar shrink-0 border-t border-[#d7e1ee] bg-white/90 px-5 py-4 backdrop-blur md:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <button
                onClick={goPrev}
                disabled={currentSlide === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#c9d8ea] bg-white px-5 text-[14px] font-semibold text-[#123d78] transition-all hover:bg-[#f7fbff] disabled:opacity-40"
                type="button"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              <div className="flex flex-col items-center gap-2">
                <div className="slide-dot-nav flex items-center gap-1.5">
                  {currentModuleSlides.map((s) => (
                    <button
                      key={s.idx}
                      onClick={() => navigateToSlide(s.idx)}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${s.idx === currentSlide ? "scale-125 bg-[#1d4f93]" : visited.has(s.idx) ? "bg-[#8ba8c9]" : "bg-[#d5deea]"}`}
                      type="button"
                    />
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-[#5f7b9e]">Slide {currentSlide + 1} of {totalSlides} - Score {score.correct}/{score.total || 0}</span>
              </div>

              <div className="flex items-center gap-2.5 self-end lg:self-auto">
                {/* Notes */}
                <button
                  onClick={() => setActiveSidebarPanel(activeSidebarPanel === "notes" ? "home" : "notes")}
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all ${activeSidebarPanel === "notes" ? "border-[#1d4f93] bg-[#eef4ff] text-[#1d4f93]" : "border-[#c9d8ea] bg-white text-[#123d78] hover:bg-[#f7fbff]"}`}
                  type="button"
                  aria-label="Notes"
                >
                  <NotebookPen className="h-5 w-5" />
                  <span>Notes</span>
                </button>

                {/* Quiz */}
                <button
                  onClick={() => {
                    if (currentModuleAssessmentSlide) {
                      navigateToSlide(currentModuleAssessmentSlide.idx);
                    } else {
                      setActiveLearningTool(activeLearningTool === "quiz" ? null : "quiz");
                    }
                  }}
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all ${activeLearningTool === "quiz" || slide.type === "assessment" ? "border-[#1d4f93] bg-[#eef4ff] text-[#1d4f93]" : "border-[#c9d8ea] bg-white text-[#123d78] hover:bg-[#f7fbff]"}`}
                  type="button"
                  aria-label="Quiz"
                >
                  <HelpCircle className="h-5 w-5" />
                  <span>Quiz</span>
                </button>

                {/* Explain */}
                {currentNarration && !hasAvatarVideoNarration ? (
                  <button
                    onClick={() => {
                      if (audioLoading) return;
                      const cachedUrl = audioUrlsRef.current[currentSlide];
                      if (audioRef.current && isPlaying) {
                        audioRef.current.pause();
                        return;
                      }
                      // If we already have a cached URL for this slide, (re)create the element and play it.
                      if (cachedUrl) {
                        const audio = new Audio(cachedUrl);
                        wireAudio(audio);
                        audio.play().catch(() => {
                          // Autoplay/playback blocked — try a fresh fetch as fallback
                          void playNarration();
                        });
                        return;
                      }
                      void playNarration();
                    }}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all ${isPlaying ? "border-[#1d4f93] bg-[#eef4ff] text-[#1d4f93]" : "border-[#c9d8ea] bg-white text-[#123d78] hover:bg-[#f7fbff]"}`}
                    type="button"
                    aria-label={audioLoading ? "Loading…" : isPlaying ? "Pause" : "Explain"}
                  >
                    {audioLoading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-[#123d78]/30 border-t-[#123d78] animate-spin" />
                    ) : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    <span>{audioLoading ? "Loading…" : isPlaying ? "Pause" : "Explain"}</span>
                  </button>
                ) : null}

                {/* Voiceover toggle + language */}
                {currentNarration && (
                  <div className="inline-flex items-center gap-2 rounded-xl border-2 px-2 py-1 transition-all"
                    style={{
                      borderColor: muted ? "#c9d8ea" : "#1d4f93",
                      backgroundColor: muted ? "white" : "#eef4ff"
                    }}>
                    <button
                      onClick={handleToggleVoiceover}
                      className="inline-flex items-center gap-2 px-2 h-10 rounded-lg text-[12px] font-semibold transition-all"
                      style={{
                        color: muted ? "#123d78" : "#1d4f93",
                        backgroundColor: muted ? "transparent" : "#fff"
                      }}
                      type="button"
                      aria-label={muted ? "Turn voiceover on" : "Turn voiceover off"}
                      title={muted ? "Click to enable voice narration" : "Click to disable voice narration"}
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-5 w-5 text-blue-600" />}
                      <span className="font-bold">{muted ? "Voice Off" : "Voice On"}</span>
                    </button>
                    <select
                      value={previewNarrationLanguage}
                      onChange={(e) => setPreviewNarrationLanguage(e.target.value)}
                      className="h-9 rounded-lg border border-[#e3ecf8] bg-white px-2 text-[12px] text-[#123d78] focus:outline-none focus:border-[#1d4f93]"
                      title="Select narration language"
                      aria-label="Narration language"
                    >
                      {["English","Hindi","Spanish","French","German","Italian","Portuguese","Polish","Turkish","Russian","Dutch","Czech","Arabic","Chinese","Japanese","Korean","Hungarian","Norwegian","Finnish","Swedish","Danish","Bulgarian","Romanian","Greek","Filipino","Indonesian","Malay","Slovak","Ukrainian","Croatian","Tamil"].map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleToggleFullscreen}
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all ${isFullscreen ? "border-[#1d4f93] bg-[#eef4ff] text-[#1d4f93]" : "border-[#c9d8ea] bg-white text-[#123d78] hover:bg-[#f7fbff]"}`}
                  type="button"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  <span>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
                </button>



                <button
                  onClick={goNext}
                  disabled={currentSlide === totalSlides - 1 || isAssessmentLocked(currentSlide)}
                  title={isAssessmentLocked(currentSlide) ? "Answer the question to continue" : undefined}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1d4f93] px-6 text-[14px] font-semibold text-white transition-all hover:bg-[#173f78] disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  Next <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <PreviewActionBar
        highlightEnabled={highlightEnabled}
        highlightPalette={highlightPalette}
        flipStyle={flipStyle}
        onToggleHighlight={() => setHighlightEnabled(prev => !prev)}
        onSelectPalette={setHighlightPalette}
        onSelectFlipStyle={setFlipStyle}
        onPlaceVideos={unassignedCount > 0 ? () => setShowPlacer(true) : undefined}
        unassignedCount={unassignedCount}
      />

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
};

