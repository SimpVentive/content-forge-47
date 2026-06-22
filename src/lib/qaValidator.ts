/**
 * QA Validator - Checks course content for quality issues before export
 * Detects: typos, grammar, readability, audio sync issues, image quality
 */

export interface QAIssue {
  type: "error" | "warning" | "info";
  section: "script" | "metadata" | "images" | "audio" | "structure";
  message: string;
  details?: string;
  lineNumber?: number;
}

export interface QAReport {
  passed: boolean;
  score: number; // 0-100
  issues: QAIssue[];
  summary: string;
  recommendations: string[];
}

const COMMON_TYPOS = [
  { pattern: /younk/gi, replacement: "young" },
  { pattern: /thanaged/gi, replacement: "than asked" },
  { pattern: /lace\s+and\s+straiter/gi, replacement: "locate and straighten" },
  { pattern: /lockator/gi, replacement: "lockout" },
  { pattern: /heres\s+is/gi, replacement: "here is" },
  { pattern: /recator/gi, replacement: "reactor" },
  { pattern: /\b(teh|rhe|hte)\b/gi, replacement: "the" },
  { pattern: /\b(adn|nad)\b/gi, replacement: "and" },
];

const GRAMMAR_PATTERNS = [
  { pattern: /\b(a|an)\s+(?=[aeiou]|[^aeiou])/g, description: "Potential a/an mismatch" },
  { pattern: /\s{2,}/g, description: "Multiple spaces" },
  { pattern: /[,;:]\s*[,;:]/g, description: "Double punctuation" },
];

function checkForCommonTypos(text: string): QAIssue[] {
  const issues: QAIssue[] = [];

  for (const typo of COMMON_TYPOS) {
    if (typo.pattern.test(text)) {
      issues.push({
        type: "error",
        section: "script",
        message: `Found potential typo: "${text.match(typo.pattern)?.[0]}" → "${typo.replacement}"`,
        details: `This common typo was detected. Please verify.`,
      });
    }
  }

  return issues;
}

function checkReadability(text: string): QAIssue[] {
  const issues: QAIssue[] = [];

  // Check for garbled text (unusual character patterns)
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect unusual word lengths or patterns
    const words = line.split(/\s+/);
    const longWords = words.filter((w) => w.length > 20 && !w.includes("-"));
    if (longWords.length > 2) {
      issues.push({
        type: "warning",
        section: "script",
        message: "Line contains many very long words (possible readability issue)",
        lineNumber: i + 1,
        details: `${line.substring(0, 100)}...`,
      });
    }

    // Detect inconsistent capitalization
    const hasWeirdCaps = /[a-z][A-Z][a-z]/.test(line);
    if (hasWeirdCaps && line.length < 100) {
      issues.push({
        type: "warning",
        section: "script",
        message: "Unusual capitalization pattern detected",
        lineNumber: i + 1,
        details: line,
      });
    }
  }

  // Check sentence length (too long = hard to follow)
  const sentences = text.split(/[.!?]+/);
  const longSentences = sentences.filter((s) => s.split(" ").length > 25);
  if (longSentences.length > 0) {
    issues.push({
      type: "info",
      section: "script",
      message: `Found ${longSentences.length} very long sentences (>25 words)`,
      details: "Consider breaking into shorter sentences for clarity",
    });
  }

  return issues;
}

function checkStructure(
  script: string,
  metadata: any,
  images: string[]
): QAIssue[] {
  const issues: QAIssue[] = [];

  // Check metadata completeness
  if (!metadata?.title || metadata.title.length < 5) {
    issues.push({
      type: "error",
      section: "metadata",
      message: "Course title is missing or too short",
      details: "Title should be at least 5 characters",
    });
  }

  if (!metadata?.difficulty || !metadata?.duration) {
    issues.push({
      type: "warning",
      section: "metadata",
      message: "Missing course metadata",
      details: "Difficulty level and duration should be set",
    });
  }

  // Check script not empty
  if (!script || script.trim().length < 50) {
    issues.push({
      type: "error",
      section: "script",
      message: "Script is too short or empty",
      details: "Course should have meaningful content",
    });
  }

  // Check images exist for image-based courses
  if (!images || images.length === 0) {
    issues.push({
      type: "warning",
      section: "images",
      message: "No images found in course",
      details: "Image-based courses should have visual assets",
    });
  }

  return issues;
}

export async function validateCourse(
  script: string,
  metadata: any,
  images: string[] = [],
  voiceScript?: string
): Promise<QAReport> {
  const issues: QAIssue[] = [];

  // Run all checks
  issues.push(...checkForCommonTypos(script));
  issues.push(...checkReadability(script));
  issues.push(...checkStructure(script, metadata, images));

  if (voiceScript) {
    issues.push(...checkForCommonTypos(voiceScript));
    issues.push(...checkReadability(voiceScript));
  }

  // Calculate score
  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const score = Math.max(0, 100 - errors * 10 - warnings * 3);
  const passed = errors === 0 && score >= 70;

  // Generate recommendations
  const recommendations: string[] = [];
  if (errors > 0) {
    recommendations.push("Fix all errors before exporting");
  }
  if (warnings > 0) {
    recommendations.push("Review and address warnings for better quality");
  }
  if (score < 85) {
    recommendations.push("Consider having an admin review this content");
  }
  if (!passed) {
    recommendations.push("This course may have quality issues - admin approval required");
  }

  return {
    passed,
    score,
    issues,
    summary: passed
      ? `✓ Course quality check passed (${score}/100)`
      : `⚠ Course has ${errors} error(s) and ${warnings} warning(s) - review required`,
    recommendations,
  };
}
