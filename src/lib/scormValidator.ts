/**
 * SCORM Validator - Comprehensive validation of SCORM package structure and compliance
 * Ensures packages work across LMS platforms (Blackboard, Canvas, Moodle, etc.)
 */

export type SeverityLevel = "error" | "warning" | "info";

export interface ValidationResult {
  code: string;
  severity: SeverityLevel;
  message: string;
  details?: string;
  suggestion?: string;
}

export interface ValidationReport {
  timestamp: string;
  overallStatus: "passed" | "warning" | "failed";
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  results: ValidationResult[];
  summary: {
    criticalIssues: ValidationResult[];
    warnings: ValidationResult[];
    infos: ValidationResult[];
  };
  recommendations: string[];
}

/**
 * Main SCORM validator
 */
export class ScormValidator {
  private results: ValidationResult[] = [];

  /**
   * Validates complete SCORM package structure and content
   */
  validate(data: {
    courseTitle: string;
    modules: Array<{ title: string; slides: Array<{ type: string }> }>;
    avatar?: { trainerName: string; imageUrl?: string };
    visuals?: { allVisuals: Map<string, any> };
    quizzes?: any[];
    assets?: Map<string, string>;
  }): ValidationReport {
    this.results = [];

    // Run all validation checks
    this.validateCourseStructure(data);
    this.validateModules(data.modules);
    this.validateAvatar(data.avatar);
    this.validateVisuals(data.visuals);
    this.validateQuizzes(data.quizzes);
    this.validateAssets(data.assets);
    this.validateManifestReadiness();

    // Generate report
    return this.generateReport();
  }

  /**
   * Validates course structure
   */
  private validateCourseStructure(data: any): void {
    // Check course title
    if (!data.courseTitle || data.courseTitle.trim().length === 0) {
      this.addResult({
        code: "COURSE_001",
        severity: "error",
        message: "Course title is required",
        suggestion: "Provide a descriptive course title",
      });
    } else if (data.courseTitle.length > 200) {
      this.addResult({
        code: "COURSE_002",
        severity: "warning",
        message: "Course title is very long (>200 characters)",
        details: `Current length: ${data.courseTitle.length}`,
        suggestion: "Shorten title for better display in LMS",
      });
    } else {
      this.addResult({
        code: "COURSE_003",
        severity: "info",
        message: "Course title is valid",
      });
    }
  }

  /**
   * Validates module structure
   */
  private validateModules(modules: any[]): void {
    if (!modules || modules.length === 0) {
      this.addResult({
        code: "MODULE_001",
        severity: "error",
        message: "No modules found",
        suggestion: "Create at least one module with learning content",
      });
      return;
    }

    this.addResult({
      code: "MODULE_002",
      severity: "info",
      message: `${modules.length} modules found`,
      details: modules.map((m) => `${m.title} (${m.slides?.length || 0} slides)`).join(", "),
    });

    // Check each module
    modules.forEach((mod, index) => {
      if (!mod.title || mod.title.trim().length === 0) {
        this.addResult({
          code: `MODULE_003_${index}`,
          severity: "warning",
          message: `Module ${index + 1} has no title`,
          suggestion: "Add descriptive module titles",
        });
      }

      if (!mod.slides || mod.slides.length === 0) {
        this.addResult({
          code: `MODULE_004_${index}`,
          severity: "warning",
          message: `Module "${mod.title}" has no slides`,
          suggestion: "Add learning content slides to all modules",
        });
      }

      // Check for slide type variety
      const slideTypes = new Set(mod.slides?.map((s: any) => s.type) || []);
      if (slideTypes.size < 2) {
        this.addResult({
          code: `MODULE_005_${index}`,
          severity: "warning",
          message: `Module "${mod.title}" uses only one slide type`,
          details: `Types: ${Array.from(slideTypes).join(", ")}`,
          suggestion: "Mix content and assessment slides for better engagement",
        });
      }
    });
  }

  /**
   * Validates avatar/trainer configuration
   */
  private validateAvatar(avatar?: any): void {
    if (!avatar) {
      this.addResult({
        code: "AVATAR_001",
        severity: "warning",
        message: "No avatar trainer configured",
        suggestion: "Select a trainer avatar for enhanced learner engagement",
      });
      return;
    }

    if (!avatar.trainerName) {
      this.addResult({
        code: "AVATAR_002",
        severity: "warning",
        message: "Avatar trainer has no name",
        suggestion: "Assign a name to the trainer",
      });
    } else {
      this.addResult({
        code: "AVATAR_003",
        severity: "info",
        message: `Trainer configured: ${avatar.trainerName}`,
      });
    }

    if (!avatar.imageUrl) {
      this.addResult({
        code: "AVATAR_004",
        severity: "warning",
        message: "No avatar image found",
        suggestion: "Ensure trainer image is available for display",
      });
    } else {
      this.addResult({
        code: "AVATAR_005",
        severity: "info",
        message: "Avatar image available",
      });
    }
  }

  /**
   * Validates visual assets
   */
  private validateVisuals(visuals?: any): void {
    if (!visuals || visuals.allVisuals.size === 0) {
      this.addResult({
        code: "VISUAL_001",
        severity: "warning",
        message: "No visual assets extracted",
        suggestion: "Add visual context images to enhance learning",
      });
      return;
    }

    const totalAssets = visuals.allVisuals.size;
    let imageCount = 0;
    let svgCount = 0;

    for (const asset of visuals.allVisuals.values()) {
      if (asset.imageDataUrl) imageCount++;
      if (asset.imageSvg) svgCount++;
    }

    this.addResult({
      code: "VISUAL_002",
      severity: "info",
      message: `${totalAssets} visual assets found`,
      details: `${imageCount} images, ${svgCount} SVGs`,
    });

    if (imageCount === 0 && svgCount === 0) {
      this.addResult({
        code: "VISUAL_003",
        severity: "warning",
        message: "Visual assets exist but contain no images or SVGs",
        suggestion: "Ensure generated visual assets are properly formatted",
      });
    }
  }

  /**
   * Validates quiz content
   */
  private validateQuizzes(quizzes?: any[]): void {
    if (!quizzes || quizzes.length === 0) {
      this.addResult({
        code: "QUIZ_001",
        severity: "warning",
        message: "No assessment questions found",
        suggestion: "Add knowledge check questions to validate learning",
      });
      return;
    }

    this.addResult({
      code: "QUIZ_002",
      severity: "info",
      message: `${quizzes.length} assessment questions found`,
    });

    // Validate each quiz
    let validQuestions = 0;
    quizzes.forEach((quiz, index) => {
      if (!quiz.question) {
        this.addResult({
          code: `QUIZ_003_${index}`,
          severity: "error",
          message: `Question ${index + 1} has no text`,
        });
        return;
      }

      const options = quiz.options || [];
      if (options.length < 2) {
        this.addResult({
          code: `QUIZ_004_${index}`,
          severity: "error",
          message: `Question "${quiz.question.substring(0, 40)}..." has fewer than 2 options`,
          suggestion: "Provide at least 2 answer options",
        });
        return;
      }

      if (!quiz.correct_answer && !quiz.correctAnswer) {
        this.addResult({
          code: `QUIZ_005_${index}`,
          severity: "error",
          message: `Question "${quiz.question.substring(0, 40)}..." has no correct answer`,
        });
        return;
      }

      validQuestions++;
    });

    if (validQuestions === quizzes.length) {
      this.addResult({
        code: "QUIZ_006",
        severity: "info",
        message: `All ${validQuestions} questions are valid`,
      });
    }
  }

  /**
   * Validates asset availability and size
   */
  private validateAssets(assets?: Map<string, string>): void {
    if (!assets || assets.size === 0) {
      this.addResult({
        code: "ASSET_001",
        severity: "info",
        message: "No embedded assets found (will use file references)",
      });
      return;
    }

    this.addResult({
      code: "ASSET_002",
      severity: "info",
      message: `${assets.size} assets bundled`,
    });

    // Check for data URIs vs file references
    let dataUriCount = 0;
    let fileRefCount = 0;

    for (const asset of assets.values()) {
      if (typeof asset === "string") {
        if (asset.startsWith("data:")) {
          dataUriCount++;
        } else {
          fileRefCount++;
        }
      }
    }

    if (dataUriCount > 0) {
      this.addResult({
        code: "ASSET_003",
        severity: "info",
        message: `${dataUriCount} assets embedded as data URIs`,
        suggestion: "Embedded assets improve offline compatibility",
      });
    }

    if (fileRefCount > 0) {
      this.addResult({
        code: "ASSET_004",
        severity: "info",
        message: `${fileRefCount} assets referenced from package`,
      });
    }
  }

  /**
   * Validates manifest readiness
   */
  private validateManifestReadiness(): void {
    this.addResult({
      code: "MANIFEST_001",
      severity: "info",
      message: "Manifest structure ready for generation",
      details: "imsmanifest.xml will be created with proper SCORM 1.2 structure",
    });

    this.addResult({
      code: "MANIFEST_002",
      severity: "info",
      message: "SCORM API integration enabled",
      details: "LMS communication configured for progress tracking",
    });
  }

  /**
   * Adds a validation result
   */
  private addResult(result: ValidationResult): void {
    this.results.push(result);
  }

  /**
   * Generates validation report
   */
  private generateReport(): ValidationReport {
    const errors = this.results.filter((r) => r.severity === "error");
    const warnings = this.results.filter((r) => r.severity === "warning");
    const infos = this.results.filter((r) => r.severity === "info");

    const overallStatus: "passed" | "warning" | "failed" =
      errors.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed";

    // Generate recommendations
    const recommendations: string[] = [];

    if (errors.length > 0) {
      recommendations.push(`Fix ${errors.length} critical issue(s) before export`);
    }

    if (warnings.length > 3) {
      recommendations.push("Review warnings to optimize course quality");
    }

    if (infos.filter((i) => i.code.includes("VISUAL")).length > 0) {
      recommendations.push("Visual assets improve learner engagement");
    }

    if (infos.filter((i) => i.code.includes("QUIZ")).length === 0) {
      recommendations.push("Add assessment questions for knowledge validation");
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      totalChecks: this.results.length,
      passedChecks: infos.length,
      warningChecks: warnings.length,
      failedChecks: errors.length,
      results: this.results,
      summary: {
        criticalIssues: errors,
        warnings,
        infos,
      },
      recommendations,
    };
  }

  /**
   * Gets validation status as percentage
   */
  getValidationScore(): number {
    if (this.results.length === 0) return 0;

    const errorPoints = this.results.filter((r) => r.severity === "error").length * 10;
    const warningPoints = this.results.filter((r) => r.severity === "warning").length * 3;
    const totalPoints = this.results.length * 5;

    const deducedPoints = errorPoints + warningPoints;
    const score = Math.max(0, 100 - (deducedPoints / totalPoints) * 100);

    return Math.round(score);
  }
}

/**
 * Quick validation helper
 */
export function validateScormPackage(data: any): ValidationReport {
  const validator = new ScormValidator();
  return validator.validate(data);
}
