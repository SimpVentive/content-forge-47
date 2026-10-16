/**
 * SCORM Export Orchestrator - Coordinates entire export flow
 * Brings together all phases: validation → rendering → assets → packaging
 * Main entry point for SCORM package creation
 */

import JSZip from "jszip";
import { createLearnerScormPackage, type PortableLearnerProps } from "@/lib/learnerScormPackage";
import type { RawAgentOutputs } from "@/types/agents";



import { validateScormPackage, type ValidationReport } from "@/lib/scormValidator";
import { validateScormPackage as validatePackage, type PackageValidationReport } from "@/lib/scormPackageValidator";
export interface ExportOptions extends Partial<Omit<PortableLearnerProps, "rawOutputs" | "courseTitle">> {
  courseTitle: string;
  courseDescription?: string;
  trainerId?: string;
  enableVoiceNarration?: boolean;
  embedStrategy?: "data-uri" | "file-reference";
  passingScore?: number;
  courseVersion?: string;
}

export interface ExportProgress {
  stage: "validation" | "rendering" | "assets" | "packaging" | "complete";
  percentage: number;
  message: string;
  details?: string;
}

export type ExportCallback = (progress: ExportProgress) => void;

export interface ExportResult {
  success: boolean;
  zip?: JSZip;
  fileBlob?: Blob;
  fileName: string;
  preValidation: ValidationReport;
  postValidation?: PackageValidationReport;
  message: string;
  fileSize?: number;
  duration: number; // milliseconds
}

/**
 * Main export orchestrator - coordinates entire SCORM creation process
 */
export class ScormExportOrchestrator {
  private onProgress: ExportCallback;

  constructor(onProgress: ExportCallback = () => {}) {
    this.onProgress = onProgress;
  }

  /**
   * Main export function - complete SCORM package creation
   */
  async export(
    rawOutputs: RawAgentOutputs,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const fileName = `${sanitizeFilename(options.courseTitle)}_SCORM.zip`;

    try {
      // Step 1: BUILD SLIDES
      this.report("rendering", 10, "Building course slides...");

      const { buildSlides } = await import("@/components/contentforge/LearnerPreview");
      const { modules, slides } = buildSlides(rawOutputs, options.insertedVideos, options.courseDuration, options.slideLayout?.maxLines, options.assessmentIntensity);

      this.report("rendering", 20, "Slides built", `${slides.length} slides created`);

      // Step 2: VALIDATE STRUCTURE (now with actual modules)
      this.report("validation", 25, "Validating course structure...");

      const preValidation = validateScormPackage({
        courseTitle: options.courseTitle,
        modules: modules.map(m => ({
          title: m.title,
          slides: slides.filter(s => s.moduleIndex === modules.indexOf(m))
        })),
        avatar: options.trainerId ? { trainerName: "Trainer" } : undefined,
      });

      if (preValidation.overallStatus === "failed") {
        return {
          success: false,
          fileName,
          preValidation,
          message: "Export blocked: Critical validation errors detected",
          duration: Date.now() - startTime,
        };
      }

      this.report("validation", 30, "Validation passed", `Quality score: ${Math.round((preValidation.passedChecks / preValidation.totalChecks) * 100)}%`);

      // Package the real stateful preview. Static SSR loses navigation, trainer
      // animation and assessments and is not a valid substitute for the preview.
      const portable = await createLearnerScormPackage({
        courseTitle: options.courseTitle,
        companyLogo: options.companyLogo,
        rawOutputs,
        avatarTrainerId: options.trainerId,
        courseDuration: options.courseDuration,
        insertedVideos: options.insertedVideos,
        slideLayout: options.slideLayout,
        learnerNotesEnabled: options.learnerNotesEnabled,
        resourcesPanelEnabled: options.resourcesPanelEnabled,
        glossaryEnabled: options.glossaryEnabled,
        infographicsEnabled: options.infographicsEnabled,
        discussionEnabled: options.discussionEnabled,
        assessmentIntensity: options.assessmentIntensity,
        flipStylePreference: options.flipStylePreference,
        textLanguage: options.textLanguage,
        narratorLanguage: options.narratorLanguage,
        captionsEnabled: options.captionsEnabled,
        exportMedia: options.exportMedia,
      }, options.passingScore ?? 70, message => this.report("assets", 50, message));
      this.report("packaging", 90, "Finalizing learner package...");
      const portableBlob = await portable.zip.generateAsync({ type: "blob" });
      const portableValidation = await validatePackage(portable.zip, portableBlob.size);
      this.report("complete", 100, "Export complete!");
      return {
        success: portableValidation.isValid, zip: portable.zip, fileBlob: portableBlob,
        fileName, preValidation, postValidation: portableValidation,
        message: portableValidation.isValid ? "SCORM package created successfully" : "Package validation failed",
        fileSize: portableBlob.size, duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Export Orchestrator] Error:", error);

      return {
        success: false,
        fileName,
        preValidation: {
          timestamp: new Date().toISOString(),
          overallStatus: "failed",
          totalChecks: 0,
          passedChecks: 0,
          warningChecks: 0,
          failedChecks: 1,
          results: [
            {
              code: "EXPORT_ERROR",
              severity: "error",
              message: `Export failed: ${errorMessage}`,
            },
          ],
          summary: {
            criticalIssues: [
              {
                code: "EXPORT_ERROR",
                severity: "error",
                message: `Export failed: ${errorMessage}`,
              },
            ],
            warnings: [],
            infos: [],
          },
          recommendations: ["Review error details and try again"],
        },
        message: `Export failed: ${errorMessage}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Reports progress
   */
  private report(
    stage: ExportProgress["stage"],
    percentage: number,
    message: string,
    details?: string
  ): void {
    this.onProgress({
      stage,
      percentage: Math.min(100, Math.max(0, percentage)),
      message,
      details,
    });
  }
}

/**
 * Sanitizes filename for safe file operations
 */
function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

/**
 * Downloads blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Quick export helper
 */
export async function exportToScorm(
  rawOutputs: RawAgentOutputs,
  options: ExportOptions,
  onProgress?: ExportCallback
): Promise<ExportResult> {
  const orchestrator = new ScormExportOrchestrator(onProgress);
  return await orchestrator.export(rawOutputs, options);
}
