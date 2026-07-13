/**
 * Shared slide building logic for both LearnerPreview and SCORM export
 * This utility extracts the common slide construction logic so both systems
 * can produce identical output
 */

import type { RawAgentOutputs } from "@/types/agents";
import { InsertedVideo } from "@/components/contentforge/VideosTab";
import { stripNarratorMarkdown, isPlaceholderToken } from "@/lib/textCleaningUtility";

/* Types */

export interface Module {
  title: string;
  topics: string[];
}

export type SlideType = "title" | "content" | "assessment" | "summary" | "video" | "narrative-flipbook";

export type ContentTemplate = "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel";

export type AssessmentIntensity = "light" | "standard" | "deep";

export interface Slide {
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
  narrative?: any;
}

type SlideContentChunk = {
  text: string;
  wasTrimmed: boolean;
};

/* Helper Functions */

export function tryParseJSON(raw: string | undefined | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function normalizeModuleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

export function buildFallbackInfographicText(module: Module): string {
  const topics = module.topics.filter(Boolean).slice(0, 3);
  if (topics.length === 0) {
    return `A visual summary for ${module.title} showing the core learning flow and main learner decisions.`;
  }
  return `A structured visual for ${module.title} connecting ${topics.join(", ")} into one learner-friendly concept map.`;
}

export function getInfographicDescription(visualModule: any, module: Module): string {
  const candidate = [
    visualModule?.infographic_description,
    visualModule?.infographic,
    visualModule?.visual_aid,
    visualModule?.diagram_description,
    visualModule?.slide_layout,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return candidate?.trim() || buildFallbackInfographicText(module);
}

export function getDurationMinutes(duration?: string): number {
  const parsed = Number.parseInt(duration || "15", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

export function splitParagraphIntoSentenceChunks(paragraph: string, targetWordsPerChunk: number): string[] {
  const normalized = paragraph.trim();
  if (!normalized) return [];

  const sentences =
    normalized.match(/[^.!?]+[.!?]+[\])"'`]*|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [normalized];
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

export function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ").trim()}...`;
}

export function isTruncatedByWordLimit(text: string, maxWords: number): boolean {
  return text.split(/\s+/).filter(Boolean).length > maxWords;
}

export function splitTopicContentIntoSlides(text: string, durationMinutes: number, maxLines = 10): SlideContentChunk[] {
  const lines = text
    .split("\n")
    .filter((line) => !line.match(/^#{1,3}\s/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.match(/^[-*#]+$/));
  const paragraphs = lines
    .join("\n")
    .trim()
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    const fallback = text.trim();
    return fallback ? [{
      text: truncateToWordLimit(fallback, Math.max(36, maxLines * 9)),
      wasTrimmed: isTruncatedByWordLimit(fallback, Math.max(36, maxLines * 9)),
    }] : [];
  }

  const maxChunksPerTopic =
    durationMinutes <= 2
      ? 2
      : durationMinutes <= 3
        ? 2
        : durationMinutes <= 5
          ? 2
          : durationMinutes <= 10
            ? 3
            : durationMinutes <= 20
              ? 4
              : durationMinutes <= 45
                ? 5
                : 6;

  const targetWordsByDuration =
    durationMinutes <= 5 ? 70 : durationMinutes <= 10 ? 85 : durationMinutes <= 20 ? 100 : 115;
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
  return fallback ? [{
    text: truncateToWordLimit(fallback, lineBudgetWordLimit),
    wasTrimmed: isTruncatedByWordLimit(fallback, lineBudgetWordLimit),
  }] : [];
}

export function getTopicVisual(moduleVisual: any, topicTitle: string) {
  if (!moduleVisual) return undefined;

  let topicVisuals = Array.isArray(moduleVisual?.topic_visuals) ? moduleVisual.topic_visuals : [];
  if (topicVisuals.length === 0) {
    topicVisuals = Array.isArray(moduleVisual?.topics) ? moduleVisual.topics : [];
  }
  if (topicVisuals.length === 0) {
    topicVisuals = Array.isArray(moduleVisual?.visuals) ? moduleVisual.visuals : [];
  }

  const normalizedTopic = normalizeModuleKey(topicTitle);
  const visual = topicVisuals.find((visual: any) => {
    const candidateTitle = visual?.topic_title || visual?.title || visual?.name || "";
    return candidateTitle && normalizeModuleKey(candidateTitle) === normalizedTopic;
  });

  if (!visual) {
    if (topicVisuals.length > 0) {
      console.warn(`[Visual Matching] Could not find visual for topic "${topicTitle}". Available topics:`,
        topicVisuals.map((v: any) => ({
          title: v?.topic_title || v?.title || v?.name,
          hasImage: !!v?.generated_image_data_url || !!v?.imageDataUrl,
          hasSvg: !!v?.generated_scene_svg || !!v?.sceneSvg,
        }))
      );
    } else {
      console.warn(`[Visual Matching] No topic_visuals array found for "${topicTitle}"`);
    }

    if (topicVisuals.length === 1 && !topicVisuals[0]?.topic_title && !topicVisuals[0]?.title) {
      console.debug(`[Visual Matching] Fallback: using first visual for "${topicTitle}"`);
      return topicVisuals[0];
    }
  }

  return visual;
}

export function getTargetCourseQuestionCount(durationMinutes: number, intensity: AssessmentIntensity): number {
  const base =
    durationMinutes <= 5
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

export function allocateQuestionsPerModule(modules: Module[], totalQuestions: number): number[] {
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

export function findModuleMatchedQuestionIndexes(mcqs: any[], module: Module): number[] {
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

export function normalizeSvg(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const hasPreserveAspectRatio = /preserveAspectRatio=/i.test(attrs);
    const cleanedAttrs = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");

    return `<svg${cleanedAttrs} width="100%" height="100%" style="display:block;width:100%;height:100%;"${
      hasPreserveAspectRatio ? "" : ' preserveAspectRatio="xMidYMid meet"'
    }>`;
  });
}

/**
 * Main slide builder - constructs slides from raw agent outputs
 * Used by both LearnerPreview and SCORM export to ensure consistency
 */
export function buildSlides(
  rawOutputs: RawAgentOutputs,
  insertedVideos: InsertedVideo[] = [],
  courseDuration?: string,
  maxLines = 10,
  assessmentIntensity: AssessmentIntensity = "standard"
): { modules: Module[]; slides: Slide[] } {
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
        typeof t === "string"
          ? t
          : t.topic_name || t.topic_title || t.title || t.name || `Module ${mi + 1} - Part ${ti + 1}`
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

  if (visualData && Object.keys(visualData).length > 0) {
    console.log("Visual agent data available. Structure:", {
      hasModules: !!visualData.modules,
      hasVisualPlan: !!visualData.course_visual_plan,
      hasModuleVisuals: !!visualData.module_visuals,
      visualModulesCount: visualModules.length,
    });
  } else {
    console.warn("No visual agent data found in rawOutputs.visual");
  }

  // Build slides
  const slides: Slide[] = [];

  // Parse writer content into topic sections
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
    const keys = [
      "content",
      "body",
      "text",
      "narrative",
      "narration",
      "script",
      "lesson_content",
      "on_screen_text",
      "screen_text",
      "description",
      "explanation",
    ];
    for (const k of keys) {
      const val = v[k];
      if (typeof val === "string") {
        const c = cleanBody(val);
        if (c) return c;
      }
      if (Array.isArray(val)) {
        const joined = val.map((it) => (typeof it === "string" ? it : extractObjBody(it))).filter(Boolean).join("\n\n");
        const c = cleanBody(joined);
        if (c) return c;
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
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index || normalizedWriter.length : normalizedWriter.length;
    pushSection(stripNarratorMarkdown(hm[2]).trim(), normalizedWriter.slice(start, end));
  });

  let topicCounter = 0;

  modules.forEach((mod, mi) => {
    const matchedVisualModule =
      visualModules.find((vm: any) => {
        const moduleTitle = vm?.module_title || vm?.title || vm?.name || "";
        return moduleTitle && normalizeModuleKey(moduleTitle) === normalizeModuleKey(mod.title);
      }) || visualModules[mi];

    const infographicDescription = getInfographicDescription(matchedVisualModule, mod);

    // 1. Title slide - first module only
    if (mi === 0) {
      slides.push({ type: "title", moduleIndex: mi, moduleTitle: mod.title });
    }

    // 2. Content slides
    mod.topics.forEach((topic, ti) => {
      const topicKey = topic.toLowerCase();
      let sectionText = writerSections[topicKey] || "";
      if (!sectionText) {
        for (const [k, v] of Object.entries(writerSections)) {
          if (k.length > 4 && (k.includes(topicKey) || topicKey.includes(k))) {
            sectionText = v;
            break;
          }
        }
      }
      if (!sectionText) sectionText = orderedTopicBodies[topicCounter] || "";
      if (!sectionText) sectionText = "";

      let narrativeForTopic = null;
      if (narrativeScenesData) {
        const narratives = Array.isArray(narrativeScenesData) ? narrativeScenesData : [narrativeScenesData];
        const normalizedTopic = normalizeModuleKey(topic);

        narrativeForTopic = narratives.find((n: any) => normalizeModuleKey(n.topicTitle || "") === normalizedTopic);

        if (!narrativeForTopic && topicCounter < narratives.length) {
          const fallback = narratives[topicCounter];
          if (fallback && Array.isArray(fallback.scenes) && fallback.scenes.length > 0) {
            narrativeForTopic = fallback;
          }
        }
      }

      // If narrative scenes exist, create flipbook slide
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
        // Fallback to content chunks
        const contentChunks = splitTopicContentIntoSlides(sectionText, durationMinutes, maxLines);
        const topicVisual = getTopicVisual(matchedVisualModule, topic);

        let generatedImageDataUrl: string | undefined;
        let generatedSceneSvg: string | undefined;

        if (topicVisual) {
          const imageUrl =
            topicVisual.generated_image_data_url || topicVisual.imageDataUrl || topicVisual.image_url || topicVisual.dataUrl;
          if (typeof imageUrl === "string" && imageUrl.trim().length > 0) {
            generatedImageDataUrl = imageUrl;
          }

          const svgContent = topicVisual.generated_scene_svg || topicVisual.sceneSvg || topicVisual.svg;
          if (typeof svgContent === "string" && svgContent.trim().length > 0) {
            generatedSceneSvg = normalizeSvg(svgContent);
          }
        }

        const screenTemplate =
          topicVisual?.screen_template === "dashboard" ||
          topicVisual?.screen_template === "guided-notes" ||
          topicVisual?.screen_template === "scenario" ||
          topicVisual?.screen_template === "media-quiz" ||
          topicVisual?.screen_template === "summary-panel"
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

    // 3. Assessment slides
    const desiredQuestionCount = questionsPerModule[mi] || 0;
    if (desiredQuestionCount > 0) {
      const moduleMatchedIndexes = findModuleMatchedQuestionIndexes(mcqs, mod).filter(
        (questionIndex) => !usedQuestionIndexes.has(questionIndex)
      );
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

    // 3b. Insert video slides
    const modVideos = insertedVideos.filter((v) => {
      const assigned = (v.moduleTitle || "").trim();
      if (!assigned) return false;
      return normalizeModuleKey(assigned) === normalizeModuleKey(mod.title);
    });

    modVideos.forEach((vid) => {
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
