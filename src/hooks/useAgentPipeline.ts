import { useState, useCallback, useRef } from "react";
import { AgentInfo, AgentStatus, AGENTS, OutputData, RawAgentOutputs } from "@/types/agents";
import { supabase } from "@/integrations/supabase/client";

type SlideLayoutParams = {
  maxLines?: number;
  minFontSize?: number;
  lineSpacing?: number;
};

type AssessmentIntensity = "light" | "standard" | "deep";

type AssessmentTargets = {
  mcqCount: number;
  scenarioCount: number;
  interactionMin: number;
  interactionMax: number;
};

type TopicDurationPlan = {
  topicTitle: string;
  targetWords: number;
  wordRange: string;
};

type ModuleDurationPlan = {
  moduleTitle: string;
  targetMinutes: number;
  targetWords: number;
  topicCount: number;
  topicWordRange: string;
  topics: TopicDurationPlan[];
};

const NARRATION_WORDS_PER_MINUTE = 130;

function parseDurationMinutes(duration?: string): number {
  const parsed = Number.parseInt(duration || "15", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function getStructureGuidance(durationMinutes: number): string {
  if (durationMinutes <= 3) return "1 focused module with 2-3 topics total.";
  if (durationMinutes <= 5) return "1-2 modules with 3-4 topics total.";
  if (durationMinutes <= 10) return "2-3 modules with 5-7 topics total.";
  if (durationMinutes <= 15) return "3-4 modules with 7-10 topics total.";
  if (durationMinutes <= 20) return "4-5 modules with 10-12 topics total.";
  if (durationMinutes <= 30) return "5-6 modules with 14-18 topics total.";
  if (durationMinutes <= 45) return "6-7 modules with 18-24 topics total.";
  return "7-8 modules with 24-30 topics total.";
}

type LevelCalibration = {
  label: string;
  bloomsTarget: string;
  vocabularyGuidance: string;
  scenarioComplexity: string;
  contentDepth: string;
  assessmentStyle: string;
  prerequisiteAssumption: string;
};

function getLevelCalibration(level?: string): LevelCalibration {
  const l = (level || "intermediate").toLowerCase();

  if (l === "basic" || l === "beginner" || l === "foundation") {
    return {
      label: "Basic",
      bloomsTarget: "Remember and Understand (Bloom's levels 1–2). Use verbs like define, identify, describe, list, explain. Every concept is introduced from scratch — no assumed prior knowledge.",
      vocabularyGuidance: "Plain, accessible language only. Define every piece of jargon or technical term the first time it appears. Use everyday analogies to make abstract ideas concrete. Avoid acronyms unless immediately defined.",
      scenarioComplexity: "Simple, single-factor situations with clear right and wrong responses. No ambiguity. The learning challenge is recognition and recall, not judgment.",
      contentDepth: "Prioritise breadth over depth. Cover essential concepts clearly without expert nuance or edge cases. The goal is confident awareness and foundational understanding.",
      assessmentStyle: "Questions test recall and basic comprehension. Wrong options should be clearly incorrect — not subtle traps. Focus on 'what is', 'which of these', and 'true or false' style questions.",
      prerequisiteAssumption: "Assume zero prior knowledge of this topic. Build from first principles. Explain why the topic matters before explaining what it is.",
    };
  }

  if (l === "advanced" || l === "expert" || l === "mastery") {
    return {
      label: "Advanced",
      bloomsTarget: "Evaluate and Create (Bloom's levels 5–6). Use verbs like evaluate, critique, justify, design, synthesise, recommend. Learners should be challenged to make high-stakes judgment calls and defend positions.",
      vocabularyGuidance: "Expert-level terminology without definition. Assume domain fluency. Language should be strategic, precise, and peer-to-expert in tone — the kind used between senior practitioners. Challenge, provoke, and surface tensions in conventional thinking.",
      scenarioComplexity: "Genuinely ambiguous situations with competing valid priorities and no obvious correct answer. Require weighing trade-offs, navigating systemic constraints, or handling political complexity. Surface edge cases and conditions under which standard advice breaks down.",
      contentDepth: "Depth over breadth. Prioritise nuance, expert insight, and contrarian perspectives. Challenge assumptions. Surface the conditions under which common approaches fail. The goal is mastery and independent judgment.",
      assessmentStyle: "Questions require analysis, synthesis, and judgment — not recall. Distractors should represent plausible expert mistakes or reasonable alternative framings. Use 'which is the BEST approach given…' and 'what is the PRIMARY risk of…' formats.",
      prerequisiteAssumption: "Assume a solid working foundation. Skip definitions of standard domain terms. Build directly on established competence and push into nuanced territory.",
    };
  }

  // Default: Intermediate
  return {
    label: "Intermediate",
    bloomsTarget: "Apply and Analyse (Bloom's levels 3–4). Use verbs like apply, demonstrate, classify, compare, differentiate, explain in context. Learners should connect concepts to real situations.",
    vocabularyGuidance: "Standard professional and domain terminology. Briefly explain specialist terms that may not be universally known, but do not over-define common vocabulary. Assume basic workplace literacy.",
    scenarioComplexity: "Realistic workplace situations with competing priorities and some ambiguity. The challenge is applying the right principle in context, not just recalling it. Include moments where two reasonable people might disagree.",
    contentDepth: "Balance concept explanation with practical application. Cover key nuances without going into edge-case complexity. The goal is confident, transferable competence.",
    assessmentStyle: "Questions test application and analysis. Include nuanced distractors that represent common misconceptions or partially correct thinking. Mix 'how would you' and 'why does this happen' formats.",
    prerequisiteAssumption: "Assume basic familiarity with the domain. Standard terms can be used without full definition, but reinforce foundational ideas as context, not instruction.",
  };
}

function getSophisticationGuidance(durationMinutes: number, level?: string): string {
  const cal = getLevelCalibration(level);
  const durationBase = durationMinutes <= 5
    ? "Even in a short course, include at least one tension point, one concrete workplace scenario, and one memorable decision or behavior shift."
    : durationMinutes <= 15
    ? "Each module should have a clear promise, realistic scenario context, a practical framework, and at least one contrast between weak and strong practice."
    : durationMinutes <= 30
    ? "Build a polished learning journey with escalating complexity, multiple scenario moments, strong transitions, and a balance of explanation, demonstration, and application."
    : "Treat the experience like premium corporate learning: layered module arcs, realistic decision points, recurring themes, practical frameworks, and varied instructional treatments that avoid repetition.";
  return `${durationBase} LEVEL (${cal.label}): ${cal.contentDepth} Bloom's target: ${cal.bloomsTarget} Prerequisite assumption: ${cal.prerequisiteAssumption}`;
}

function getInstructionalPatternGuidance(durationMinutes: number, level?: string): string {
  const cal = getLevelCalibration(level);
  const durationBase = durationMinutes <= 10
    ? "Use a mix of scenario opener, concept explanation, and practical behavior shift. Avoid making every topic feel identical."
    : durationMinutes <= 20
    ? "Vary topic treatments across scenario walkthroughs, myth-vs-reality reframes, process demos, good-vs-bad contrasts, and concise action checklists."
    : "Intentionally vary the instructional pattern across modules: case study, decision-point analysis, process walkthrough, manager coaching moment, customer scenario, misconception reset, and practical checklist.";
  return `${durationBase} Scenario complexity for this level: ${cal.scenarioComplexity} Vocabulary guidance: ${cal.vocabularyGuidance}`;
}

function getAssessmentLevelGuidance(level?: string): string {
  return getLevelCalibration(level).assessmentStyle;
}

function getAssessmentTargets(
  durationMinutes: number,
  intensity: AssessmentIntensity,
  moduleCount: number,
  topicCount: number
): AssessmentTargets {
  const baseMcq = durationMinutes <= 5
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
  const intensityMultiplier: Record<AssessmentIntensity, number> = {
    light: 0.75,
    standard: 1,
    deep: 1.3,
  };
  const moduleCoverageFloor = Math.min(Math.max(1, moduleCount), 8);
  const topicCap = Math.max(moduleCoverageFloor, Math.min(24, Math.ceil(Math.max(topicCount, moduleCount) * 1.1)));
  const mcqCount = Math.min(
    topicCap,
    Math.max(moduleCoverageFloor, Math.max(2, Math.round(baseMcq * intensityMultiplier[intensity])))
  );

  const baseScenarios = durationMinutes <= 10 ? 1 : durationMinutes <= 20 ? 2 : durationMinutes <= 45 ? 3 : 4;
  const scenarioCount = Math.min(6, Math.max(1, baseScenarios + (intensity === "deep" ? 1 : 0)));
  const interactionMin = Math.max(4, Math.round(mcqCount * 0.5));
  const interactionMax = Math.max(interactionMin + 2, Math.min(12, Math.round(mcqCount * 0.9) + scenarioCount));

  return { mcqCount, scenarioCount, interactionMin, interactionMax };
}

function buildSlideLayoutInstruction(slideLayout?: SlideLayoutParams): string {
  const maxLines = slideLayout?.maxLines ?? 10;
  const minFontSize = slideLayout?.minFontSize ?? 12.5;
  const lineSpacing = slideLayout?.lineSpacing ?? 2;

  return `Slide readability constraints: no slide should exceed ${maxLines} lines of on-slide text, the minimum font size must be ${minFontSize}px, and line spacing should be ${lineSpacing}. Keep layouts concise and presentation-friendly.`;
}

function countWords(text: string): number {
  return (text.match(/\b[\w'’-]+\b/g) || []).length;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function getDurationToleranceMinutes(targetMinutes: number): number {
  return Math.max(0.75, Math.round(targetMinutes * 0.12 * 10) / 10);
}

function buildDurationPlan(architectRaw: string, targetMinutes: number, targetWords: number): ModuleDurationPlan[] {
  const parsed = tryParseJson(architectRaw) || {};
  const modules = parsed.modules || parsed.course_structure?.modules || parsed.course_modules || [];

  if (!Array.isArray(modules) || modules.length === 0) {
    return [];
  }

  const provisional = modules.map((module: any, moduleIndex: number) => {
    const topics = Array.isArray(module?.topics)
      ? module.topics
      : Array.isArray(module?.sections)
        ? module.sections
        : Array.isArray(module?.lessons)
          ? module.lessons
          : [];

    const topicCount = Math.max(1, topics.length || 0);
    const estimatedMinutes = safeNumber(module?.estimated_minutes) ?? topicCount;

    return {
      moduleTitle: module?.module_title || module?.title || module?.name || `Module ${moduleIndex + 1}`,
      topics,
      topicCount,
      estimatedMinutes,
    };
  });

  const totalEstimated = provisional.reduce((sum, module) => sum + module.estimatedMinutes, 0) || provisional.length;
  const normalizedMinutes = provisional.map((module) => {
    const weightedMinutes = (module.estimatedMinutes / totalEstimated) * targetMinutes;
    return Math.max(0.75, weightedMinutes);
  });

  const normalizedMinuteTotal = normalizedMinutes.reduce((sum, value) => sum + value, 0) || targetMinutes;

  return provisional.map((module, moduleIndex) => {
    const targetMinutesForModule = (normalizedMinutes[moduleIndex] / normalizedMinuteTotal) * targetMinutes;
    const targetWordsForModule = Math.max(120, Math.round((targetMinutesForModule / targetMinutes) * targetWords));
    const targetWordsPerTopic = Math.max(95, Math.round(targetWordsForModule / module.topicCount));
    const topicWordRange = `${Math.max(95, Math.floor(targetWordsPerTopic * 0.9))}-${Math.max(110, Math.ceil(targetWordsPerTopic * 1.12))}`;

    const topics = module.topics.length > 0
      ? module.topics.map((topic: any, topicIndex: number) => {
          const topicTitle = typeof topic === "string"
            ? topic
            : topic?.topic_title || topic?.title || topic?.name || `Topic ${topicIndex + 1}`;

          return {
            topicTitle,
            targetWords: targetWordsPerTopic,
            wordRange: topicWordRange,
          };
        })
      : [{ topicTitle: "Core Content", targetWords: targetWordsPerTopic, wordRange: topicWordRange }];

    return {
      moduleTitle: module.moduleTitle,
      targetMinutes: Math.round(targetMinutesForModule * 10) / 10,
      targetWords: targetWordsForModule,
      topicCount: module.topicCount,
      topicWordRange,
      topics,
    };
  });
}

function findModuleDurationPlan(durationPlan: ModuleDurationPlan[], moduleTitle: string, moduleIndex: number): ModuleDurationPlan | undefined {
  const normalizedTitle = normalizeTextKey(moduleTitle);
  return durationPlan.find((module, index) => index === moduleIndex || normalizeTextKey(module.moduleTitle) === normalizedTitle);
}

function summarizeDurationPlan(durationPlan: ModuleDurationPlan[]): string {
  if (durationPlan.length === 0) return "No module duration plan available.";

  return durationPlan
    .map((module) => {
      const topicSummary = module.topics
        .map((topic) => `${topic.topicTitle}: ${topic.wordRange} words`)
        .join(" | ");
      return `${module.moduleTitle} -> ${module.targetMinutes} min, ~${module.targetWords} words. Topics: ${topicSummary}`;
    })
    .join("\n");
}

function normalizeTextKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function tryParseJson(raw: string): any | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fencedMatch) return null;

    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      return null;
    }
  }
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractFallbackTopicCandidates(inputText: string): string[] {
  const lines = inputText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 12);

  const sentenceCandidates = inputText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 96);

  const merged = [...lines, ...sentenceCandidates];
  const seen = new Set<string>();
  const normalized = merged
    .map((value) => value.replace(/[:;]+$/g, "").replace(/\s+/g, " ").trim())
    .filter((value) => {
      const key = normalizeTextKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => {
      if (value.length <= 64) return toTitleCase(value);
      const shortened = value.split(/[,:-]/)[0]?.trim() || value;
      return toTitleCase(shortened.slice(0, 64).trim());
    });

  return normalized.slice(0, 12);
}

function buildArchitectFallback(
  courseTitle: string,
  inputText: string,
  durationMinutes: number,
  targetWords: number
): string {
  const topicCandidates = extractFallbackTopicCandidates(inputText);
  const fallbackTopics = topicCandidates.length > 0
    ? topicCandidates
    : [
        `Why ${courseTitle}`,
        `Core Ideas In ${courseTitle}`,
        `Applying ${courseTitle} At Work`,
        `Common Pitfalls In ${courseTitle}`,
        `Next Steps For ${courseTitle}`,
      ];

  const moduleCount = Math.max(1, Math.min(4, Math.ceil(fallbackTopics.length / 3)));
  const topicsPerModule = Math.max(1, Math.ceil(fallbackTopics.length / moduleCount));
  const estimatedMinutes = Math.max(1, Math.round((durationMinutes / moduleCount) * 10) / 10);
  const moduleTitles = ["Foundations", "Core Practice", "Workplace Decisions", "Action Plan"];

  const modules = Array.from({ length: moduleCount }, (_, moduleIndex) => {
    const topics = fallbackTopics
      .slice(moduleIndex * topicsPerModule, (moduleIndex + 1) * topicsPerModule)
      .map((topicTitle, topicIndex) => ({
        topic_title: topicTitle,
        learning_objective: `Help the learner explain and apply ${topicTitle.toLowerCase()} in a practical work context.`,
        blooms_level: topicIndex === 0 ? "Understand" : "Apply",
        instructional_pattern: topicIndex % 2 === 0 ? "scenario walkthrough" : "concept explanation",
        scenario_anchor: `A realistic workplace example involving ${topicTitle.toLowerCase()}.`,
        misconception_to_correct: `Assuming ${topicTitle.toLowerCase()} is only theoretical or optional.`,
        decision_skill: `Choose the strongest response when ${topicTitle.toLowerCase()} matters.`,
        practice_activity: `Reflect on one real decision connected to ${topicTitle.toLowerCase()}.`,
        interaction_type: topicIndex % 2 === 0 ? "decision prompt" : "guided reflection",
        feedback_focus: `Reinforce practical use of ${topicTitle.toLowerCase()}.`,
        screen_intent: "Teach the concept and connect it to real work.",
        key_takeaway: `${topicTitle} should change what the learner does next.`,
        evidence_or_example: `Use an example from the provided source material related to ${topicTitle.toLowerCase()}.`,
      }));

    return {
      module_title: `${moduleTitles[moduleIndex] || `Module ${moduleIndex + 1}`} - ${courseTitle}`,
      module_promise: `Give the learner a usable chapter on ${courseTitle.toLowerCase()}.`,
      why_it_matters: `This module keeps the course moving toward practical application of ${courseTitle.toLowerCase()}.`,
      estimated_minutes: estimatedMinutes,
      module_assessment_strategy: "Short decision checks and applied reflection prompts.",
      topics,
    };
  });

  return JSON.stringify({
    course_promise: `A practical course that helps learners act on ${courseTitle}.`,
    audience: "Workplace learners who need concise, actionable guidance.",
    outcome_statement: `By the end of the course, learners can explain and apply the key ideas in ${courseTitle}.`,
    quality_targets: {
      realism: "Use only examples grounded in the provided source material.",
      instructional_variety: "Mix explanation, scenario, and reflection.",
      interaction_density: "Include lightweight decision moments throughout.",
      scenario_expectation: "Tie every module to at least one workplace situation.",
    },
    modules,
    fallback_mode: true,
    fallback_source_excerpt: inputText.trim().slice(0, Math.min(1800, targetWords)),
  }, null, 2);
}

// Build a high-priority language directive that prepends every agent system prompt.
// Lifting this to the very top of the prompt (ahead of role/tone instructions) is what
// makes Gemini / Claude actually respect non-English outputs like Hindi. When the directive
// was buried mid-prompt, the model frequently defaulted back to English.
function buildLanguageDirective(textLanguage: string, narratorLanguage: string): string {
  const sameLang = textLanguage === narratorLanguage;
  const nonEnglish = textLanguage !== "English" || narratorLanguage !== "English";
  const strictBlock = nonEnglish
    ? `This rule OVERRIDES every other instruction below. Do NOT output any English text anywhere (no English titles, no English headings, no English JSON values, no English keys in parentheses). Translate ALL human-readable strings — titles, module names, topic names, body text, bullet points, examples, scenarios, takeaways, questions, options, rationale, prompts, captions, labels, call-to-actions — into the target language. JSON structural keys stay in English, but every string VALUE that a learner will read must be in the target language.`
    : `Keep all output in English unless a downstream instruction says otherwise.`;
  return [
    "=== ABSOLUTE OUTPUT LANGUAGE RULE — READ FIRST ===",
    sameLang
      ? `Write ALL output in ${textLanguage}.`
      : `On-screen / body / slide text language: ${textLanguage}\nNarration / spoken script language: ${narratorLanguage}`,
    strictBlock,
    "=== END LANGUAGE RULE ===",
    "",
  ].join("\n");
}

// Tail reminder appended to the END of every agent system prompt.
// Models often relapse mid-generation (start in Hindi, drift to English); repeating
// the directive as the last thing the model sees dramatically improves compliance.
function buildLanguageDirectiveTail(textLanguage: string, narratorLanguage: string): string {
  const nonEnglish = textLanguage !== "English" || narratorLanguage !== "English";
  if (!nonEnglish) return "";
  const sameLang = textLanguage === narratorLanguage;
  return [
    "",
    "=== FINAL LANGUAGE REMINDER — THIS IS THE LAST INSTRUCTION, IT OVERRIDES EVERYTHING ABOVE ===",
    sameLang
      ? `Your ENTIRE response must be in ${textLanguage}. Do NOT output any English. Every string value in your JSON (titles, module names, topic names, body text, takeaways, questions, options, feedback, rationale) MUST be in ${textLanguage}. JSON structural keys stay in English; every VALUE a learner will read is in ${textLanguage}.`
      : `On-screen/slide text stays in ${textLanguage}. Narration/script stays in ${narratorLanguage}. Do NOT output any English. Every human-readable string value MUST be in the target language (JSON structural keys stay English).`,
    "=== END FINAL LANGUAGE REMINDER ===",
  ].join("\n");
}

// Prefix prepended to every agent user message for non-English runs.
// Same sandwich technique as claude-avatar edge function — the LLM sees the language
// rule at start of system, end of system, AND start of user message.
function buildUserLanguageReminder(textLanguage: string, narratorLanguage: string): string {
  const nonEnglish = textLanguage !== "English" || narratorLanguage !== "English";
  if (!nonEnglish) return "";
  const sameLang = textLanguage === narratorLanguage;
  const langPhrase = sameLang
    ? textLanguage.toUpperCase()
    : `${textLanguage.toUpperCase()} for on-screen text and ${narratorLanguage.toUpperCase()} for narration`;
  return `[LANGUAGE INSTRUCTION: Your ENTIRE response must be written in ${langPhrase}. Do NOT use English. WRITE EVERY STRING VALUE IN ${sameLang ? textLanguage.toUpperCase() : "THE TARGET LANGUAGE"}.]\n\n`;
}

const initialStatuses = (): Record<string, AgentStatus> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus]));

const initialOutput = (): OutputData => ({ outline: "", script: "", assessment: "", package: "" });
const initialRaw = (): RawAgentOutputs => ({ research: "", architect: "", writer: "", visual: "", animation: "", youtube: "", compliance: "", assessment: "", quality: "", voice: "", assembly: "" });

const timestamp = () => {
  const d = new Date();
  return `[${d.toLocaleTimeString("en-US", { hour12: false })}]`;
};

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("claude", {
    body: { systemPrompt, userMessage },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.text;
}

async function callClaudeWithTimeout(systemPrompt: string, userMessage: string, timeoutMs = 90000): Promise<string> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race<string>([
      callClaude(systemPrompt, userMessage),
      new Promise<string>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Claude call timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function callClaudeWithRetry(systemPrompt: string, userMessage: string, addLog: (msg: string) => void, agentName: string, timeoutMs = 90000): Promise<string> {
  try {
    return await callClaudeWithTimeout(systemPrompt, userMessage, timeoutMs);
  } catch (err) {
    addLog(`${agentName}: Error — retrying once (${(err as Error).message})...`);
    return await callClaudeWithTimeout(systemPrompt, userMessage, timeoutMs);
  }
}

export function useAgentPipeline() {
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(initialStatuses());
  const [outputData, setOutputData] = useState<OutputData>(initialOutput());
  const [rawOutputs, setRawOutputs] = useState<RawAgentOutputs>(initialRaw());
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const cancelledRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `${timestamp()} ${msg}`]);
  }, []);

  const setStatus = useCallback((id: string, status: AgentStatus) => {
    setAgentStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const updateVisualTopicAsset = useCallback((moduleTitle: string, topicTitle: string, updates: Record<string, unknown>) => {
    setRawOutputs((prev) => {
      try {
        const visualData = JSON.parse(prev.visual || "{}");
        const modules = Array.isArray(visualData.modules) ? visualData.modules : [];
        const normalizedModuleTitle = normalizeTextKey(moduleTitle);
        const normalizedTopicTitle = normalizeTextKey(topicTitle);

        const updatedModules = modules.map((moduleVisual: any) => {
          const candidateModuleTitle = moduleVisual?.module_title || moduleVisual?.title || moduleVisual?.name || "";
          if (normalizeTextKey(candidateModuleTitle) !== normalizedModuleTitle) {
            return moduleVisual;
          }

          const topicVisuals = Array.isArray(moduleVisual?.topic_visuals) ? moduleVisual.topic_visuals : [];
          return {
            ...moduleVisual,
            topic_visuals: topicVisuals.map((topicVisual: any) => {
              const candidateTopicTitle = topicVisual?.topic_title || topicVisual?.title || topicVisual?.name || "";
              if (normalizeTextKey(candidateTopicTitle) !== normalizedTopicTitle) {
                return topicVisual;
              }

              return {
                ...topicVisual,
                ...updates,
              };
            }),
          };
        });

        return {
          ...prev,
          visual: JSON.stringify({
            ...visualData,
            modules: updatedModules,
          }),
        };
      } catch {
        return prev;
      }
    });
  }, []);

  const updateCourseContent = useCallback((section: "outline" | "script" | "assessment" | "package", value: string) => {
    setOutputData((prev) => ({ ...prev, [section]: value }));

    setRawOutputs((prev) => {
      if (section === "script") {
        return { ...prev, writer: value };
      }
      if (section === "assessment") {
        return { ...prev, assessment: value };
      }
      if (section === "package") {
        return { ...prev, assembly: value };
      }
      return { ...prev, architect: value };
    });
  }, []);

  const loadPersistedState = useCallback((nextRaw: RawAgentOutputs, nextOutput: OutputData, nextLogs: string[] = []) => {
    cancelledRef.current = false;
    setIsRunning(false);
    setAgentStatuses(initialStatuses());
    setRawOutputs(nextRaw);
    setOutputData(nextOutput);
    setLogs(nextLogs);
  }, []);

  const clearPipelineState = useCallback(() => {
    cancelledRef.current = false;
    setIsRunning(false);
    setAgentStatuses(initialStatuses());
    setRawOutputs(initialRaw());
    setOutputData(initialOutput());
    setLogs([]);
  }, []);

  const runPipeline = useCallback(async (courseTitle: string, inputText: string, toggles: Record<string, boolean>, params?: { level?: string; language?: string; textLanguage?: string; narratorLanguage?: string; voiceAccent?: string; duration?: string; assessmentRequired?: boolean; assessmentIntensity?: AssessmentIntensity; slideLayout?: SlideLayoutParams; maxYoutubeVideos?: number }) => {
    const textLanguage = params?.textLanguage || params?.language || "English";
    const narratorLanguage = params?.narratorLanguage || textLanguage;
    const languageDirective = buildLanguageDirective(textLanguage, narratorLanguage);
    const languageDirectiveTail = buildLanguageDirectiveTail(textLanguage, narratorLanguage);
    const userLanguageReminder = buildUserLanguageReminder(textLanguage, narratorLanguage);

    // Wrapper that sandwiches language instructions around every agent call.
    // Head directive is already baked into each systemPrompt template (${languageDirective});
    // this wrapper appends the tail reminder and prepends the user-message reminder
    // so the model sees the language rule at start of system, end of system, and start of user msg.
    const runAgentWithLanguage = async (
      systemPrompt: string,
      userMessage: string,
      logCb: (msg: string) => void,
      agentName: string,
      timeoutMs = 90000,
    ): Promise<string> => {
      const wrappedSystem = languageDirectiveTail
        ? `${systemPrompt}\n${languageDirectiveTail}`
        : systemPrompt;
      const wrappedUser = userLanguageReminder
        ? `${userLanguageReminder}${userMessage}`
        : userMessage;
      return callClaudeWithRetry(wrappedSystem, wrappedUser, logCb, agentName, timeoutMs);
    };
    const durationMinutes = parseDurationMinutes(params?.duration);
    const assessmentIntensity: AssessmentIntensity = params?.assessmentIntensity || "standard";
    const targetNarrationWords = Math.max(260, durationMinutes * 130);
    const durationToleranceMinutes = getDurationToleranceMinutes(durationMinutes);
    const structureGuidance = getStructureGuidance(durationMinutes);
    const sophisticationGuidance = getSophisticationGuidance(durationMinutes, params?.level);
    const instructionalPatternGuidance = getInstructionalPatternGuidance(durationMinutes, params?.level);
    const assessmentLevelGuidance = getAssessmentLevelGuidance(params?.level);
    const levelCalibration = getLevelCalibration(params?.level);

    cancelledRef.current = false;
    setIsRunning(true);
    setAgentStatuses(initialStatuses());
    setOutputData(initialOutput());
    setRawOutputs(initialRaw());
    setLogs([]);

    const isCancelled = () => cancelledRef.current;

    // Set all agents to queued initially
    AGENTS.forEach(({ id }) => {
      setAgentStatuses((prev) => ({ ...prev, [id]: "queued" as AgentStatus }));
    });

    addLog(`Orchestrator: Pipeline initiated for '${courseTitle}' (${params?.level || "intermediate"}, text: ${textLanguage}, voice: ${narratorLanguage}, ${params?.duration || "15min"})`);

    let researchResult = "";
    let archResult = "";
    let writerResult = "";
    let visualResult = "";
    let animResult = "";
    let complianceResult = "";
    let assessmentResult = "";
    let qualityResult = "";
    let voiceResult = "";
    let durationPlan: ModuleDurationPlan[] = [];

    try {
      // ──── AGENT 1: Research ────
      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      if (toggles["research"] !== false) {
        setStatus("research", "running");
        addLog("Research Agent: Starting web + document analysis...");
        try {
          researchResult = await runAgentWithLanguage(
            `${languageDirective}You are a Research Agent for premium corporate eLearning. You MUST base your output ENTIRELY on the source material provided below. Do NOT invent topics or drift into generic training filler. Extract the knowledge, tensions, examples, and practical behaviors that could support a sophisticated learner experience. Course level: ${params?.level || "intermediate"}. LANGUAGE REQUIREMENT: Write ALL text values in your JSON output (source_summary, key_themes, learner_problems, practical_behaviors, learning_objectives, and every other text field) in ${textLanguage}. Do NOT use English if ${textLanguage} is not English. CRITICAL — Target duration is ${params?.duration || "15min"}. The finished learner experience must feel like approximately ${durationMinutes} minutes of content, which means around ${targetNarrationWords} words of narration/script across the course. Generate enough depth to support that runtime. Recommended structure: ${structureGuidance}. Sophistication requirement: ${sophisticationGuidance}. Return JSON with these keys: source_summary, key_themes, learner_problems, stakes_and_consequences, common_misconceptions, practical_behaviors, scenario_opportunities, evidence_and_examples, learning_objectives.`,
            `Course Title: ${courseTitle}\n\n=== SOURCE MATERIAL (USE THIS AS YOUR PRIMARY INPUT) ===\n${inputText}\n=== END SOURCE MATERIAL ===\n\nIMPORTANT: Your entire output must be based on the source material above. Do not generate generic content. Target duration: ${params?.duration || "15min"}. Approximate narration budget: ${targetNarrationWords} words. Recommended structure: ${structureGuidance}. Sophistication requirement: ${sophisticationGuidance}. Find material that can support realistic scenarios, decisions, contrasts between weak and strong practice, and memorable learner takeaways.`,
            addLog, "Research Agent", 45000
          );
          setStatus("research", "complete");
          setRawOutputs((prev) => ({ ...prev, research: researchResult }));
          setOutputData((prev) => ({ ...prev, outline: `## Research Output\n\n${researchResult}` }));
          addLog("Research Agent: Complete. 8 objectives identified.");
        } catch (researchErr) {
          const fallbackSource = inputText.trim().slice(0, 6000);
          researchResult = JSON.stringify({
            source_summary: fallbackSource || `Source notes for ${courseTitle}`,
            key_themes: [],
            learner_problems: [],
            stakes_and_consequences: [],
            common_misconceptions: [],
            practical_behaviors: [],
            scenario_opportunities: [],
            evidence_and_examples: [],
            learning_objectives: [],
            fallback_mode: true,
          });
          setStatus("research", "error");
          setRawOutputs((prev) => ({ ...prev, research: researchResult }));
          setOutputData((prev) => ({ ...prev, outline: `## Research Output (Fallback)\n\n${researchResult}` }));
          addLog(`Research Agent: Failed (${(researchErr as Error).message}). Continuing with source-material fallback.`);
        }
      } else {
        setStatus("research", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 2: Content Architect ────
      if (toggles["architect"] !== false) {
        setStatus("architect", "running");
        addLog("Content Architect: Receiving research output...");
        try {
          archResult = await runAgentWithLanguage(
            `${languageDirective}You are a senior Content Architect designing premium corporate eLearning. Given research output AND source material, create a course structure with a deliberate learning arc, not just a list of topics. You MUST use the content from the source material. Do NOT invent unrelated topics. LANGUAGE REQUIREMENT: Write ALL module_title, topic_title, module_promise, why_it_matters, outcome_statement, course_promise, and every other text field in ${textLanguage}. Do NOT use English if ${textLanguage} is not English. CRITICAL: The target course duration is ${params?.duration || "15min"}. The finished course should feel like approximately ${durationMinutes} minutes of learner time, supported by about ${targetNarrationWords} words of narrated/scripted content. The sum of all module estimated_minutes must land within +/- ${durationToleranceMinutes} minutes of ${durationMinutes}. Recommended structure: ${structureGuidance}. Sophistication requirement: ${sophisticationGuidance}. Instructional pattern guidance: ${instructionalPatternGuidance}. Return JSON in this shape: { course_promise, audience, outcome_statement, quality_targets: { realism, instructional_variety, interaction_density, scenario_expectation }, modules: [{ module_title, module_promise, why_it_matters, estimated_minutes, module_assessment_strategy, topics: [{ topic_title, learning_objective, blooms_level, instructional_pattern, scenario_anchor, misconception_to_correct, decision_skill, practice_activity, interaction_type, feedback_focus, screen_intent, key_takeaway, evidence_or_example }] }] }. Keep module and topic titles concrete and compelling, not generic.`,
            `Research Output:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nCourse Title: ${courseTitle}\nTarget Duration: ${params?.duration || "15min"}\nTarget Narration Budget: ${targetNarrationWords} words\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes\nRecommended Structure: ${structureGuidance}\nSophistication Requirement: ${sophisticationGuidance}\nInstructional Pattern Guidance: ${instructionalPatternGuidance}\n\nBuild the course structure strictly from the above content, scaled to fit the target duration. Make modules feel like meaningful chapters with different jobs to do, and make topics feel teachable, scenario-ready, and presentation-worthy.`,
            addLog, "Content Architect", 45000
          );
          setStatus("architect", "complete");
        } catch (architectErr) {
          archResult = buildArchitectFallback(courseTitle, inputText, durationMinutes, targetNarrationWords);
          setStatus("architect", "error");
          addLog(`Content Architect: Failed (${(architectErr as Error).message}). Continuing with deterministic fallback structure.`);
        }

        setRawOutputs((prev) => ({ ...prev, architect: archResult }));
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Course Structure\n\n${archResult}`,
        }));
        durationPlan = buildDurationPlan(archResult, durationMinutes, targetNarrationWords);
        if (durationPlan.length > 0) {
          addLog(`Content Architect: Duration plan normalized to ${durationMinutes} min across ${durationPlan.length} modules.`);
        }
        addLog("Content Architect: Complete. Modules structured.");
      } else {
        setStatus("architect", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 3: Writer (per-module calls to avoid truncation) ────
      if (toggles["writer"] !== false) {
        setStatus("writer", "running");

        // Parse modules from architect output
        let parsedModules: any[] = [];
        try {
          const archParsed = JSON.parse(archResult || "{}");
          parsedModules = archParsed.modules || archParsed.course_structure?.modules || archParsed.course_modules || [];
        } catch { parsedModules = []; }

        durationPlan = durationPlan.length > 0 ? durationPlan : buildDurationPlan(archResult, durationMinutes, targetNarrationWords);

        const totalTopics = Math.max(1, parsedModules.reduce((count: number, mod: any) => {
          const topics = mod.topics || mod.sections || mod.lessons || [];
          return count + Math.max(1, topics.length || 0);
        }, 0));
        const targetWordsPerTopic = Math.max(110, Math.ceil(targetNarrationWords / totalTopics));
        const wordsPerTopicRange = `${Math.max(110, Math.floor(targetWordsPerTopic * 0.9))}-${Math.ceil(targetWordsPerTopic * 1.15)}`;

        const writerSystemPrompt = `${languageDirective}You are an elite instructional writer who specialises in premium corporate eLearning that people actually enjoy. Your writing style is conversational, direct, vivid, and smart — like a brilliant colleague explaining something important over coffee, not a textbook.

LANGUAGE REQUIREMENT — THIS OVERRIDES EVERYTHING ELSE:
- Write ALL on-screen text (topic titles, headings, body copy, examples, scenarios, takeaways, challenges, labels, bullet points) in ${textLanguage}.
- Write ALL narration/script text in ${narratorLanguage}.
- Do NOT mix languages within a single field. Every single word of on-screen content must be in ${textLanguage}.
- If ${textLanguage} is not English, do not include any English fallback text.

CRITICAL: You are writing ONE MODULE of a ${params?.duration || "15min"} course. You MUST write substantial, detailed content.
- Total narration/script budget for the whole course: about ${targetNarrationWords} words.
- Total topic count planned: ${totalTopics}.
- Target word count per topic: ${wordsPerTopicRange} words. This is MINIMUM — write MORE if the topic warrants it.
- For longer courses (30-60 min), expand with multiple examples, deeper analysis, step-by-step walkthroughs, and richer real-world scenarios.
- NEVER truncate or summarize. Write the FULL content for every topic.
      - Sophistication target: ${sophisticationGuidance}
      - Variation target: ${instructionalPatternGuidance}

LEVEL CALIBRATION (${levelCalibration.label}) — apply these rules to every topic:
- Bloom's target: ${levelCalibration.bloomsTarget}
- Vocabulary: ${levelCalibration.vocabularyGuidance}
- Scenario complexity: ${levelCalibration.scenarioComplexity}
- Content depth: ${levelCalibration.contentDepth}
- Prerequisite assumption: ${levelCalibration.prerequisiteAssumption}

Rules you NEVER break:
- Open every topic with a provocative hook — a shocking stat, a bold claim, a real-world scenario, or a question that makes the learner stop and think
- Write in second person: 'You', 'Your team', 'You've probably seen this'
- Short punchy sentences. Never more than 20 words per sentence.
- Use concrete real-world examples, not abstract theory
- Every section must have ONE memorable takeaway — something the learner will still remember next week
- Use analogies. Make complex ideas click instantly.
- End every topic with a challenge or reflection: 'Next time you X, try Y instead'
- NO passive voice. NO bullet walls.
- Do NOT make every topic feel structurally identical. Vary the treatment based on the instructional pattern and topic need.
- Across a module, include a mix of these techniques when appropriate: scenario walkthrough, misconception reset, process breakdown, weak-vs-strong contrast, manager coaching moment, customer-facing example, concise checklist.
- Use the architect blueprint explicitly. Every topic should visibly honour its learning_objective, misconception_to_correct, scenario_anchor, practice_activity, interaction_type, and feedback_focus when those fields are present.
- Make the learner do mental work. Include at least one decision prompt, judgment call, or “what would you do?” moment in each topic, written naturally inside the prose.
- Format each topic using markdown prose with this backbone: Hook → Core explanation → Concrete example or scenario → Key Takeaway: → Challenge:. Keep headings limited to the topic title only.
- Use markdown ## headers for each topic title, matching the exact topic names provided.
- You MUST use content from the source material provided. Do NOT invent unrelated examples.
- You MUST respect the supplied runtime plan. Hit the requested word budgets closely so the narration lands within ${durationToleranceMinutes} minutes of the ${durationMinutes}-minute target.

      Write content that feels expensive, practical, and memorable — something a learner would actually respect, not skim out of obligation.`;

        if (parsedModules.length === 0) {
          // Fallback: single call if we can't parse modules
          addLog("Writer Agent: Drafting all content...");
          writerResult = await runAgentWithLanguage(
            writerSystemPrompt,
            `Course Title: ${courseTitle}\nTarget Duration: ${params?.duration || "15min"}\nTarget Narration Budget: ${targetNarrationWords} words\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes\nPlanned Topic Count: ${totalTopics}\n\nDuration Plan:\n${summarizeDurationPlan(durationPlan)}\n\nResearch Context:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nWrite engaging content for the entire course. Scale total content to fit ${params?.duration || "15min"} and reach approximately ${targetNarrationWords} words in total.`,
            addLog, "Writer Agent"
          );
        } else {
          // Per-module calls to avoid truncation
          const moduleResults: string[] = [];
          for (let mi = 0; mi < parsedModules.length; mi++) {
            if (isCancelled()) break;
            const mod = parsedModules[mi];
            const modTitle = mod.module_title || mod.title || mod.name || `Module ${mi + 1}`;
            const moduleDurationPlan = findModuleDurationPlan(durationPlan, modTitle, mi);
            const topicBlueprint = JSON.stringify(mod.topics || mod.sections || mod.lessons || [], null, 2);
            const topics = (mod.topics || mod.sections || mod.lessons || []).map((t: any) => {
              const name = typeof t === "string" ? t : t.topic_title || t.title || t.name || "";
              const obj = typeof t === "string" ? "" : t.learning_objective || t.objective || "";
              const pattern = typeof t === "string" ? "" : t.instructional_pattern || "";
              const scenario = typeof t === "string" ? "" : t.scenario_anchor || "";
              const interaction = typeof t === "string" ? "" : t.interaction_type || "";
              const topicPlan = moduleDurationPlan?.topics.find((planTopic) => normalizeTextKey(planTopic.topicTitle) === normalizeTextKey(name));
              return `  - Topic: ${name}${obj ? ` | Objective: ${obj}` : ""}${pattern ? ` | Pattern: ${pattern}` : ""}${scenario ? ` | Scenario: ${scenario}` : ""}${interaction ? ` | Interaction: ${interaction}` : ""}${topicPlan ? ` | Target Words: ${topicPlan.wordRange}` : ""}`;
            }).join("\n");

            addLog(`Writer Agent: Drafting Module ${mi + 1}/${parsedModules.length} — ${modTitle}...`);

            const moduleContent = await runAgentWithLanguage(
              writerSystemPrompt,
              `Course Title: ${courseTitle}\nThis is Module ${mi + 1} of ${parsedModules.length} in a ${params?.duration || "15min"} course.\nTarget Narration Budget: ${targetNarrationWords} words across ${totalTopics} topics total.\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes.\nThis module should carry its fair share of that runtime.\n\nModule: ${modTitle}\nModule Runtime Target: ${moduleDurationPlan?.targetMinutes ?? "auto"} minutes\nModule Word Budget: ${moduleDurationPlan?.targetWords ?? "auto"} words\nModule Topic Word Range: ${moduleDurationPlan?.topicWordRange ?? wordsPerTopicRange}\nTopics:\n${topics}\n\nStructured Topic Blueprint JSON:\n${topicBlueprint}\n\nDuration Plan JSON:\n${JSON.stringify(moduleDurationPlan || null, null, 2)}\n\nResearch Context:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nWrite FULL, detailed, engaging content for EVERY topic in this module. Use ## headers matching the topic names exactly. Each topic must be ${moduleDurationPlan?.topicWordRange ?? wordsPerTopicRange} words minimum so the final course genuinely feels like ${params?.duration || "15min"}. Make this module feel like a coherent chapter with a distinct purpose, not a pile of disconnected notes. Use the topic's objective, scenario_anchor, misconception_to_correct, practice_activity, interaction_type, feedback_focus, and evidence_or_example when present. Stay close to the module word budget rather than writing evenly by instinct.`,
              addLog, "Writer Agent"
            );
            moduleResults.push(`# ${modTitle}\n\n${moduleContent}`);
            
            // Update output progressively
            writerResult = moduleResults.join("\n\n---\n\n");
            setRawOutputs((prev) => ({ ...prev, writer: writerResult }));
            setOutputData((prev) => ({ ...prev, script: writerResult }));
          }
          writerResult = moduleResults.join("\n\n---\n\n");
        }
        
        setStatus("writer", "complete");
        setRawOutputs((prev) => ({ ...prev, writer: writerResult }));
        setOutputData((prev) => ({ ...prev, script: writerResult }));
        addLog(`Writer Agent: Complete. ${parsedModules.length || 1} modules written.`);
      } else {
        setStatus("writer", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 3b: Quality Reviewer ────
      if (toggles["quality"] !== false) {
        setStatus("quality", "running");
        addLog("Quality Reviewer: Scoring instructional quality and revising weak sections...");
        qualityResult = await runAgentWithLanguage(
          `${languageDirective}You are a Quality Reviewer for premium corporate eLearning. Review the architect plan and draft script with a ruthless instructional-design lens. Score the draft on instructional clarity, realism, interaction quality, learner engagement, assessment readiness, and duration alignment. Then rewrite any weak content so the output feels sharper, more teachable, more scenario-based, and less generic while still landing near the requested runtime. LANGUAGE REQUIREMENT: The entire revised_script must be written in ${textLanguage}. Narration text must be in ${narratorLanguage}. Do not revert content to English if ${textLanguage} is not English. Return JSON in this exact shape: { instructional_score, realism_score, interaction_score, engagement_score, assessment_readiness_score, duration_alignment_score, strengths: [], issues: [], revision_summary: [], revised_script }. The revised_script must preserve the same module and topic headings while improving the content beneath them.`,
          `Course Title: ${courseTitle}\n\nArchitect Plan:\n${archResult}\n\nDuration Plan:\n${JSON.stringify(durationPlan, null, 2)}\n\nDraft Script:\n${writerResult}\n\nCurrent Draft Word Count: ${countWords(writerResult)}\nTarget Narration Words: ${targetNarrationWords}\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes\n\nResearch Context:\n${researchResult}\n\nReview the draft against the architect schema. If a topic feels generic, lacks a decision point, ignores a misconception, misses a practical scenario, or materially under-runs or over-runs its word budget, fix it in revised_script.`,
          addLog, "Quality Reviewer"
        );

        const qualityParsed = tryParseJson(qualityResult);
        if (qualityParsed?.revised_script && typeof qualityParsed.revised_script === "string") {
          writerResult = qualityParsed.revised_script;
        }

        setStatus("quality", "complete");
        setRawOutputs((prev) => ({ ...prev, writer: writerResult, quality: qualityResult }));
        setOutputData((prev) => ({
          ...prev,
          script: writerResult,
          outline: prev.outline + `\n\n---\n\n## Quality Review\n\n${qualityResult}`,
        }));
        addLog("Quality Reviewer: Complete. Revised script passed forward to downstream agents.");
      } else {
        setStatus("quality", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 4: Visual Design ────
      if (toggles["visual"] !== false) {
        setStatus("visual", "running");
        addLog("Visual Design Agent: Generating layout specs for modules...");
        visualResult = await runAgentWithLanguage(
          `${languageDirective}You are a Visual Design Agent for premium corporate eLearning. Given a course outline and script, produce a visual design plan that feels intentional, modern, and presentation-grade. For each module, specify: (1) recommended slide layout type, (2) key infographic or diagram description, (3) color palette suggestion, (4) iconography style, and (5) topic-level realism plan. The realism plan must use ONLY AI-generated original visuals, never stock photography or copyrighted images. Do NOT assign imagery to every topic. Select only the slides that truly benefit from realism, usually about 20-35% of topics, prioritising scenarios, workplace conversations, customer interactions, environmental context, and moments where the learner benefits from seeing a situation. Also ensure the infographic_description is ambitious enough to produce a sophisticated visual, not a simple poster. Return JSON: { modules: [{ module_title, slide_layout, infographic_description, color_palette, icon_style, composition_notes, topic_visuals: [{ topic_title, screen_template, image_needed, image_style, image_prompt, placement, alt_text, interaction_emphasis }] }] }. Valid screen_template values: dashboard, guided-notes, scenario, media-quiz, summary-panel. Use dashboard for module openers, visual-first lessons, and lessons that should feel like an LMS page with cards. Use guided-notes for more linear explanation screens. Use scenario for decision-oriented workplace moments. Use media-quiz for lessons that should combine a hero asset with an embedded knowledge check feel. Use summary-panel for wrap-up or consolidation screens. Valid placements: hero, side-panel, inline-card. Valid image_style values: realistic-office, realistic-customer, realistic-teamwork, realistic-device-demo. ${buildSlideLayoutInstruction(params?.slideLayout)}`,
          `Course Outline:\n${archResult}\n\nScript:\n${writerResult}\n\n${buildSlideLayoutInstruction(params?.slideLayout)}\n\nDesign goal: avoid generic e-learning blandness. Make each module feel like it has a visual thesis, a deliberate information hierarchy, and at least one premium infographic concept that could stand on its own in an executive presentation. Explicitly assign a screen_template for each topic so the renderer does not have to guess, and vary those templates across the course instead of defaulting everything to the same structure.`,
          addLog, "Visual Design Agent"
        );
        setStatus("visual", "complete");
        setRawOutputs((prev) => ({ ...prev, visual: visualResult }));
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Visual Design Plan\n\n${visualResult}`,
        }));
        addLog("Visual Design Agent: Complete. Design plan ready.");

        // ── SVG Generation Pass ──
        addLog("Visual Design Agent: Generating SVG infographics and AI scene visuals...");
        try {
          const visParsed = JSON.parse(visualResult || "{}");
          const visModules = visParsed.modules || [];
          const archParsed = JSON.parse(archResult || "{}");
          const archMods = archParsed.modules || archParsed.course_structure?.modules || archParsed.course_modules || [];

          const svgs: string[] = [];
          for (let si = 0; si < Math.min(visModules.length, archMods.length); si++) {
            if (isCancelled()) break;
            const vm = visModules[si];
            const am = archMods[si];
            const modTitle = vm.module_title || am?.module_title || am?.title || `Module ${si+1}`;
            const topics = (am?.topics || am?.sections || []).map((t: any) => typeof t === "string" ? t : t.topic_title || t.title || t.name || "").filter(Boolean);
            const layoutType = vm.slide_layout || "Standard";
            
            addLog(`Visual Design Agent: Generating SVG ${si+1}/${visModules.length}...`);
            try {
              const svgText = await callClaude(
                "You are an elite SVG designer for premium corporate learning. Generate a complete, self-contained SVG infographic (1200x800px). Use ONLY these colors: #0f172a, #123d78, #355fa8, #4f46e5, #7c3aed, #10b981, #f59e0b, #e8eef9, #f8fafc, #ffffff. No external fonts. Use font-family='system-ui, sans-serif'. No external images. Use only SVG primitives. The infographic must use the canvas fully, have strong hierarchy, large readable labels, deliberate spacing, and a polished consulting-slide feel. Avoid giant blank areas or tiny unreadable text. Return ONLY the SVG markup, nothing else.",
                `Create an infographic for: ${modTitle}. Layout: ${layoutType}. Key points to visualise: ${topics.join(", ")}. Include the module title prominently. Build a sophisticated visual narrative rather than a simple checklist. Add a small 'ContentForge' label bottom-right in subtle text. ${buildSlideLayoutInstruction(params?.slideLayout)}`
              );
              // Extract SVG from response
              const svgMatch = svgText.match(/<svg[\s\S]*?<\/svg>/i);
              svgs.push(svgMatch ? svgMatch[0] : "");
            } catch {
              svgs.push("");
            }

            const topicVisuals = Array.isArray(vm?.topic_visuals) ? vm.topic_visuals : [];
            if (topicVisuals.length > 0) {
              for (let ti = 0; ti < topicVisuals.length; ti++) {
                if (isCancelled()) break;
                const topicVisual = topicVisuals[ti];
                if (!topicVisual?.image_needed) continue;

                const topicTitle = topicVisual.topic_title || topics[ti] || `Topic ${ti + 1}`;
                addLog(`Visual Design Agent: Generating image ${si + 1}.${ti + 1} — ${topicTitle}...`);

                try {
                  const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-slide-image", {
                    body: {
                      prompt: topicVisual.image_prompt || `A realistic workplace scene illustrating ${topicTitle}.`,
                      style: topicVisual.image_style || "realistic-office",
                      altText: topicVisual.alt_text || `AI-generated visual illustrating ${topicTitle}.`,
                      moduleTitle: modTitle,
                      topicTitle,
                    },
                  });

                  if (!imageError && imageData?.imageDataUrl) {
                    topicVisual.generated_image_data_url = imageData.imageDataUrl;
                    topicVisual.generated_image_mime_type = imageData.mimeType || "image/png";
                    topicVisual.image_approved = false;
                    continue;
                  }
                } catch {
                  // Fall back to generated SVG scene below if raster image generation fails.
                }

                try {
                  const sceneSvgText = await callClaude(
                    "You are an SVG scene designer for corporate learning. Generate a complete, self-contained SVG visual scene (800x520px). The result must be an original AI-generated illustration only, never based on any copyrighted photo or branded asset. Style goal: polished semi-realistic corporate scene, with believable office environments, people silhouettes or simplified characters, devices, tables, glass walls, notebooks, and workspaces. Use only SVG primitives and gradients. No external fonts, no external images. Use system-ui, sans-serif if text is needed, but prefer visual storytelling over labels. Keep it professional, diverse, contemporary, and uncluttered. Return ONLY SVG markup.",
                    `Create an original AI-generated slide visual for corporate training. Module: ${modTitle}. Topic: ${topicTitle}. Style: ${topicVisual.image_style || "realistic-office"}. Placement intent: ${topicVisual.placement || "side-panel"}. Scene brief: ${topicVisual.image_prompt || `A realistic workplace scene illustrating ${topicTitle}.`}. Accessibility alt text target: ${topicVisual.alt_text || `AI-generated visual illustrating ${topicTitle}.`}. Do not include any copyrighted logos, brands, or identifiable trademarked products.`
                  );
                  const sceneSvgMatch = sceneSvgText.match(/<svg[\s\S]*?<\/svg>/i);
                  topicVisual.generated_scene_svg = sceneSvgMatch ? sceneSvgMatch[0] : "";
                  topicVisual.image_approved = false;
                } catch {
                  topicVisual.generated_scene_svg = "";
                }
              }
            }
          }

          // Update visual output with SVGs
          const updatedVisual = { ...visParsed, generatedSvgs: svgs };
          const updatedVisualStr = JSON.stringify(updatedVisual);
          setRawOutputs((prev) => ({ ...prev, visual: updatedVisualStr }));
          addLog(`Visual Design Agent: ${svgs.filter(Boolean).length} SVG infographics generated.`);
        } catch (svgErr) {
          addLog("Visual Design Agent: SVG generation skipped (parse error).");
        }
      } else {
        setStatus("visual", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 5: Animation ────
      if (toggles["animation"] !== false) {
        setStatus("animation", "running");
        addLog("Animation Agent: Writing interaction notes...");
        animResult = await runAgentWithLanguage(
          `${languageDirective}You are an Animation Agent for eLearning. Given a course architecture, script, and visual design plan, write animation and interaction notes for each module. For each topic or section specify: (1) animation type (entrance, transition, emphasis), (2) timing in seconds, (3) interaction type (click, hover, drag, quiz trigger, scenario decision, reveal), (4) branching or feedback logic, and (5) the learner action the interaction is reinforcing. Keep it practical for tools like Articulate Storyline or Adobe Captivate. Return as a structured list grouped by module.`,
          `Course Architecture:\n${archResult}\n\nScript:\n${writerResult}\n\nVisual Design Plan:\n${visualResult}`,
          addLog, "Animation Agent"
        );
        setStatus("animation", "complete");
        setRawOutputs((prev) => ({ ...prev, animation: animResult }));
        setOutputData((prev) => ({
          ...prev,
          script: prev.script + `\n\n---\n\n## Animation & Interaction Notes\n\n${animResult}`,
        }));
        addLog("Animation Agent: Complete.");
      } else {
        setStatus("animation", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 5b: YouTube ────
      if (toggles["youtube"] !== false) {
        setStatus("youtube", "running");
        // Extract module titles from architect output
        let moduleNames: string[] = [];
        try {
          const archParsed = JSON.parse(archResult || "{}");
          const mods = archParsed.modules || archParsed.course_structure?.modules || archParsed.course_modules || [];
          moduleNames = mods.map((m: any) => m.module_title || m.title || m.name || "").filter(Boolean);
        } catch {
          moduleNames = [courseTitle];
        }
        if (moduleNames.length === 0) moduleNames = [courseTitle];

        addLog(`YouTube Agent: Searching top videos for ${moduleNames.length} modules...`);
        
        try {
        const { data, error } = await supabase.functions.invoke("youtube-search", {
            body: { modules: moduleNames, courseTitle, language: params?.language, level: params?.level, duration: params?.duration, maxVideos: params?.maxYoutubeVideos ?? 20 },
          });
          
          if (error) throw new Error(error.message);
          if (data?.error) {
            if (data.missing_key) {
              addLog("YouTube Agent: ⚠ YOUTUBE_API_KEY not configured. Skipping.");
              setStatus("youtube", "error");
            } else if (data.quota_exceeded) {
              addLog("YouTube Agent: ⚠ YouTube quota exceeded. Try again tomorrow.");
              setStatus("youtube", "error");
            } else {
              throw new Error(data.error);
            }
          } else {
            const totalVideos = (data.modules || []).reduce((acc: number, m: any) => acc + (m.videos?.length || 0), 0);
            const youtubeResult = JSON.stringify(data);
            setRawOutputs((prev) => ({ ...prev, youtube: youtubeResult }));
            setStatus("youtube", "complete");
            addLog(`YouTube Agent: Found ${totalVideos} videos across all modules. Ready for review.`);
          }
        } catch (err) {
          addLog(`YouTube Agent: Error — ${(err as Error).message}`);
          setStatus("youtube", "error");
        }
      } else {
        setStatus("youtube", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 6: Compliance ────
      if (toggles["compliance"] !== false) {
        setStatus("compliance", "running");
        addLog("Compliance Agent: Auditing content for accessibility and policy...");
        complianceResult = await runAgentWithLanguage(
          `${languageDirective}You are a Compliance Agent for eLearning content. Review the course script and outline for the following: (1) Reading level — is it appropriate for the target audience? (2) Inclusive language — flag any non-inclusive terms. (3) Accessibility — does content support screen readers, captions, alt-text needs? (4) Policy alignment — does it reference relevant standards (OSHA, WCAG 2.1, etc.)? (5) Overall compliance score out of 10. Return as JSON: { reading_level, inclusive_language_issues: [], accessibility_notes: [], policy_alignment: [], compliance_score, recommendations: [] }`,
          `Script:\n${writerResult}`,
          addLog, "Compliance Agent"
        );
        setStatus("compliance", "complete");
        setRawOutputs((prev) => ({ ...prev, compliance: complianceResult }));
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Compliance Report\n\n${complianceResult}`,
        }));
        // Try to extract score for log
        let scoreMsg = "";
        try {
          const parsed = JSON.parse(complianceResult);
          scoreMsg = `Score ${parsed.compliance_score}/10. ${(parsed.recommendations || []).length} recommendations generated.`;
        } catch {
          scoreMsg = "Audit complete.";
        }
        addLog(`Compliance Agent: ${scoreMsg}`);
      } else {
        setStatus("compliance", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 7: Assessment ────
      if (toggles["assessment"] !== false) {
        setStatus("assessment", "running");
        const parsedArch = tryParseJson(archResult) || {};
        const archModules = Array.isArray(parsedArch?.modules)
          ? parsedArch.modules
          : Array.isArray(parsedArch?.course_structure?.modules)
            ? parsedArch.course_structure.modules
            : [];
        const moduleCount = Math.max(1, durationPlan.length || archModules.length || 1);
        const topicCountFromPlan = durationPlan.reduce((sum, modulePlan) => sum + Math.max(1, modulePlan.topicCount), 0);
        const topicCountFromArch = archModules.reduce((sum: number, module: any) => {
          const topics = Array.isArray(module?.topics)
            ? module.topics
            : Array.isArray(module?.sections)
              ? module.sections
              : Array.isArray(module?.lessons)
                ? module.lessons
                : [];
          return sum + Math.max(1, topics.length || 0);
        }, 0);
        const topicCount = Math.max(moduleCount, topicCountFromPlan || topicCountFromArch || moduleCount);
        const assessmentTargets = getAssessmentTargets(durationMinutes, assessmentIntensity, moduleCount, topicCount);

        addLog(`Assessment Agent: Generating ${assessmentTargets.mcqCount} MCQs + ${assessmentTargets.scenarioCount} scenarios (${assessmentIntensity} intensity)...`);
        assessmentResult = await runAgentWithLanguage(
          `${languageDirective}You are an Assessment Design Agent. Given course script, architecture, and learning objectives, create a comprehensive assessment bank sized to the requested runtime and module complexity. LANGUAGE REQUIREMENT: Write ALL question text, options, rationale, situation descriptions, prompts, and every text field in ${textLanguage}. Do not use English if ${textLanguage} is not English. Rules: (1) Question volume must scale with module/topic size; avoid token quizzes. (2) Spread MCQs across modules proportionally. (3) Include module_title and topic_title on every MCQ and scenario so the renderer can map items correctly. LEVEL CALIBRATION (${levelCalibration.label}): ${assessmentLevelGuidance} Bloom's target for questions: ${levelCalibration.bloomsTarget} Generate: (1) requested number of multiple choice questions with 4 options each, correct answer marked, rationale, and common wrong-answer trap, (2) requested number of scenario-based questions with a situation description, 3 response options, best_response, and coaching rationale, (3) 1 reflection exercise with an open-ended prompt, and (4) embedded_interactions list in requested range aligned to specific topics. Tag each question with Bloom's taxonomy level. Return JSON: { mcq: [{ module_title, topic_title, question, options: [], correct_answer, rationale, wrong_answer_trap, blooms_level }], scenarios: [{ module_title, topic_title, situation, options: [], best_response, rationale, blooms_level }], reflection: { prompt, guidance }, embedded_interactions: [{ module_title, topic_title, interaction_type, prompt, expected_response, feedback_focus }], metadata: { target_mcq_count, target_scenario_count, module_count, topic_count, assessment_intensity } }`,
          `Course Architecture:\n${archResult}\n\nScript:\n${writerResult}\n\nLearning Objectives:\n${researchResult}\n\nTarget Duration Minutes: ${durationMinutes}\nAssessment Intensity: ${assessmentIntensity}\nModule Count: ${moduleCount}\nTopic Count: ${topicCount}\nTarget MCQ Count: ${assessmentTargets.mcqCount}\nTarget Scenario Count: ${assessmentTargets.scenarioCount}\nTarget Embedded Interactions Range: ${assessmentTargets.interactionMin}-${assessmentTargets.interactionMax}`,
          addLog, "Assessment Agent"
        );
        setStatus("assessment", "complete");
        setRawOutputs((prev) => ({ ...prev, assessment: assessmentResult }));
        setOutputData((prev) => ({ ...prev, assessment: assessmentResult }));
        addLog("Assessment Agent: Complete. Assessment bank ready.");
      } else {
        setStatus("assessment", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 8: Voice & Narration ────
      if (toggles["voice"] !== false) {
        setStatus("voice", "running");
        addLog("Voice Agent: Reformatting script for narration...");
        voiceResult = await runAgentWithLanguage(
          `${languageDirective}You are a Voice and Narration Agent. Given a course script, reformat it as a professional narration script optimised for text-to-speech or voice recording. The narration language must be ${narratorLanguage}. If the source script is in a different language, translate it naturally while preserving meaning. For each section: (1) rewrite the script with natural spoken-word phrasing (shorter sentences, contractions, conversational), (2) add SSML-style narration cues in brackets like [PAUSE 1s], [EMPHASIZE], [SLOW DOWN], (3) estimate word count and approximate read time at ${NARRATION_WORDS_PER_MINUTE} words per minute. Preserve section structure, and keep the overall read-time within +/- ${durationToleranceMinutes} minutes of the ${durationMinutes}-minute target unless the script makes that impossible. Return the full narration script with cues and a summary: { total_words, estimated_duration_minutes, sections: [{ title, narration_text, word_count }] }`,
          `Script:\n${writerResult}\n\nOn-screen text language: ${textLanguage}\nNarrator language: ${narratorLanguage}\nTarget Duration Minutes: ${durationMinutes}\nTarget Narration Words: ${targetNarrationWords}\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes\nDuration Plan:\n${JSON.stringify(durationPlan, null, 2)}`,
          addLog, "Voice Agent"
        );

        const parsedVoice = tryParseJson(voiceResult);
        const estimatedDuration = safeNumber(parsedVoice?.estimated_duration_minutes);
        // Only calibrate when drift is severe (>2x tolerance) to avoid stalling the pipeline
        // on long, expensive recursive rewrites. Minor drift is acceptable.
        const severeDrift = estimatedDuration !== null &&
          Math.abs(estimatedDuration - durationMinutes) > durationToleranceMinutes * 2;
        if (severeDrift) {
          const adjustmentDirection = estimatedDuration! < durationMinutes ? "expand" : "compress";
          addLog(`Voice Agent: Severe runtime drift (${estimatedDuration} min vs ${durationMinutes} min target). Calibrating script...`);

          let calibrationResult = "";
          try {
            calibrationResult = await runAgentWithLanguage(
            `${languageDirective}You are a runtime calibration specialist for eLearning scripts. Your job is to ${adjustmentDirection} the script so the narrated runtime lands within +/- ${durationToleranceMinutes} minutes of the ${durationMinutes}-minute target at ${NARRATION_WORDS_PER_MINUTE} words per minute. Preserve the same module and topic headings. Keep the writing high quality, practical, and scenario-based. If expanding, add depth, examples, learner decisions, and coaching language. If compressing, remove repetition and tighten prose without losing key teaching points. Return JSON: { calibrated_script, estimated_duration_minutes, calibration_actions: [] }`,
            `Course Title: ${courseTitle}\nTarget Duration: ${durationMinutes} minutes\nAllowed Drift: +/- ${durationToleranceMinutes} minutes\nTarget Narration Words: ${targetNarrationWords}\nCurrent Estimated Duration: ${estimatedDuration} minutes\nCurrent Script Word Count: ${countWords(writerResult)}\nDuration Plan:\n${JSON.stringify(durationPlan, null, 2)}\n\nCurrent Script:\n${writerResult}`,
            addLog,
            "Voice Agent"
          );

          const parsedCalibration = tryParseJson(calibrationResult);
          if (parsedCalibration?.calibrated_script && typeof parsedCalibration.calibrated_script === "string") {
            writerResult = parsedCalibration.calibrated_script;
            setRawOutputs((prev) => ({ ...prev, writer: writerResult }));
            setOutputData((prev) => ({ ...prev, script: writerResult }));

            voiceResult = await runAgentWithLanguage(
              `${languageDirective}You are a Voice and Narration Agent. Given a course script, reformat it as a professional narration script optimised for text-to-speech or voice recording. The narration language must be ${narratorLanguage}. If the source script is in a different language, translate it naturally while preserving meaning. For each section: (1) rewrite the script with natural spoken-word phrasing (shorter sentences, contractions, conversational), (2) add SSML-style narration cues in brackets like [PAUSE 1s], [EMPHASIZE], [SLOW DOWN], (3) estimate word count and approximate read time at ${NARRATION_WORDS_PER_MINUTE} words per minute. Return the full narration script with cues and a summary: { total_words, estimated_duration_minutes, sections: [{ title, narration_text, word_count }] }`,
              `Script:\n${writerResult}\n\nOn-screen text language: ${textLanguage}\nNarrator language: ${narratorLanguage}\nTarget Duration Minutes: ${durationMinutes}\nTarget Narration Words: ${targetNarrationWords}\nAllowed Runtime Drift: +/- ${durationToleranceMinutes} minutes`,
              addLog,
              "Voice Agent"
            );

            qualityResult = qualityResult
              ? `${qualityResult}\n\nDuration Calibration\n${calibrationResult}`
              : calibrationResult;
            setRawOutputs((prev) => ({ ...prev, writer: writerResult, quality: qualityResult }));
          }
        }

        setStatus("voice", "complete");
        setRawOutputs((prev) => ({ ...prev, voice: voiceResult }));
        setOutputData((prev) => ({
          ...prev,
          script: prev.script + `\n\n---\n\n## Narration Script\n\n${voiceResult}`,
        }));
        // Try to extract duration for log
        let durationMsg = "";
        try {
          const parsed = JSON.parse(voiceResult);
          durationMsg = `Estimated duration: ${parsed.estimated_duration_minutes} mins.`;
        } catch {
          durationMsg = "Narration script ready.";
        }
        addLog(`Voice Agent: Complete. ${durationMsg}`);
      } else {
        setStatus("voice", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 9: Final Assembly ────
      if (toggles["assembly"] !== false) {
        setStatus("assembly", "running");
        addLog("Final Assembly: Packaging all outputs...");
        const assemblyInput = `Course Title: ${courseTitle}\n\nOutline:\n${archResult}\n\nScript:\n${writerResult}\n\nVisual Plan:\n${visualResult}\n\nAssessment:\n${assessmentResult}\n\nQuality Review:\n${qualityResult}\n\nNarration:\n${voiceResult}\n\nCompliance:\n${complianceResult}`;
        const assemblyResult = await runAgentWithLanguage(
          'You are a Final Assembly Agent for eLearning. Given the full course output (outline, script, assessment, narration, visual plan, quality review), produce a final course package summary. Include: (1) Course metadata — title, total modules, total topics, estimated completion time, difficulty level, (2) SCORM manifest summary — list of all assets needed (slides, audio files, images, assessments), (3) LMS deployment checklist — 10-item checklist of steps to publish to an LMS, (4) Quality assurance summary — confirm all agents completed, include key quality scores, and list any remaining gaps. Return as JSON: { metadata: {}, scorm_manifest: { assets: [] }, deployment_checklist: [], qa_summary: { agents_completed: [], quality_scores: {}, gaps: [] } }',
          assemblyInput,
          addLog, "Final Assembly"
        );
        setStatus("assembly", "complete");
        setRawOutputs((prev) => ({ ...prev, assembly: assemblyResult }));
        setOutputData((prev) => ({ ...prev, package: assemblyResult }));
        addLog("Final Assembly: Complete. Course package ready for LMS deployment.");
        addLog("Orchestrator: All agents complete. Pipeline finished successfully.");
      } else {
        setStatus("assembly", "idle");
      }

    } catch (err) {
      // Find which agent was running and mark it as error
      const runningAgent = AGENTS.find((a) => {
        // We can't read state here, so just log the error
        return false;
      });
      addLog(`Orchestrator: Pipeline error — ${(err as Error).message}`);
    }

    addLog("Orchestrator: Pipeline complete.");
    setIsRunning(false);
  }, [addLog, setStatus]);

  const stopPipeline = useCallback(() => {
    cancelledRef.current = true;
    addLog("Orchestrator: Stop requested — finishing current agent...");
  }, [addLog]);

  const agents: AgentInfo[] = AGENTS.map((a) => ({
    ...a,
    status: agentStatuses[a.id] || "idle",
  }));

  return {
    agents,
    outputData,
    rawOutputs,
    logs,
    isRunning,
    runPipeline,
    stopPipeline,
    updateVisualTopicAsset,
    updateCourseContent,
    loadPersistedState,
    clearPipelineState,
  };
}
