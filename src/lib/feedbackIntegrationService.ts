/**
 * Feedback Integration Service
 * Integrates learning insights into generation prompts
 * Creates a feedback loop from QA findings to improved future generations
 */

import {
  analyzeDomainPatterns,
  generateLearningInsights,
  getDomainRecommendations,
  type AuditLogEntry,
} from "@/lib/learningAnalyticsService";

import {
  getDomainTemplate,
  enhanceImagePromptWithDomainRules,
  type DomainTemplate,
} from "@/lib/domainTemplatesService";

import {
  getNegativePromptsForDomain,
  buildNegativePromptString,
  buildImageExclusionGuidance,
  type NegativePromptEntry,
} from "@/lib/negativePromptLibraryService";

export interface EnhancedGenerationContext {
  domain: string;
  basePrompt: string;
  domainTemplate: DomainTemplate;
  insights: any[];
  recommendations: {
    mustInclude: string[];
    mustAvoid: string[];
    imageGuidelines: string[];
    complianceChecks: string[];
  };
  negativePrompts: string;
  enhancedPrompt: string;
}

/**
 * Build comprehensive generation context with all learnings
 */
export function buildEnhancedGenerationContext(
  domain: string,
  basePrompt: string,
  auditLogs: AuditLogEntry[]
): EnhancedGenerationContext {
  // Step 1: Analyze domain patterns from audit logs
  const pattern = analyzeDomainPatterns(auditLogs, domain);
  const insights = generateLearningInsights(pattern);
  const recommendations = getDomainRecommendations(auditLogs, domain);

  // Step 2: Get domain template with learned requirements
  const domainTemplate = getDomainTemplate(domain, recommendations);

  // Step 3: Build negative prompts with learnings
  const negativePrompts = buildNegativePromptString(domain);

  // Step 4: Enhance base prompt with all learnings
  const enhancedPrompt = enhancePromptWithLearnings(
    basePrompt,
    domain,
    domainTemplate,
    insights,
    recommendations
  );

  return {
    domain,
    basePrompt,
    domainTemplate,
    insights,
    recommendations,
    negativePrompts,
    enhancedPrompt,
  };
}

/**
 * Enhance a generation prompt with all learned insights
 */
function enhancePromptWithLearnings(
  basePrompt: string,
  domain: string,
  domainTemplate: DomainTemplate,
  insights: any[],
  recommendations: {
    mustInclude: string[];
    mustAvoid: string[];
    imageGuidelines: string[];
    complianceChecks: string[];
  }
): string {
  const sections: string[] = [basePrompt];

  // Add domain context
  sections.push(`\n[DOMAIN TEMPLATE: ${domain}]`);

  // Add must-include requirements
  if (recommendations.mustInclude.length > 0) {
    sections.push(`\nMUST INCLUDE (from domain template):`);
    recommendations.mustInclude.forEach(item => {
      sections.push(`- ${item}`);
    });
  }

  // Add must-avoid guidelines
  if (recommendations.mustAvoid.length > 0) {
    sections.push(`\nMUST AVOID (from domain template):`);
    recommendations.mustAvoid.forEach(item => {
      sections.push(`- ${item}`);
    });
  }

  // Add compliance checks
  if (domainTemplate.complianceRequirements.length > 0) {
    sections.push(`\nCOMPLIANCE REQUIREMENTS:`);
    domainTemplate.complianceRequirements.forEach(req => {
      sections.push(`- ${req}`);
    });
  }

  // Add learned insights
  if (insights.length > 0) {
    sections.push(`\nLEARNED FROM PREVIOUS GENERATIONS:`);
    insights.slice(0, 3).forEach(insight => {
      sections.push(`- ${insight.recommendation}`);
    });
  }

  // Add tone guidance
  sections.push(`\nTONE: ${domainTemplate.toneGuidance}`);

  return sections.join("\n");
}

/**
 * Enhance image generation prompt with all learnings
 */
export function enhanceImageGenerationPrompt(
  baseImagePrompt: string,
  domain: string,
  auditLogs: AuditLogEntry[]
): {
  enhancedPrompt: string;
  negativePrompt: string;
  guidance: string[];
} {
  const context = buildEnhancedGenerationContext(domain, baseImagePrompt, auditLogs);
  const exclusion = buildImageExclusionGuidance(domain);

  return {
    enhancedPrompt: context.enhancedPrompt,
    negativePrompt: exclusion.negativePrompt,
    guidance: exclusion.guidelines,
  };
}

/**
 * Enhance architect/writer prompts with learnings
 */
export function enhanceScriptGenerationPrompt(
  baseScriptPrompt: string,
  domain: string,
  auditLogs: AuditLogEntry[]
): {
  enhancedPrompt: string;
  requirements: string[];
  complianceNotes: string[];
} {
  const context = buildEnhancedGenerationContext(domain, baseScriptPrompt, auditLogs);

  return {
    enhancedPrompt: context.enhancedPrompt,
    requirements: context.domainTemplate.requiredElements,
    complianceNotes: context.domainTemplate.complianceRequirements,
  };
}

/**
 * Enhance assessment/question prompts with learnings
 */
export function enhanceAssessmentGenerationPrompt(
  baseAssessmentPrompt: string,
  domain: string,
  auditLogs: AuditLogEntry[]
): {
  enhancedPrompt: string;
  focusAreas: string[];
  complianceGaps: string[];
} {
  const context = buildEnhancedGenerationContext(domain, baseAssessmentPrompt, auditLogs);
  const recommendations = context.recommendations;

  // Focus assessment on commonly missed areas
  const focusAreas = [
    ...context.insights.map(i => i.affectedAreas).flat(),
    ...recommendations.mustInclude.slice(0, 3),
  ];

  // Identify compliance gaps from learnings
  const complianceGaps = context.domainTemplate.complianceRequirements
    .filter(req => recommendations.mustAvoid.some(avoid => req.toLowerCase().includes(avoid.toLowerCase())));

  return {
    enhancedPrompt: context.enhancedPrompt,
    focusAreas: [...new Set(focusAreas)],
    complianceGaps,
  };
}

/**
 * Create a learning report for administrators
 */
export function generateLearningReport(
  domain: string,
  auditLogs: AuditLogEntry[]
): {
  domain: string;
  totalSamples: number;
  commonIssues: { type: string; frequency: number; resolution: string }[];
  recommendations: string[];
  successRate: number;
} {
  const filtered = auditLogs.filter(
    log => !log.domain || log.domain.toLowerCase().includes(domain.toLowerCase())
  );

  if (filtered.length === 0) {
    return {
      domain,
      totalSamples: 0,
      commonIssues: [],
      recommendations: [],
      successRate: 100,
    };
  }

  const pattern = analyzeDomainPatterns(filtered, domain);
  const insights = generateLearningInsights(pattern);

  const successRate =
    (filtered.filter(log => log.issuesFound.length === 0).length / filtered.length) * 100;

  return {
    domain,
    totalSamples: filtered.length,
    commonIssues: pattern.commonIssues.map(issue => ({
      type: issue.type,
      frequency: issue.frequency,
      resolution: insights.find(i => i.insight.includes(issue.type))?.recommendation || "Monitor",
    })),
    recommendations: insights.map(i => i.recommendation),
    successRate: Math.round(successRate * 10) / 10,
  };
}
