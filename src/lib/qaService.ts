import type { RawAgentOutputs, OutputData } from "@/types/agents";

export interface QAIssue {
  category: "missing_steps" | "compliance_gap" | "traceability" | "accuracy" | "completeness" | "consistency";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  location?: string;
  examples?: string[];
  /** The problem restated as a general rule for any future course, or absent when it only applies to this course. */
  lesson?: string;
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

export const SCRIPT_REVIEW_CHARS = 12000;
export const ASSESSMENT_REVIEW_CHARS = 6000;
export const VISUAL_REVIEW_CHARS = 4000;

/**
 * Text for the reviewer. Long sections are shortened at a sentence or line end and clearly marked, because
 * a silent mid-word cut made the reviewer report "truncated mid-sentence" for content that was complete.
 */
export function excerptForReview(text: string | undefined | null, limit: number, empty: string): string {
  const full = (text ?? "").trim();
  if (!full) return empty;
  if (full.length <= limit) return full;
  const shown = full.slice(0, limit);
  const cut = Math.max(shown.lastIndexOf("\n"), shown.lastIndexOf(". "), shown.lastIndexOf("? "), shown.lastIndexOf("! "), shown.lastIndexOf(">"));
  const head = (cut > limit * 0.6 ? shown.slice(0, cut + 1) : shown).trimEnd();
  const omitted = full.length - head.length;
  return `${head}\n[REVIEW EXCERPT ENDS — ${omitted} more characters of this section exist in the course and were not shown]`;
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
The sections below may be review excerpts. An excerpt ends with a line starting "[REVIEW EXCERPT ENDS". Text after that point exists in the course; it was only left out of this review. Never report an excerpt end as truncation, a cut-off or an unfinished sentence.

Script/Content:
${excerptForReview(rawOutputs.writer, SCRIPT_REVIEW_CHARS, "(no script)")}

Assessment:
${excerptForReview(rawOutputs.assessment, ASSESSMENT_REVIEW_CHARS, "(no assessment)")}

Visual Plan:
${excerptForReview(rawOutputs.visual, VISUAL_REVIEW_CHARS, "(no visual plan)")}

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
      "examples": ["example 1", "example 2"],
      "lesson": "the same problem as a general rule for ANY future course, one sentence, no names, topics, quotes or course details (e.g. 'Every assessment question must test a point taught in the script.'); null if it only applies to this course"
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
  "revisedScript": "complete revised script if major issues found AND the script was shown in full (no REVIEW EXCERPT ENDS line), otherwise null",
  "revisedAssessment": "complete revised assessment if gaps found AND the assessment was shown in full, otherwise null",
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
    lesson: typeof issue.lesson === "string" ? issue.lesson : undefined,
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
