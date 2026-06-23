/**
 * Negative Prompt Library Service
 * Manages and applies exclusion rules for image generation
 * Builds from QA findings to prevent recurring issues
 */

export interface NegativePromptEntry {
  id: string;
  category: "style" | "content" | "context" | "quality" | "compliance";
  prompt: string;
  reason: string;
  domains: string[];
  severity: "critical" | "high" | "medium";
  addedFromIssue?: string;
  frequency?: number;
}

/**
 * Base negative prompt library - lessons learned from QA findings
 */
const BASE_NEGATIVE_PROMPTS: NegativePromptEntry[] = [
  // General quality issues
  {
    id: "quality_poor_resolution",
    category: "quality",
    prompt: "low resolution, pixelated, blurry, distorted, malformed",
    reason: "Ensure high-quality professional imagery",
    domains: ["all"],
    severity: "critical",
  },
  {
    id: "quality_inconsistent_style",
    category: "quality",
    prompt: "inconsistent art style, mismatched characters, varying quality between scenes",
    reason: "Maintain visual consistency across scenes",
    domains: ["all"],
    severity: "high",
  },

  // Content misalignment
  {
    id: "content_topic_mismatch",
    category: "content",
    prompt: "scenes that don't advance the procedure, off-topic content, unrelated activities",
    reason: "Every image must support learning objectives",
    domains: ["all"],
    severity: "critical",
  },
  {
    id: "content_casual_tone",
    category: "content",
    prompt: "casual family discussion, social gathering, non-professional interaction",
    reason: "Avoid casual scenarios in procedural/compliance training",
    domains: ["pharma-sop", "finance", "safety"],
    severity: "high",
  },

  // Style issues
  {
    id: "style_cartoon",
    category: "style",
    prompt: "cartoon, anime, illustration, sketch, non-photorealistic",
    reason: "Maintain professional realism for compliance training",
    domains: ["pharma-sop", "finance", "safety"],
    severity: "high",
  },
  {
    id: "style_abstract",
    category: "style",
    prompt: "abstract, minimalist, symbolic representation, conceptual art",
    reason: "Use realistic, clear depictions for procedural training",
    domains: ["pharma-sop", "safety"],
    severity: "high",
  },

  // Context/environment issues
  {
    id: "context_wrong_environment",
    category: "context",
    prompt: "casual home environment, non-professional setting, inadequate workspace",
    reason: "Use appropriate professional/clinical environments",
    domains: ["pharma-sop", "finance", "safety"],
    severity: "critical",
  },
  {
    id: "context_missing_equipment",
    category: "context",
    prompt: "missing equipment, improper tools, inadequate safety gear, no PPE",
    reason: "All required equipment and safety gear must be visible",
    domains: ["pharma-sop", "safety"],
    severity: "critical",
  },

  // Compliance issues
  {
    id: "compliance_unsafe_practice",
    category: "compliance",
    prompt: "unsafe handling, improper technique, missing safety steps, regulatory violation",
    reason: "All procedures must follow compliance and safety standards",
    domains: ["pharma-sop", "safety"],
    severity: "critical",
  },
  {
    id: "compliance_missing_documentation",
    category: "compliance",
    prompt: "no documentation visible, missing logbook, no verification steps",
    reason: "Documentation and verification are critical compliance elements",
    domains: ["pharma-sop", "finance"],
    severity: "high",
  },
];

/**
 * Get negative prompts for a specific domain
 */
export function getNegativePromptsForDomain(domain: string): NegativePromptEntry[] {
  const domainLower = domain.toLowerCase();

  return BASE_NEGATIVE_PROMPTS.filter(entry =>
    entry.domains.includes("all") || entry.domains.some(d => domainLower.includes(d.toLowerCase()))
  );
}

/**
 * Convert negative prompts to string format for image generation
 */
export function buildNegativePromptString(domain: string, additionalExclusions?: string[]): string {
  const prompts = getNegativePromptsForDomain(domain);

  const exclusions = [
    ...prompts.map(p => p.prompt),
    ...(additionalExclusions || []),
  ];

  return exclusions.join(", ");
}

/**
 * Add a new negative prompt entry from QA findings
 */
export function addNegativePromptFromQAFinding(
  category: "style" | "content" | "context" | "quality" | "compliance",
  description: string,
  reason: string,
  domains: string[],
  severity: "critical" | "high" | "medium" = "medium"
): NegativePromptEntry {
  const id = `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    category,
    prompt: description,
    reason,
    domains,
    severity,
    addedFromIssue: new Date().toISOString(),
    frequency: 1,
  };
}

/**
 * Get critical negative prompts (severity: critical) for a domain
 */
export function getCriticalNegativePrompts(domain: string): string[] {
  return getNegativePromptsForDomain(domain)
    .filter(entry => entry.severity === "critical")
    .map(entry => entry.prompt);
}

/**
 * Build complete image generation exclusion guidance
 */
export function buildImageExclusionGuidance(
  domain: string,
  learnedNegativePrompts?: NegativePromptEntry[]
): {
  negativePrompt: string;
  critical: string[];
  guidelines: string[];
} {
  const basePrompts = getNegativePromptsForDomain(domain);
  const allPrompts = [...basePrompts, ...(learnedNegativePrompts || [])];

  const negativePromptStr = buildNegativePromptString(domain);
  const critical = getCriticalNegativePrompts(domain);

  const guidelines = [
    ...new Set(
      allPrompts
        .filter(p => p.severity === "high" || p.severity === "critical")
        .map(p => `${p.reason}`)
    ),
  ];

  return {
    negativePrompt: negativePromptStr,
    critical,
    guidelines,
  };
}

/**
 * Get the complete list of base negative prompts
 */
export function getBaseNegativePrompts(): NegativePromptEntry[] {
  return BASE_NEGATIVE_PROMPTS;
}
