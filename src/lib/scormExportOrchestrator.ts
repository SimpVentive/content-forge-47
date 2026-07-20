/**
 * SCORM Export Orchestrator - Coordinates entire export flow
 * Brings together all phases: validation → rendering → assets → packaging
 * Main entry point for SCORM package creation
 */

import JSZip from "jszip";
import type { RawAgentOutputs } from "@/types/agents";
import { buildSlides, type Slide, type Module } from "@/lib/slideBuilder";
import { renderScormModuleHtml } from "@/lib/scormRenderEngine";
import { orchestrateAssets, type OrchestrationResult } from "@/lib/scormAssetOrchestrator";
import { validateScormPackage, type ValidationReport } from "@/lib/scormValidator";
import { validateScormPackage as validatePackage, type PackageValidationReport } from "@/lib/scormPackageValidator";
import {
  generateManifest,
  msToIsoDuration,
  type ManifestMetadata,
  type ManifestOrganization,
  type ManifestResource,
} from "@/lib/scormManifestGenerator";

export interface ExportOptions {
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
      // Step 1: PRE-EXPORT VALIDATION
      this.report("validation", 5, "Running pre-export validation...");

      const preValidation = validateScormPackage({
        courseTitle: options.courseTitle,
        modules: [],
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

      this.report("validation", 15, "Validation passed", `Quality score: ${Math.round((preValidation.passedChecks / preValidation.totalChecks) * 100)}%`);

      // Step 2: BUILD SLIDES
      this.report("rendering", 20, "Building course slides...");

      const { modules, slides } = buildSlides(
        rawOutputs,
        [],
        options.courseDescription
      );

      this.report("rendering", 30, "Slides built", `${slides.length} slides created`);

      // Step 3: ORCHESTRATE ASSETS
      this.report("assets", 35, "Orchestrating assets...");

      const assetResult = await orchestrateAssets(rawOutputs, {
        trainerId: options.trainerId,
        embedStrategy: options.embedStrategy || "data-uri",
        enableVoiceNarration: options.enableVoiceNarration,
      });

      this.report("assets", 50, "Assets prepared", `${assetResult.assetMap.visuals.size} visuals bundled`);

      // Step 4: RENDER MODULES TO HTML
      this.report("rendering", 55, "Rendering modules to HTML...");

      const moduleHtmls: Array<{ html: string; module: Module }> = [];

      for (let modIndex = 0; modIndex < modules.length; modIndex++) {
        const module = modules[modIndex];
        const moduleSlides = slides.filter((s) => s.moduleIndex === modIndex);

        // Apply embedded asset URLs to slides (replace visual URLs with processed URLs from asset map)
        const slidesWithEmbeddedAssets = moduleSlides.map((slide) => {
          if (slide.type !== "content") return slide;

          const updatedSlide = { ...slide };
          if (slide.topicTitle && assetResult.assetMap.visuals.has(slide.topicTitle)) {
            updatedSlide.visualImageDataUrl = assetResult.assetMap.visuals.get(slide.topicTitle);
          }

          return updatedSlide;
        });

        try {
          const html = await renderScormModuleHtml({
            courseTitle: options.courseTitle,
            module,
            moduleIndex: modIndex,
            totalModules: modules.length,
            slides: slidesWithEmbeddedAssets,
            quizzes: [],
            avatarImageUrl: assetResult.assetMap.avatar,
            trainerName: assetResult.avatar.trainerName,
          });

          moduleHtmls.push({ html, module });

          const progress = 55 + (modIndex / modules.length) * 25;
          this.report("rendering", progress, `Rendered module ${modIndex + 1}/${modules.length}`);
        } catch (error) {
          console.error(`Failed to render module ${modIndex}:`, error);
          throw new Error(`Module rendering failed for "${module.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      this.report("rendering", 80, "HTML rendering complete");

      // Step 5: CREATE ZIP PACKAGE
      this.report("packaging", 85, "Creating SCORM package...");

      const zip = new JSZip();

      // Add manifest
      const manifestMetadata: ManifestMetadata = {
        courseId: `course_${Date.now()}`,
        courseTitle: options.courseTitle,
        courseDescription: options.courseDescription,
        courseVersion: options.courseVersion || "1.0",
        author: "Content Forge",
        createdDate: new Date(),
        modifiedDate: new Date(),
        duration: msToIsoDuration(modules.length * 15 * 60 * 1000), // Estimate 15min per module
        passingScore: options.passingScore || 70,
      };

      const manifestOrganization: ManifestOrganization = {
        title: options.courseTitle,
        items: slides
          .filter((s) => s.type === "content")
          .map((slide, idx) => ({
            identifier: `slide_${slide.moduleIndex}_${idx}`,
            title: slide.topicTitle || `Slide ${idx + 1}`,
            resourceId: `res_${slide.moduleIndex}_${idx}`,
          })),
      };

      const manifestResources: ManifestResource[] = moduleHtmls.map((item, idx) => ({
        id: `res_module_${idx}`,
        type: "webcontent",
        href: `module_${idx}.html`,
        scormType: "sco",
        files: [{ href: `module_${idx}.html` }],
      }));

      const manifestXml = generateManifest(manifestMetadata, manifestOrganization, manifestResources);
      zip.file("imsmanifest.xml", manifestXml);

      // Add HTML modules with assets applied
      for (let i = 0; i < moduleHtmls.length; i++) {
        const item = moduleHtmls[i];
        // Assets are already inlined in renderScormModuleHtml, just add to ZIP
        zip.file(`module_${i}.html`, item.html);
      }

      // Add assets to ZIP
      if (assetResult.assetMap.avatar) {
        if (!assetResult.assetMap.avatar.startsWith("data:")) {
          zip.file(`assets/images/avatar.jpg`, assetResult.assetMap.avatar);
        }
      }

      for (const [topicTitle, assetUrl] of assetResult.assetMap.visuals) {
        if (!assetUrl.startsWith("data:")) {
          const filename = `${sanitizeFilename(topicTitle)}.png`;
          zip.file(`assets/images/${filename}`, assetUrl);
        }
      }

      this.report("packaging", 92, "Package structure created");

      // Step 6: GENERATE ZIP BLOB
      this.report("packaging", 95, "Finalizing package...");

      const fileBlob = await zip.generateAsync({ type: "blob" });
      const fileSize = fileBlob.size;

      this.report("packaging", 98, "Package generated", `Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

      // Step 7: POST-EXPORT VALIDATION
      this.report("packaging", 99, "Validating package...");

      const postValidation = await validatePackage(zip, fileSize);

      this.report("complete", 100, "Export complete!", `Package ready for download`);

      return {
        success: postValidation.isValid,
        zip,
        fileBlob,
        fileName,
        preValidation,
        postValidation,
        message: postValidation.isValid
          ? "SCORM package created successfully"
          : "Package created with warnings",
        fileSize,
        duration: Date.now() - startTime,
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
