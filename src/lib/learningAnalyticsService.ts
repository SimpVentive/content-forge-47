/**
 * Learning Analytics Service
 * Analyzes QA audit logs to extract patterns and insights
 * for continuous system improvement
 */

export interface DomainPattern {
  domain: string;
  commonIssues: {
    type: string;
    frequency: number;
    examples: string[];
  }[];
  successfulPatterns: string[];
  averageSeverity: "critical" | "high" | "medium" | "low";
}

export interface LearningInsight {
  domain: string;
  insight: string;
  frequency: number;
  recommendation: string;
  affectedAreas: ("images" | "script" | "assessment" | "overall")[];
}

export interface AuditLogEntry {
  domain?: string;
  issuesFound: Array<{
    category: string;
    severity: string;
    description: string;
  }>;
  correctionsApplied: Array<{
    section: string;
    type: string;
    description: string;
  }>;
  wasAccepted: boolean;
}

/**
 * Analyze patterns from historical QA audit logs
 */
export function analyzeDomainPatterns(
  auditLogs: AuditLogEntry[],
  domain?: string
): DomainPattern {
  const filtered = domain
    ? auditLogs.filter(log => log.domain?.toLowerCase() === domain.toLowerCase())
    : auditLogs;

  if (filtered.length === 0) {
    return {
      domain: domain || "general",
      commonIssues: [],
      successfulPatterns: [],
      averageSeverity: "medium",
    };
  }

  // Count issue types
  const issueMap = new Map<string, { count: number; examples: Set<string>; severities: string[] }>();

  filtered.forEach(log => {
    log.issuesFound.forEach(issue => {
      const key = issue.category;
      if (!issueMap.has(key)) {
        issueMap.set(key, { count: 0, examples: new Set(), severities: [] });
      }
      const entry = issueMap.get(key)!;
      entry.count++;
      entry.examples.add(issue.description);
      entry.severities.push(issue.severity);
    });
  });

  // Convert to sorted list
  const commonIssues = Array.from(issueMap.entries())
    .map(([type, data]) => ({
      type,
      frequency: data.count,
      examples: Array.from(data.examples).slice(0, 3),
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Calculate average severity
  const allSeverities = filtered
    .flatMap(log => log.issuesFound.map(i => i.severity))
    .filter(Boolean);

  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const avgSeverity = allSeverities.length > 0
    ? allSeverities.reduce((sum, s) => sum + (severityOrder[s as keyof typeof severityOrder] || 0), 0) / allSeverities.length
    : 2;

  const severityMap = { 4: "critical", 3: "high", 2: "medium", 1: "low" };
  const roundedSeverity = Math.round(avgSeverity);

  return {
    domain: domain || "general",
    commonIssues,
    successfulPatterns: [
      "Clear visual narrative alignment",
      "Complete step coverage",
      "Domain-appropriate imagery",
      "Professional tone consistency",
    ],
    averageSeverity: (severityMap[roundedSeverity as keyof typeof severityMap] || "medium") as any,
  };
}

/**
 * Extract actionable insights from patterns
 */
export function generateLearningInsights(pattern: DomainPattern): LearningInsight[] {
  const insights: LearningInsight[] = [];

  // Most common issues become insights
  pattern.commonIssues.slice(0, 3).forEach(issue => {
    if (issue.frequency >= 2) {
      const insightMap: Record<string, { recommendation: string; areas: ("images" | "script" | "assessment" | "overall")[] }> = {
        "missing_steps": {
          recommendation: "Update architect/writer prompts to explicitly require comprehensive step coverage with no omissions",
          areas: ["script", "overall"],
        },
        "compliance_gap": {
          recommendation: "Add domain-specific compliance checklist to generation prompts based on prior findings",
          areas: ["script", "assessment"],
        },
        "traceability": {
          recommendation: "Ensure visual narrative builder includes all script steps as image scenes",
          areas: ["images", "script"],
        },
        "image_topic_mismatch": {
          recommendation: "Create domain-specific image generation guidelines with professional context requirements",
          areas: ["images"],
        },
        "consistency": {
          recommendation: "Add consistency validation to content architect stage to prevent variations",
          areas: ["overall"],
        },
      };

      const mapping = insightMap[issue.type.replace(/[-_]/g, "_")] || {
        recommendation: `Review and enhance generation prompts for ${issue.type}`,
        areas: ["overall" as const],
      };

      insights.push({
        domain: pattern.domain,
        insight: `Frequent ${issue.type} issues (${issue.frequency} occurrences)`,
        frequency: issue.frequency,
        recommendation: mapping.recommendation,
        affectedAreas: mapping.areas,
      });
    }
  });

  return insights;
}

/**
 * Get domain-specific recommendations from learning data
 */
export function getDomainRecommendations(
  auditLogs: AuditLogEntry[],
  domain: string
): {
  mustInclude: string[];
  mustAvoid: string[];
  imageGuidelines: string[];
  complianceChecks: string[];
} {
  const pattern = analyzeDomainPatterns(auditLogs, domain);
  const insights = generateLearningInsights(pattern);

  const domainLower = domain.toLowerCase();
  const isPharma = domainLower.includes("pharma") || domainLower.includes("sop");
  const isFinance = domainLower.includes("finance") || domainLower.includes("accounting");

  return {
    mustInclude: [
      ...(isPharma ? [
        "All procedural steps (setup, execution, validation, shutdown)",
        "Safety/compliance requirements (PPE, calibration, documentation)",
        "Clinical/professional environment imagery",
      ] : []),
      ...(isFinance ? [
        "Regulatory compliance context",
        "Risk assessment and mitigation",
        "Professional business scenarios",
      ] : []),
      "Clear step-by-step progression",
      "Domain-appropriate terminology",
    ],
    mustAvoid: [
      ...(isPharma ? [
        "Casual or family discussion scenarios",
        "Non-clinical or office-only environments",
        "Incomplete procedure steps",
      ] : []),
      ...(isFinance ? [
        "Cartoon or overly informal styles",
        "Generic business scenarios without context",
      ] : []),
      "Topic misalignment in visuals",
      "Inconsistent terminology",
    ],
    imageGuidelines: [
      ...(isPharma ? [
        "Professional medical/clinical settings",
        "Proper equipment and tools visible",
        "Realistic procedure execution",
        "Professional attire and PPE",
      ] : []),
      ...(isFinance ? [
        "Professional office environments",
        "Business-appropriate scenarios",
        "Clear process visualization",
      ] : []),
      "Consistent character/setting across scenes",
      "Professional composition and lighting",
    ],
    complianceChecks: [
      ...(isPharma ? [
        "GMP/regulatory alignment",
        "Safety requirements covered",
        "Documentation requirements shown",
      ] : []),
      ...(isFinance ? [
        "Regulatory compliance verified",
        "Risk factors identified",
      ] : []),
      ...insights.map(i => i.recommendation),
    ],
  };
}
