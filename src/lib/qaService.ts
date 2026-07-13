import type { RawAgentOutputs, OutputData } from "@/types/agents";

export interface QAIssue {
  category: "missing_steps" | "compliance_gap" | "traceability" | "accuracy" | "completeness" | "consistency";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  location?: string;
  examples?: string[];
}

export interface QACorrection {
  section: "script" | "assessment" | "visual" | "overall";
  type: string;
  description: string;
  tokensAdded?: number;
  tokensRemoved?: number;
}

export interface QAResult {
  issuesFound: QAIssue[];
  correctionsApplied: QACorrection[];
  overallSeverity: "critical" | "high" | "medium" | "low";
  wasAutoFixed: boolean;
  revisedOutputs?: Partial<RawAgentOutputs & OutputData>;
  report: string;
}

interface QAContext {
  courseTitle: string;
  inputText: string;
  domain?: string;
  topic?: string;
  domainSpecificRequirements?: Record<string, string[]>;
}

export async function runFinalQACheck(
  context: QAContext,
  rawOutputs: RawAgentOutputs,
  outputData: OutputData,
  callClaude: (system: string, user: string) => Promise<string>
): Promise<QAResult> {
  const systemPrompt = `You are an expert quality assurance reviewer for AI-generated learning courses. Your task is to validate the final output against the input requirements and identify gaps, issues, or inconsistencies.

You must respond ONLY with valid JSON (no markdown, no explanations, just JSON).`;

  const userMessage = buildQAPrompt(context, rawOutputs, outputData);

  let responseText = "";
  try {
    responseText = await callClaude(systemPrompt, userMessage);
  } catch (error) {
    console.error("Final QA check: model call failed:", error);
    // Don't fail the whole pipeline — return an empty successful QA result.
    return {
      issuesFound: [],
      correctionsApplied: [],
      overallSeverity: "low",
      wasAutoFixed: false,
      revisedOutputs: {},
      report: `QA check could not run (${(error as Error).message}). Output was not modified.`,
    };
  }

  // Try to parse as JSON — extract from markdown fences or first {...} block.
  let jsonText = responseText.trim();
  const fenceMatch =
    jsonText.match(/```json\n?([\s\S]*?)\n?```/) ||
    jsonText.match(/```\n?([\s\S]*?)\n?```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  if (!jsonText.startsWith("{")) {
    const braceStart = jsonText.indexOf("{");
    const braceEnd = jsonText.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonText = jsonText.slice(braceStart, braceEnd + 1);
    }
  }

  try {
    const result = JSON.parse(jsonText);
    return parseQAResult(result, rawOutputs, outputData);
  } catch (error) {
    console.error("Final QA check: JSON parse failed. Raw response:", responseText);
    // Fall back to a plain-text report instead of throwing.
    return {
      issuesFound: [],
      correctionsApplied: [],
      overallSeverity: "low",
      wasAutoFixed: false,
      revisedOutputs: {},
      report: responseText.slice(0, 2000) || "QA check returned no parseable result.",
    };
  }
}

function buildQAPrompt(
  context: QAContext,
  rawOutputs: RawAgentOutputs,
  outputData: OutputData
): string {
  const requirements = buildDomainRequirements(context);

  return `You are a final quality assurance reviewer for an AI-generated learning course.

**INPUT:**
Course Title: ${context.courseTitle}
Domain: ${context.domain || "General"}
Input/Scope: ${context.inputText.slice(0, 500)}${context.inputText.length > 500 ? "..." : ""}

**GENERATED OUTPUT:**
Script/Content:
${rawOutputs.writer ? rawOutputs.writer.slice(0, 1500) : "(no script)"}
${rawOutputs.writer && rawOutputs.writer.length > 1500 ? "..." : ""}

Assessment:
${rawOutputs.assessment ? rawOutputs.assessment.slice(0, 500) : "(no assessment)"}
${rawOutputs.assessment && rawOutputs.assessment.length > 500 ? "..." : ""}

Visual Plan:
${rawOutputs.visual ? rawOutputs.visual.slice(0, 500) : "(no visual plan)"}

**DOMAIN REQUIREMENTS:**
${requirements}

**YOUR TASK:**
1. Compare the input scope against the final output
2. Identify specific gaps, issues, or inconsistencies
3. Categorize issues by type (missing_steps, compliance_gap, traceability, accuracy, completeness, consistency)
4. Suggest fixes for each critical/high-severity issue
5. Estimate effort to fix (tokens to add/remove)

**RESPONSE FORMAT:**
Respond with a JSON object containing:
{
  "issuesFound": [
    {
      "category": "missing_steps|compliance_gap|traceability|accuracy|completeness|consistency",
      "severity": "critical|high|medium|low",
      "description": "specific issue description",
      "location": "where in the output",
      "examples": ["example 1", "example 2"]
    }
  ],
  "correctionsApplied": [
    {
      "section": "script|assessment|visual|overall",
      "type": "added_section|rewrote_section|added_question|etc",
      "description": "what was fixed",
      "tokensAdded": 150
    }
  ],
  "overallSeverity": "critical|high|medium|low",
  "revisedScript": "complete revised script if major issues found, otherwise null",
  "revisedAssessment": "revised assessment if gaps found, otherwise null",
  "report": "1-2 paragraph human-readable summary of findings and fixes"
}`;
}

function buildDomainRequirements(context: QAContext): string {
  if (context.domain?.toLowerCase().includes("pharma")) {
    return `- All SOP/process steps must be included (setup, execution, validation, shutdown)
- Compliance requirements: PPE, calibration, sample tracking, logbook entries, GMP alignment
- Safety-critical steps must have visual representation
- All steps must be traceable to source SOP document
- Assessment must include scenario-based compliance questions`;
  }

  if (context.domain?.toLowerCase().includes("finance") || context.domain?.toLowerCase().includes("accounting")) {
    return `- Regulatory compliance: SOX, anti-fraud controls, audit trails
- All calculation methods must be clearly explained
- Examples must use realistic scenarios
- Assessment should test practical application
- Risk factors must be identified`;
  }

  return `- All key concepts from input must be covered
- Learning objectives must align with difficulty level
- Assessment questions must test stated objectives
- Examples must be practical and relevant
- Completeness: no critical gaps in learning flow`;
}

function parseQAResult(
  rawResult: Record<string, any>,
  originalOutputs: RawAgentOutputs,
  originalData: OutputData
): QAResult {
  const issues: QAIssue[] = (rawResult.issuesFound || []).map((issue: any) => ({
    category: issue.category || "completeness",
    severity: issue.severity || "medium",
    description: issue.description || "",
    location: issue.location,
    examples: issue.examples,
  }));

  const corrections: QACorrection[] = (rawResult.correctionsApplied || []).map((corr: any) => ({
    section: corr.section || "overall",
    type: corr.type || "",
    description: corr.description || "",
    tokensAdded: corr.tokensAdded,
    tokensRemoved: corr.tokensRemoved,
  }));

  const overallSeverity = rawResult.overallSeverity || calculateSeverity(issues);

  const revisedOutputs: Partial<RawAgentOutputs & OutputData> = {};
  if (rawResult.revisedScript) {
    revisedOutputs.writer = rawResult.revisedScript;
    revisedOutputs.script = rawResult.revisedScript;
  }
  if (rawResult.revisedAssessment) {
    revisedOutputs.assessment = rawResult.revisedAssessment;
  }

  return {
    issuesFound: issues,
    correctionsApplied: corrections,
    overallSeverity: overallSeverity as any,
    wasAutoFixed: Object.keys(revisedOutputs).length > 0,
    revisedOutputs,
    report: rawResult.report || "QA review completed.",
  };
}

function calculateSeverity(issues: QAIssue[]): string {
  if (issues.some((i) => i.severity === "critical")) return "critical";
  if (issues.some((i) => i.severity === "high")) return "high";
  if (issues.some((i) => i.severity === "medium")) return "medium";
  return "low";
}

export async function storeQAAuditLog(
  courseDraftId: string,
  userId: string,
  qaResult: QAResult,
  context: QAContext,
  beforeOutputs: RawAgentOutputs,
  afterOutputs: RawAgentOutputs,
  supabaseClient?: any
): Promise<void> {
  try {
    // If no Supabase client provided, just log locally
    if (!supabaseClient) {
      console.log("QA Audit Log (would be stored to DB):", {
        courseDraftId,
        userId,
        domain: context.domain,
        topic: context.topic,
        issuesFound: qaResult.issuesFound,
        correctionsApplied: qaResult.correctionsApplied,
        severity: qaResult.overallSeverity,
        wasAcceptedByUser: true,
      });
      return;
    }

    // Store to Supabase qa_audit_logs table
    const { error } = await supabaseClient
      .from("qa_audit_logs")
      .insert([
        {
          course_draft_id: courseDraftId,
          user_id: userId,
          domain: context.domain,
          topic: context.topic,
          issues_found: qaResult.issuesFound,
          corrections_applied: qaResult.correctionsApplied,
          severity: qaResult.overallSeverity,
          was_accepted_by_user: true,
          before_output: beforeOutputs,
          after_output: afterOutputs,
        },
      ]);

    if (error) {
      console.error("Failed to store QA audit log:", error);
    }
  } catch (error) {
    console.error("Error storing QA audit log:", error);
  }
}
