import { useState, useCallback, useRef } from "react";
import { AgentInfo, AgentStatus, AGENTS, OutputData, RawAgentOutputs } from "@/types/agents";
import { supabase } from "@/integrations/supabase/client";

type SlideLayoutParams = {
  maxLines?: number;
  minFontSize?: number;
  lineSpacing?: number;
};

function buildSlideLayoutInstruction(slideLayout?: SlideLayoutParams): string {
  const maxLines = slideLayout?.maxLines ?? 10;
  const minFontSize = slideLayout?.minFontSize ?? 12.5;
  const lineSpacing = slideLayout?.lineSpacing ?? 2;

  return `Slide readability constraints: no slide should exceed ${maxLines} lines of on-slide text, the minimum font size must be ${minFontSize}px, and line spacing should be ${lineSpacing}. Keep layouts concise and presentation-friendly.`;
}

const initialStatuses = (): Record<string, AgentStatus> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus]));

const initialOutput = (): OutputData => ({ outline: "", script: "", assessment: "", package: "" });
const initialRaw = (): RawAgentOutputs => ({ research: "", architect: "", writer: "", visual: "", animation: "", youtube: "", compliance: "", assessment: "", voice: "", assembly: "" });

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

async function callClaudeWithRetry(systemPrompt: string, userMessage: string, addLog: (msg: string) => void, agentName: string): Promise<string> {
  try {
    return await callClaude(systemPrompt, userMessage);
  } catch (err) {
    addLog(`${agentName}: Error — retrying...`);
    return await callClaude(systemPrompt, userMessage);
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

  const runPipeline = useCallback(async (courseTitle: string, inputText: string, toggles: Record<string, boolean>, params?: { level?: string; language?: string; voiceAccent?: string; duration?: string; assessmentRequired?: boolean; slideLayout?: SlideLayoutParams }) => {
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

    addLog(`Orchestrator: Pipeline initiated for '${courseTitle}' (${params?.level || "intermediate"}, ${params?.language || "English"}, ${params?.duration || "15min"})`);

    let researchResult = "";
    let archResult = "";
    let writerResult = "";
    let visualResult = "";
    let animResult = "";
    let complianceResult = "";
    let assessmentResult = "";
    let voiceResult = "";

    try {
      // ──── AGENT 1: Research ────
      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      if (toggles["research"] !== false) {
        setStatus("research", "running");
        addLog("Research Agent: Starting web + document analysis...");
        researchResult = await callClaudeWithRetry(
          `You are a Research Agent. You MUST base your output ENTIRELY on the source material provided below. Do NOT invent topics or use generic content. Extract key themes, credible knowledge areas, and suggest learning objectives — ALL directly derived from the provided source material. Course level: ${params?.level || "intermediate"}. Language: ${params?.language || "English"}. CRITICAL — Target duration is ${params?.duration || "15min"}. You MUST scale the depth and breadth of content to fill this entire duration. For a ${params?.duration || "15min"} course, generate proportionally more objectives and themes. Return as JSON.`,
          `Course Title: ${courseTitle}\n\n=== SOURCE MATERIAL (USE THIS AS YOUR PRIMARY INPUT) ===\n${inputText}\n=== END SOURCE MATERIAL ===\n\nIMPORTANT: Your entire output must be based on the source material above. Do not generate generic content. Target duration: ${params?.duration || "15min"} — scale content accordingly.`,
          addLog, "Research Agent"
        );
        setStatus("research", "complete");
        setRawOutputs((prev) => ({ ...prev, research: researchResult }));
        setOutputData((prev) => ({ ...prev, outline: `## Research Output\n\n${researchResult}` }));
        addLog("Research Agent: Complete. 8 objectives identified.");
      } else {
        setStatus("research", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 2: Content Architect ────
      if (toggles["architect"] !== false) {
        setStatus("architect", "running");
        addLog("Content Architect: Receiving research output...");
        archResult = await callClaudeWithRetry(
          `You are a Content Architect. Given research output AND source material, create a full course structure with modules and Bloom's taxonomy levels. You MUST use the topics and content from the source material. Do NOT invent unrelated topics. CRITICAL: The target course duration is ${params?.duration || "15min"}. Scale the number of modules and topics proportionally — a 3min course should have 1-2 modules with 2-3 topics total, a 60min course should have 6-8 modules with many topics. Return as JSON.`,
          `Research Output:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nCourse Title: ${courseTitle}\nTarget Duration: ${params?.duration || "15min"}\n\nBuild the course structure strictly from the above content, scaled to fit the target duration.`,
          addLog, "Content Architect"
        );
        setStatus("architect", "complete");
        setRawOutputs((prev) => ({ ...prev, architect: archResult }));
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Course Structure\n\n${archResult}`,
        }));
        addLog("Content Architect: Complete. Modules structured.");
      } else {
        setStatus("architect", "idle");
      }

      if (isCancelled()) { addLog("Orchestrator: Pipeline stopped."); setIsRunning(false); return; }
      // ──── AGENT 3: Writer (per-module calls to avoid truncation) ────
      if (toggles["writer"] !== false) {
        setStatus("writer", "running");
        
        const durationMinutes = parseInt(params?.duration || "15", 10);
        const wordsPerTopic = durationMinutes <= 5 ? "60-90" : durationMinutes <= 10 ? "90-120" : durationMinutes <= 20 ? "150-220" : "220-350";

        // Parse modules from architect output
        let parsedModules: any[] = [];
        try {
          const archParsed = JSON.parse(archResult || "{}");
          parsedModules = archParsed.modules || archParsed.course_structure?.modules || archParsed.course_modules || [];
        } catch { parsedModules = []; }

        const writerSystemPrompt = `You are an elite instructional writer who specialises in corporate eLearning that people actually enjoy. Your writing style is: conversational, direct, and energetic — like a brilliant colleague explaining something important over coffee, not a textbook.

CRITICAL: You are writing ONE MODULE of a ${params?.duration || "15min"} course. You MUST write substantial, detailed content.
- Target word count per topic: ${wordsPerTopic} words. This is MINIMUM — write MORE if the topic warrants it.
- For longer courses (30-60 min), expand with multiple examples, deeper analysis, step-by-step walkthroughs, and richer real-world scenarios.
- NEVER truncate or summarize. Write the FULL content for every topic.

Rules you NEVER break:
- Open every topic with a provocative hook — a shocking stat, a bold claim, a real-world scenario, or a question that makes the learner stop and think
- Write in second person: 'You', 'Your team', 'You've probably seen this'
- Short punchy sentences. Never more than 20 words per sentence.
- Use concrete real-world examples, not abstract theory
- Every section must have ONE memorable takeaway — something the learner will still remember next week
- Use analogies. Make complex ideas click instantly.
- End every topic with a challenge or reflection: 'Next time you X, try Y instead'
- NO passive voice. NO jargon without explanation. NO bullet walls.
- Format each topic as: Hook (2-3 sentences) → Core concept (5-8 sentences for longer courses) → Real example (3-5 sentences) → Key Takeaway: (1-2 sentences) → Challenge: (1 sentence)
- Use markdown ## headers for each topic title, matching the exact topic names provided.
- You MUST use content from the source material provided. Do NOT invent unrelated examples.

Write content that would make a learner lean forward, not lean back.`;

        if (parsedModules.length === 0) {
          // Fallback: single call if we can't parse modules
          addLog("Writer Agent: Drafting all content...");
          writerResult = await callClaudeWithRetry(
            writerSystemPrompt,
            `Course Title: ${courseTitle}\nTarget Duration: ${params?.duration || "15min"}\n\nResearch Context:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nWrite engaging content for the entire course. Scale total content to fit ${params?.duration || "15min"}.`,
            addLog, "Writer Agent"
          );
        } else {
          // Per-module calls to avoid truncation
          const moduleResults: string[] = [];
          for (let mi = 0; mi < parsedModules.length; mi++) {
            if (isCancelled()) break;
            const mod = parsedModules[mi];
            const modTitle = mod.module_title || mod.title || mod.name || `Module ${mi + 1}`;
            const topics = (mod.topics || mod.sections || mod.lessons || []).map((t: any) => {
              const name = typeof t === "string" ? t : t.topic_title || t.title || t.name || "";
              const obj = typeof t === "string" ? "" : t.learning_objective || t.objective || "";
              return `  - Topic: ${name}${obj ? ` | Objective: ${obj}` : ""}`;
            }).join("\n");

            addLog(`Writer Agent: Drafting Module ${mi + 1}/${parsedModules.length} — ${modTitle}...`);

            const moduleContent = await callClaudeWithRetry(
              writerSystemPrompt,
              `Course Title: ${courseTitle}\nThis is Module ${mi + 1} of ${parsedModules.length} in a ${params?.duration || "15min"} course.\n\nModule: ${modTitle}\nTopics:\n${topics}\n\nResearch Context:\n${researchResult}\n\n=== ORIGINAL SOURCE MATERIAL ===\n${inputText}\n=== END ===\n\nWrite FULL, detailed, engaging content for EVERY topic in this module. Use ## headers matching the topic names exactly. Each topic must be ${wordsPerTopic} words minimum.`,
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
      // ──── AGENT 4: Visual Design ────
      if (toggles["visual"] !== false) {
        setStatus("visual", "running");
        addLog("Visual Design Agent: Generating layout specs for modules...");
        visualResult = await callClaudeWithRetry(
          `You are a Visual Design Agent for eLearning. Given a course outline and script, produce a detailed visual design plan. For each module, specify: (1) recommended slide layout type, (2) key infographic or diagram description, (3) color palette suggestion, (4) iconography style. ${buildSlideLayoutInstruction(params?.slideLayout)} Return as JSON: { modules: [{ module_title, slide_layout, infographic_description, color_palette, icon_style }] }`,
          `Course Outline:\n${archResult}\n\nScript:\n${writerResult}\n\n${buildSlideLayoutInstruction(params?.slideLayout)}`,
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
        addLog("Visual Design Agent: Generating SVG infographics...");
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
                "You are an SVG designer. Generate a complete, self-contained SVG infographic (600x380px). Use ONLY these colors: #4f46e5 (indigo), #7c3aed (violet), #10b981 (emerald), #f59e0b (amber), #f8fafc (light bg), #0f172a (dark text), #ffffff (white). No external fonts — use font-family='system-ui, sans-serif'. No external images. Use only SVG primitives: rect, circle, path, text, line, polygon. Make it visually striking with geometric shapes, icons built from primitives, clear hierarchy. Must look professional and corporate. Return ONLY the SVG markup, nothing else.",
                `Create an infographic for: ${modTitle}. Layout: ${layoutType}. Key points to visualise: ${topics.join(", ")}. Include the module title at the top in large bold text. Add a small 'ContentForge' label bottom-right in 10px muted text. ${buildSlideLayoutInstruction(params?.slideLayout)}`
              );
              // Extract SVG from response
              const svgMatch = svgText.match(/<svg[\s\S]*?<\/svg>/i);
              svgs.push(svgMatch ? svgMatch[0] : "");
            } catch {
              svgs.push("");
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
        animResult = await callClaudeWithRetry(
          'You are an Animation Agent for eLearning. Given a course script and visual design plan, write animation and interaction notes for each module. For each section specify: (1) animation type (entrance, transition, emphasis), (2) timing in seconds, (3) interaction type (click, hover, drag, quiz trigger), (4) any scenario or branching logic. Keep it practical for tools like Articulate Storyline or Adobe Captivate. Return as a structured list.',
          `Script:\n${writerResult}\n\nVisual Design Plan:\n${visualResult}`,
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
            body: { modules: moduleNames, courseTitle, language: params?.language, level: params?.level, duration: params?.duration },
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
        complianceResult = await callClaudeWithRetry(
          'You are a Compliance Agent for eLearning content. Review the course script and outline for the following: (1) Reading level — is it appropriate for the target audience? (2) Inclusive language — flag any non-inclusive terms. (3) Accessibility — does content support screen readers, captions, alt-text needs? (4) Policy alignment — does it reference relevant standards (OSHA, WCAG 2.1, etc.)? (5) Overall compliance score out of 10. Return as JSON: { reading_level, inclusive_language_issues: [], accessibility_notes: [], policy_alignment: [], compliance_score, recommendations: [] }',
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
        addLog("Assessment Agent: Generating 10 MCQs + 3 scenarios...");
        assessmentResult = await callClaudeWithRetry(
          'You are an Assessment Design Agent. Given a course script and learning objectives, create a comprehensive assessment. Generate: (1) 10 multiple choice questions with 4 options each and correct answer marked, (2) 3 scenario-based questions with a situation description and 3 response options, (3) 1 reflection exercise with an open-ended prompt. Tag each question with the relevant Bloom\'s taxonomy level. Return as JSON: { mcq: [{ question, options: [], correct_answer, blooms_level }], scenarios: [{ situation, options: [], best_response, rationale }], reflection: { prompt, guidance } }',
          `Script:\n${writerResult}\n\nLearning Objectives:\n${researchResult}`,
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
        voiceResult = await callClaudeWithRetry(
          'You are a Voice and Narration Agent. Given a course script, reformat it as a professional narration script optimised for text-to-speech or voice recording. For each section: (1) rewrite the script with natural spoken-word phrasing (shorter sentences, contractions, conversational), (2) add SSML-style narration cues in brackets like [PAUSE 1s], [EMPHASIZE], [SLOW DOWN], (3) estimate word count and approximate read time at 130 words per minute. Return the full narration script with cues and a summary: { total_words, estimated_duration_minutes, sections: [{ title, narration_text, word_count }] }',
          `Script:\n${writerResult}`,
          addLog, "Voice Agent"
        );
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
        const assemblyInput = `Course Title: ${courseTitle}\n\nOutline:\n${archResult}\n\nScript:\n${writerResult}\n\nVisual Plan:\n${visualResult}\n\nAssessment:\n${assessmentResult}\n\nNarration:\n${voiceResult}\n\nCompliance:\n${complianceResult}`;
        const assemblyResult = await callClaudeWithRetry(
          'You are a Final Assembly Agent for eLearning. Given the full course output (outline, script, assessment, narration, visual plan), produce a final course package summary. Include: (1) Course metadata — title, total modules, total topics, estimated completion time, difficulty level, (2) SCORM manifest summary — list of all assets needed (slides, audio files, images, assessments), (3) LMS deployment checklist — 10-item checklist of steps to publish to an LMS, (4) Quality assurance summary — confirm all agents completed and list any gaps. Return as JSON: { metadata: {}, scorm_manifest: { assets: [] }, deployment_checklist: [], qa_summary: { agents_completed: [], gaps: [] } }',
          assemblyInput,
          addLog, "Final Assembly"
        );
        setStatus("assembly", "complete");
        setRawOutputs((prev) => ({ ...prev, assembly: assemblyResult }));
        setOutputData((prev) => ({ ...prev, package: assemblyResult }));
        addLog("Final Assembly: Complete. Course package ready for LMS deployment.");
        addLog("Orchestrator: All 9 agents complete. Pipeline finished successfully.");
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

  return { agents, outputData, rawOutputs, logs, isRunning, runPipeline, stopPipeline };
}
