import { useState, useCallback } from "react";
import { AgentInfo, AgentStatus, AGENTS, OutputData } from "@/types/agents";

const initialStatuses = (): Record<string, AgentStatus> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus]));

const initialOutput = (): OutputData => ({ outline: "", script: "", assessment: "", package: "" });

const timestamp = () => {
  const d = new Date();
  return `[${d.toLocaleTimeString("en-US", { hour12: false })}]`;
};

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  // Since we don't have a backend proxy, we'll simulate the API call
  // In production, this would call an edge function
  await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));

  // Simulate based on the system prompt
  if (systemPrompt.includes("Research Agent")) {
    return JSON.stringify({
      themes: [
        "Hazard Identification & Risk Assessment",
        "Personal Protective Equipment (PPE)",
        "Emergency Response Procedures",
        "Regulatory Compliance (OSHA)",
        "Ergonomics & Injury Prevention",
      ],
      knowledge_areas: [
        "Occupational Safety & Health Administration Standards",
        "Industrial Hygiene & Hazardous Materials",
        "Workplace Ergonomics Research",
      ],
      objectives: [
        "Identify common workplace hazards in manufacturing environments",
        "Select and properly use appropriate PPE for specific tasks",
        "Demonstrate lockout/tagout (LOTO) procedures",
        "Interpret Safety Data Sheets (SDS) for chemical handling",
        "Execute emergency evacuation and response protocols",
        "Conduct a basic job hazard analysis (JHA)",
        "Apply ergonomic principles to reduce musculoskeletal injuries",
        "Document and report safety incidents per OSHA guidelines",
      ],
    }, null, 2);
  }

  if (systemPrompt.includes("Content Architect")) {
    return JSON.stringify({
      course_title: "Workplace Safety for Manufacturing Teams",
      modules: [
        {
          title: "Module 1: Foundations of Workplace Safety",
          topics: [
            { name: "Introduction to OSHA Standards", blooms_level: "Remember" },
            { name: "Safety Culture in Manufacturing", blooms_level: "Understand" },
            { name: "Rights and Responsibilities", blooms_level: "Understand" },
          ],
        },
        {
          title: "Module 2: Hazard Identification & Control",
          topics: [
            { name: "Types of Manufacturing Hazards", blooms_level: "Analyze" },
            { name: "Job Hazard Analysis (JHA)", blooms_level: "Apply" },
            { name: "Hierarchy of Controls", blooms_level: "Evaluate" },
            { name: "Chemical Safety & SDS", blooms_level: "Apply" },
          ],
        },
        {
          title: "Module 3: Protective Equipment & Procedures",
          topics: [
            { name: "PPE Selection and Use", blooms_level: "Apply" },
            { name: "Machine Guarding Principles", blooms_level: "Understand" },
            { name: "Lockout/Tagout (LOTO)", blooms_level: "Apply" },
          ],
        },
        {
          title: "Module 4: Emergency Preparedness",
          topics: [
            { name: "Emergency Action Plans", blooms_level: "Analyze" },
            { name: "First Aid and Incident Response", blooms_level: "Apply" },
            { name: "Incident Reporting & Investigation", blooms_level: "Evaluate" },
          ],
        },
        {
          title: "Module 5: Ergonomics & Long-Term Safety",
          topics: [
            { name: "Ergonomic Risk Factors", blooms_level: "Analyze" },
            { name: "Injury Prevention Strategies", blooms_level: "Create" },
            { name: "Building a Personal Safety Plan", blooms_level: "Create" },
          ],
        },
      ],
    }, null, 2);
  }

  if (systemPrompt.includes("Instructional Writer")) {
    return `# Module 1: Foundations of Workplace Safety

## Introduction — Why This Matters to You

Picture this: It's your first day on the manufacturing floor. The machines are humming, forklifts are moving, and there's a rhythm to everything. It feels exciting — maybe a little overwhelming. But here's what you need to know before anything else: **your safety is the most important thing in this building.**

Every year, thousands of manufacturing workers are injured in preventable accidents. This module is your foundation — the knowledge that keeps you safe, confident, and compliant from day one.

---

## Section 1: Understanding OSHA Standards

You've probably heard of OSHA — the Occupational Safety and Health Administration. Think of them as the rule-makers for workplace safety in the U.S. Their standards aren't suggestions; they're legal requirements your employer must follow.

Here's what matters to you:
- **General Duty Clause**: Your employer must provide a workplace "free from recognized hazards."
- **Right to Know**: You have the right to know about hazardous chemicals you work near — that's where Safety Data Sheets come in.
- **Right to Report**: You can report unsafe conditions without fear of retaliation.

*Example*: If you notice a missing guard on a press machine, you have both the right and responsibility to report it before anyone operates it.

---

## Section 2: Building a Safety Culture

Safety isn't just about following rules — it's a mindset. In the best manufacturing facilities, safety is part of the culture. That means:

- **Speaking up** when you see something wrong
- **Looking out** for your coworkers, not just yourself
- **Participating** in safety meetings and training actively
- **Leading by example**, even when no one's watching

A strong safety culture reduces accidents by up to 70%. You're not just protecting yourself — you're protecting your team.

---

## Section 3: Your Rights and Responsibilities

Let's break this down simply:

**Your Rights:**
- Access to training in a language you understand
- Access to safety records and injury logs
- Request an OSHA inspection if you believe conditions are unsafe

**Your Responsibilities:**
- Follow all safety procedures and rules
- Wear required PPE at all times
- Report hazards, injuries, and near-misses immediately

---

## Summary

You now understand the foundation of workplace safety: OSHA sets the rules, your employer must follow them, and *you* play a critical role in making safety real on the floor. A strong safety culture starts with knowledge — and you've just taken the first step.

---

## Reflection Question

> Think about a time you noticed something unsafe — at work, at home, or in public. Did you say something? What would you do differently now that you understand your rights and responsibilities?`;
  }

  return "Output generated successfully.";
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
