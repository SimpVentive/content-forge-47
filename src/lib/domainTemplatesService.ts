/**
 * Domain Templates Service
 * Stores and applies domain-specific knowledge and best practices
 */

export interface DomainTemplate {
  domain: string;
  requiredElements: string[];
  imageStyle: string;
  toneGuidance: string;
  complianceRequirements: string[];
  visualEnvironment: string;
  scenarioExamples: string[];
}

/**
 * Pre-built domain templates based on common learning needs
 */
const DOMAIN_TEMPLATES: Record<string, DomainTemplate> = {
  "pharma-sop": {
    domain: "Pharma SOP",
    requiredElements: [
      "Complete procedural steps (no omissions)",
      "Safety/PPE requirements",
      "Equipment and tools required",
      "Calibration and validation steps",
      "Documentation/logbook entries",
      "Shutdown and cleanup procedures",
      "GMP compliance alignment",
    ],
    imageStyle: "Realistic clinical/laboratory environment",
    toneGuidance: "Professional, procedural, compliance-focused. No casual interactions.",
    complianceRequirements: [
      "All steps traceable to source SOP",
      "Safety-critical steps highlighted",
      "Regulatory alignment confirmed",
      "Equipment properly identified",
    ],
    visualEnvironment: "Professional laboratory, clean room, or clinical setting with proper equipment",
    scenarioExamples: [
      "Column extraction with proper technique",
      "Sample preparation with safety protocols",
      "Equipment calibration with verification",
      "Documentation of results",
    ],
  },
  "finance-compliance": {
    domain: "Finance & Compliance",
    requiredElements: [
      "Regulatory framework context",
      "Risk identification and mitigation",
      "Audit trail and documentation",
      "Decision-making checkpoints",
      "Escalation procedures",
      "Controls and verification steps",
    ],
    imageStyle: "Professional business environment",
    toneGuidance: "Authoritative, regulatory-aware, risk-conscious",
    complianceRequirements: [
      "Regulatory alignment verified",
      "Risk factors explicitly addressed",
      "Controls clearly shown",
      "Audit trail demonstrated",
    ],
    visualEnvironment: "Professional office, meeting rooms, or secure environments",
    scenarioExamples: [
      "Transaction approval workflow",
      "Risk assessment process",
      "Compliance review checkpoint",
      "Documentation verification",
    ],
  },
  "safety-training": {
    domain: "Safety Training",
    requiredElements: [
      "Hazard identification",
      "Prevention measures",
      "Emergency procedures",
      "PPE requirements",
      "Reporting protocols",
      "Safety verification checks",
    ],
    imageStyle: "Clear, realistic workplace scenarios",
    toneGuidance: "Serious, safety-critical, no casual treatment",
    complianceRequirements: [
      "All hazards clearly identified",
      "Prevention steps explicit",
      "Emergency procedures covered",
      "Reporting requirements shown",
    ],
    visualEnvironment: "Realistic workplace with proper safety equipment and signage",
    scenarioExamples: [
      "Hazard identification walkthrough",
      "Emergency response execution",
      "PPE inspection procedure",
      "Incident reporting process",
    ],
  },
  "general-corporate": {
    domain: "Corporate Training",
    requiredElements: [
      "Clear learning objectives",
      "Real-world context",
      "Business relevance",
      "Practical application",
      "Key takeaways",
    ],
    imageStyle: "Professional and engaging",
    toneGuidance: "Professional yet approachable",
    complianceRequirements: [
      "Alignment with organizational policies",
      "Accessibility standards met",
    ],
    visualEnvironment: "Diverse professional settings reflecting company culture",
    scenarioExamples: [
      "Team collaboration scenario",
      "Customer interaction example",
      "Problem-solving walkthrough",
      "Leadership decision point",
    ],
  },
};

/**
 * Get domain template and merge with learning insights
 */
export function getDomainTemplate(
  domainInput: string,
  learnedRequirements?: {
    mustInclude: string[];
    mustAvoid: string[];
    imageGuidelines: string[];
    complianceChecks: string[];
  }
): DomainTemplate {
  const domainLower = domainInput.toLowerCase();

  // Find matching template
  let template = Object.values(DOMAIN_TEMPLATES).find(t =>
    t.domain.toLowerCase().includes(domainLower) ||
    domainLower.includes(t.domain.toLowerCase())
  );

  if (!template) {
    // Default template if no match found
    template = DOMAIN_TEMPLATES["general-corporate"];
  }

  // Merge with learned requirements
  if (learnedRequirements) {
    return {
      ...template,
      requiredElements: [
        ...template.requiredElements,
        ...learnedRequirements.mustInclude.filter(
          item => !template!.requiredElements.some(e => e.toLowerCase().includes(item.toLowerCase()))
        ),
      ],
      complianceRequirements: [
        ...template.complianceRequirements,
        ...learnedRequirements.complianceChecks.filter(
          item => !template!.complianceRequirements.some(e => e.toLowerCase().includes(item.toLowerCase()))
        ),
      ],
    };
  }

  return template;
}

/**
 * Get image generation guidance specific to domain
 */
export function getImageGenerationGuidance(
  domainInput: string,
  learnedGuidelines?: string[]
): {
  environment: string;
  style: string;
  dontGenerate: string[];
  examples: string[];
  complianceNotes: string[];
} {
  const template = getDomainTemplate(domainInput);

  return {
    environment: template.visualEnvironment,
    style: template.imageStyle,
    dontGenerate: [
      "Casual or unprofessional scenarios",
      "Cartoon or overly stylized depictions",
      "Inconsistent settings or characters",
      "Images that don't advance the procedure",
      ...(domainInput.toLowerCase().includes("pharma") || domainInput.toLowerCase().includes("sop")
        ? [
            "Family discussion or casual social scenarios",
            "Non-clinical office environments for procedures",
            "Missing safety equipment or PPE",
          ]
        : []),
      ...(learnedGuidelines || []),
    ],
    examples: template.scenarioExamples,
    complianceNotes: template.complianceRequirements,
  };
}

/**
 * Generate domain-specific prompt enhancement for image generation
 */
export function enhanceImagePromptWithDomainRules(
  basePrompt: string,
  domain: string,
  learnedRequirements?: {
    mustInclude: string[];
    mustAvoid: string[];
    imageGuidelines: string[];
    complianceChecks: string[];
  }
): string {
  const guidance = getImageGenerationGuidance(domain, learnedRequirements?.imageGuidelines);

  const enhancement = `
[DOMAIN: ${domain}]
Setting: ${guidance.environment}
Style: ${guidance.style}

MUST INCLUDE:
- ${guidance.examples.slice(0, 2).join("\n- ")}
- Professional execution and proper technique
- All required equipment/tools visible and properly used

DO NOT GENERATE:
- ${guidance.dontGenerate.slice(0, 3).join("\n- ")}

COMPLIANCE:
${guidance.complianceNotes.map(note => `- ${note}`).join("\n")}

Original Prompt:
${basePrompt}
`;

  return enhancement;
}

/**
 * Get all available domain templates
 */
export function getAvailableDomains(): string[] {
  return Object.values(DOMAIN_TEMPLATES).map(t => t.domain);
}
