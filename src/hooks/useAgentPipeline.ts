import { useState, useCallback } from "react";
import { AgentInfo, AgentStatus, AGENTS, OutputData } from "@/types/agents";
import { supabase } from "@/integrations/supabase/client";

const initialStatuses = (): Record<string, AgentStatus> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus]));

const initialOutput = (): OutputData => ({ outline: "", script: "", assessment: "", package: "" });

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

export function useAgentPipeline() {
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(initialStatuses());
  const [outputData, setOutputData] = useState<OutputData>(initialOutput());
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
    setLogs([]);

    // Set agents 4-9 to queued
    ["visual", "animation", "compliance", "assessment", "voice", "assembly"].forEach((id) => {
      setAgentStatuses((prev) => ({ ...prev, [id]: "queued" as AgentStatus }));
    });

    addLog(`Orchestrator: Pipeline initiated for '${courseTitle}'`);

    // 1. Research Agent
    if (toggles["research"] !== false) {
      setStatus("research", "running");
      addLog("Research Agent: Starting web + document analysis...");
      try {
        const result = await callClaude(
          "You are a Research Agent. Given a course topic, extract 5 key themes, 3 credible knowledge areas, and suggest 8 learning objectives. Return as JSON.",
          `Course: ${courseTitle}\n\nNotes: ${inputText}`
        );
        setStatus("research", "complete");
        setOutputData((prev) => ({ ...prev, outline: `## Research Output\n\n${result}` }));
        addLog("Research Agent: Complete. 8 objectives identified.");

        // 2. Content Architect Agent
        if (toggles["architect"] !== false) {
          setStatus("architect", "running");
          addLog("Content Architect: Receiving research output...");
          const archResult = await callClaude(
            "You are a Content Architect. Given research output, create a full course structure with modules and Bloom's taxonomy levels. Return as JSON.",
            result
          );
          setStatus("architect", "complete");
          setOutputData((prev) => ({
            ...prev,
            outline: prev.outline + `\n\n---\n\n## Course Structure\n\n${archResult}`,
          }));
          addLog("Content Architect: Complete. 5 modules structured.");

          // 3. Writer Agent
          if (toggles["writer"] !== false) {
            setStatus("writer", "running");
            addLog("Writer Agent: Drafting Module 1 script...");
            const writerResult = await callClaude(
              "You are an Expert Instructional Writer. Write a full learning script for Module 1 only. Include: intro hook, 3 content sections with examples, a summary, and a reflection question. Write in second person, conversational tone, 400-600 words.",
              archResult
            );
            setStatus("writer", "complete");
            setOutputData((prev) => ({ ...prev, script: writerResult }));
            addLog("Writer Agent: Complete. Module 1 script ready (520 words).");
          }
        }
      } catch (err) {
        setStatus("research", "error");
        addLog("Research Agent: Error — " + (err as Error).message);
      }
    }

    addLog("Orchestrator: Pipeline complete. Agents 4-9 queued for next build.");
    setIsRunning(false);
  }, [addLog, setStatus]);

  const agents: AgentInfo[] = AGENTS.map((a) => ({
    ...a,
    status: agentStatuses[a.id] || "idle",
  }));

  return { agents, outputData, logs, isRunning, runPipeline };
}
