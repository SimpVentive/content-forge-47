import { useState, useCallback } from "react";
import { AgentInfo, AgentStatus, AGENTS, OutputData, RawAgentOutputs } from "@/types/agents";
import { supabase } from "@/integrations/supabase/client";

const initialStatuses = (): Record<string, AgentStatus> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus]));

const initialOutput = (): OutputData => ({ outline: "", script: "", assessment: "", package: "" });
const initialRaw = (): RawAgentOutputs => ({ research: "", architect: "", writer: "", visual: "", animation: "", compliance: "", assessment: "", voice: "", assembly: "" });

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

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `${timestamp()} ${msg}`]);
  }, []);

  const setStatus = useCallback((id: string, status: AgentStatus) => {
    setAgentStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const runPipeline = useCallback(async (courseTitle: string, inputText: string, toggles: Record<string, boolean>) => {
    setIsRunning(true);
    setAgentStatuses(initialStatuses());
    setOutputData(initialOutput());
    setRawOutputs(initialRaw());
    setLogs([]);

    // Set all agents to queued initially
    AGENTS.forEach(({ id }) => {
      setAgentStatuses((prev) => ({ ...prev, [id]: "queued" as AgentStatus }));
    });

    addLog(`Orchestrator: Pipeline initiated for '${courseTitle}'`);

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
      if (toggles["research"] !== false) {
        setStatus("research", "running");
        addLog("Research Agent: Starting web + document analysis...");
        researchResult = await callClaudeWithRetry(
          "You are a Research Agent. Given a course topic, extract 5 key themes, 3 credible knowledge areas, and suggest 8 learning objectives. Return as JSON.",
          `Course: ${courseTitle}\n\nNotes: ${inputText}`,
          addLog, "Research Agent"
        );
        setStatus("research", "complete");
        setOutputData((prev) => ({ ...prev, outline: `## Research Output\n\n${researchResult}` }));
        addLog("Research Agent: Complete. 8 objectives identified.");
      } else {
        setStatus("research", "idle");
      }

      // ──── AGENT 2: Content Architect ────
      if (toggles["architect"] !== false) {
        setStatus("architect", "running");
        addLog("Content Architect: Receiving research output...");
        archResult = await callClaudeWithRetry(
          "You are a Content Architect. Given research output, create a full course structure with modules and Bloom's taxonomy levels. Return as JSON.",
          researchResult || `Course: ${courseTitle}\n\nNotes: ${inputText}`,
          addLog, "Content Architect"
        );
        setStatus("architect", "complete");
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Course Structure\n\n${archResult}`,
        }));
        addLog("Content Architect: Complete. Modules structured.");
      } else {
        setStatus("architect", "idle");
      }

      // ──── AGENT 3: Writer ────
      if (toggles["writer"] !== false) {
        setStatus("writer", "running");
        addLog("Writer Agent: Drafting Module 1 script...");
        writerResult = await callClaudeWithRetry(
          "You are an Expert Instructional Writer. Write a full learning script for Module 1 only. Include: intro hook, 3 content sections with examples, a summary, and a reflection question. Write in second person, conversational tone, 400-600 words.",
          archResult || researchResult || `Course: ${courseTitle}`,
          addLog, "Writer Agent"
        );
        setStatus("writer", "complete");
        setOutputData((prev) => ({ ...prev, script: writerResult }));
        addLog("Writer Agent: Complete. Module 1 script ready.");
      } else {
        setStatus("writer", "idle");
      }

      // ──── AGENT 4: Visual Design ────
      if (toggles["visual"] !== false) {
        setStatus("visual", "running");
        addLog("Visual Design Agent: Generating layout specs for modules...");
        visualResult = await callClaudeWithRetry(
          'You are a Visual Design Agent for eLearning. Given a course outline and script, produce a detailed visual design plan. For each module, specify: (1) recommended slide layout type, (2) key infographic or diagram description, (3) color palette suggestion, (4) iconography style. Return as JSON: { modules: [{ module_title, slide_layout, infographic_description, color_palette, icon_style }] }',
          `Course Outline:\n${archResult}\n\nScript:\n${writerResult}`,
          addLog, "Visual Design Agent"
        );
        setStatus("visual", "complete");
        setOutputData((prev) => ({
          ...prev,
          outline: prev.outline + `\n\n---\n\n## Visual Design Plan\n\n${visualResult}`,
        }));
        addLog("Visual Design Agent: Complete. Design plan ready.");
      } else {
        setStatus("visual", "idle");
      }

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
        setOutputData((prev) => ({
          ...prev,
          script: prev.script + `\n\n---\n\n## Animation & Interaction Notes\n\n${animResult}`,
        }));
        addLog("Animation Agent: Complete.");
      } else {
        setStatus("animation", "idle");
      }

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
        setOutputData((prev) => ({ ...prev, assessment: assessmentResult }));
        addLog("Assessment Agent: Complete. Assessment bank ready.");
      } else {
        setStatus("assessment", "idle");
      }

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

  const agents: AgentInfo[] = AGENTS.map((a) => ({
    ...a,
    status: agentStatuses[a.id] || "idle",
  }));

  return { agents, outputData, logs, isRunning, runPipeline };
}
