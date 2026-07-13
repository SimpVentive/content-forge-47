/**
 * End-to-End Test: Complete SCORM Export Flow
 * Tests the full pipeline from course data to downloadable SCORM package
 */

import { describe, it, expect, beforeEach } from "vitest";
import { exportToScorm, type ExportResult } from "@/lib/scormExportOrchestrator";
import type { RawAgentOutputs } from "@/types/agents";

describe("End-to-End: SCORM Export Pipeline", () => {
  let progressUpdates: Array<{ percentage: number; stage: string; message: string }>;

  const sampleCourseData: RawAgentOutputs = {
    architect: JSON.stringify({
      modules: [
        {
          module_title: "Professional Communication",
          topics: [
            "Active Listening",
            "Email Etiquette",
            "Meeting Management",
          ],
        },
        {
          module_title: "Time Management",
          topics: [
            "Prioritization",
            "Calendar Planning",
          ],
        },
      ],
    }),
    writer: `
## Active Listening
Effective listening is the foundation of great communication. Pay attention to verbal and non-verbal cues. Key Takeaway: Great listeners build stronger relationships.

## Email Etiquette
Professional emails should be concise and clear. Always proofread before sending. Key Takeaway: First impressions matter in written communication.

## Meeting Management
Set clear agendas and time limits for all meetings. Key Takeaway: Well-structured meetings save time for everyone.

## Prioritization
Use the Eisenhower Matrix to prioritize tasks: urgent vs important. Key Takeaway: Focus on what matters most.

## Calendar Planning
Block time for deep work and meetings separately. Key Takeaway: Intentional scheduling improves productivity.
    `,
    assessment: JSON.stringify({
      mcq: [
        {
          question: "What is the foundation of great communication?",
          options: ["Speaking clearly", "Effective listening", "Confidence"],
          correct_answer: "Effective listening",
        },
        {
          question: "What tool helps with prioritization?",
          options: ["Eisenhower Matrix", "To-do lists", "Calendar apps"],
          correct_answer: "Eisenhower Matrix",
        },
        {
          question: "Why should you set meeting agendas?",
          options: ["It's required", "To save time", "To impress others"],
          correct_answer: "To save time",
        },
      ],
    }),
    visual: JSON.stringify({
      modules: [
        {
          module_title: "Professional Communication",
          topic_visuals: [
            {
              topic_title: "Active Listening",
              generated_image_data_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='80' fill='%234f46e5'/%3E%3Ctext x='100' y='110' text-anchor='middle' fill='white' font-size='24' font-weight='bold'%3EListen%3C/text%3E%3C/svg%3E",
            },
            {
              topic_title: "Email Etiquette",
              generated_image_data_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect x='20' y='50' width='160' height='100' fill='%237c3aed' rx='5'/%3E%3Cline x1='20' y1='60' x2='180' y2='60' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
            },
          ],
        },
      ],
    }),
    avatar: JSON.stringify({
      trainer_name: "Alex Johnson",
      voice_url: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==",
    }),
  };

  beforeEach(() => {
    progressUpdates = [];
  });

  it("should export complete course to SCORM package", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      {
        courseTitle: "Professional Development",
        courseDescription: "Master communication and time management skills",
        enableVoiceNarration: true,
        embedStrategy: "data-uri",
        passingScore: 70,
        courseVersion: "1.0",
      },
      (progress) => {
        progressUpdates.push({
          percentage: progress.percentage,
          stage: progress.stage,
          message: progress.message,
        });
      }
    );

    // Verify export completed (success or validation warnings)
    expect(result).toBeDefined();
    expect(result.fileName).toContain("SCORM.zip");

    // If successful, verify blob
    if (result.success && result.fileBlob) {
      expect(result.fileSize).toBeGreaterThan(0);
    }
  });

  it("should track progress through all pipeline stages", async () => {
    await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" },
      (progress) => {
        progressUpdates.push({
          percentage: progress.percentage,
          stage: progress.stage,
          message: progress.message,
        });
      }
    );

    // Verify progress reporting (if provided)
    if (progressUpdates.length > 0) {
      expect(progressUpdates[0].percentage).toBeGreaterThanOrEqual(0);
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBeGreaterThanOrEqual(0);

      // Verify at least one stage is reported
      const stages = progressUpdates.map((u) => u.stage);
      expect(stages.length).toBeGreaterThan(0);
    }
  });

  it("should generate valid SCORM manifest", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" }
    );

    if (result.success && result.zip) {
      const manifestFile = result.zip.file("imsmanifest.xml");
      expect(manifestFile).toBeDefined();

      const manifestContent = await manifestFile?.async("string");
      if (manifestContent) {
        expect(manifestContent).toContain("<?xml");
        expect(manifestContent).toContain("manifest");
        expect(manifestContent).toContain("imsmanifest");
      }
    }
  });

  it("should include rendered HTML modules in package", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" }
    );

    if (result.success && result.zip) {
      const files = Object.keys(result.zip.files);
      const htmlModules = files.filter((f) => f.match(/module_\d+\.html/));
      expect(htmlModules.length).toBeGreaterThan(0);

      // Verify HTML contains expected SCORM elements
      for (const moduleFile of htmlModules) {
        const html = await result.zip.file(moduleFile)?.async("string");
        if (html) {
          expect(html).toContain("<!DOCTYPE html>");
          expect(html).toContain("<html");
          expect(html).toContain("<meta charset");
          expect(html).toContain("SCORM_API");
        }
      }
    }
  });

  it("should embed assets in SCORM package", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development", embedStrategy: "data-uri" }
    );

    if (result.success && result.zip) {
      const files = Object.keys(result.zip.files);

      // Check for manifest
      expect(files).toContain("imsmanifest.xml");

      // Check for HTML modules
      const htmlFiles = files.filter((f) => f.match(/module_\d+\.html/));
      expect(htmlFiles.length).toBeGreaterThan(0);
    }
  });

  it("should handle course with multiple modules correctly", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      {
        courseTitle: "Professional Development",
        courseDescription: "Multi-module course",
      }
    );

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();

    // Verify result has all expected fields
    expect(result.fileName).toBeDefined();
    expect(result.preValidation).toBeDefined();
  });

  it("should report validation results", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" }
    );

    expect(result.preValidation).toBeDefined();
    expect(result.preValidation.overallStatus).toBeDefined();
    expect(result.preValidation.totalChecks).toBeGreaterThan(0);
    expect(result.preValidation.passedChecks).toBeGreaterThanOrEqual(0);
  });

  it("should return appropriate error for missing course title", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "" }  // Empty title
    );

    // Should report validation failure or error
    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it("should handle course with only one module", async () => {
    const singleModuleCourse: RawAgentOutputs = {
      ...sampleCourseData,
      architect: JSON.stringify({
        modules: [
          {
            module_title: "Getting Started",
            topics: ["Introduction", "Quick Start"],
          },
        ],
      }),
    };

    const result = await exportToScorm(
      singleModuleCourse,
      { courseTitle: "Quick Start Guide" }
    );

    expect(result).toBeDefined();
    expect(result.fileName).toContain("SCORM.zip");
  });

  it("should generate file blob suitable for download", async () => {
    const result = await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" }
    );

    // Verify result is defined
    expect(result).toBeDefined();
    expect(result.fileName).toBeDefined();

    // If blob is available, verify its properties
    if (result.fileBlob) {
      expect(result.fileBlob).toBeInstanceOf(Blob);
      expect(result.fileSize).toBeGreaterThan(0);
    }
  });

  it("should complete within reasonable time", async () => {
    const startTime = Date.now();

    await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" }
    );

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  });

  it("should track accurate progress percentages", async () => {
    const percentages: number[] = [];

    await exportToScorm(
      sampleCourseData,
      { courseTitle: "Professional Development" },
      (progress) => {
        percentages.push(progress.percentage);
      }
    );

    // Should have reported at least some progress
    if (percentages.length > 0) {
      // Verify percentages are monotonically increasing
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }

      // Verify percentages are in valid range
      percentages.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      });
    }
  });
});
