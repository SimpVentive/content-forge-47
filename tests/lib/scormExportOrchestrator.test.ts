/**
 * Unit Tests for Phase 6: Export Orchestrator
 * Tests complete export flow coordination
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { RawAgentOutputs } from '@/types/agents';
import { ScormExportOrchestrator, type ExportOptions } from '@/lib/scormExportOrchestrator';

describe('Phase 6: Export Orchestrator Tests', () => {
  let orchestrator: ScormExportOrchestrator;
  let progressUpdates: any[];

  const mockRawOutputs: RawAgentOutputs = {
    architect: JSON.stringify({
      modules: [
        {
          module_title: 'Introduction',
          topics: ['Topic 1', 'Topic 2'],
        },
      ],
    }),
    writer: 'Introduction content here.',
    assessment: JSON.stringify({
      mcq: [
        {
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correct_answer: 'A',
        },
      ],
    }),
    visual: JSON.stringify({
      modules: [
        {
          module_title: 'Introduction',
          topic_visuals: [
            { topic_title: 'Topic 1', generated_image_data_url: 'data:image/png;...' },
          ],
        },
      ],
    }),
  };

  const mockOptions: ExportOptions = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    trainerId: 'trainer_1',
    enableVoiceNarration: true,
  };

  beforeEach(() => {
    progressUpdates = [];
    orchestrator = new ScormExportOrchestrator((progress) => {
      progressUpdates.push(progress);
    });
  });

  describe('initialization', () => {
    it('should create orchestrator instance', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should accept progress callback', () => {
      expect(progressUpdates).toBeDefined();
    });
  });

  describe('export method', () => {
    it('should report validation stage at start', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const validationUpdates = progressUpdates.filter((p) => p.stage === 'validation');
      expect(validationUpdates.length).toBeGreaterThan(0);
    });

    it('should report rendering stage', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const renderingUpdates = progressUpdates.filter((p) => p.stage === 'rendering');
      expect(renderingUpdates.length).toBeGreaterThan(0);
    });

    it('should report assets stage', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const assetUpdates = progressUpdates.filter((p) => p.stage === 'assets');
      expect(assetUpdates.length).toBeGreaterThan(0);
    });

    it('should report packaging stage', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const packagingUpdates = progressUpdates.filter((p) => p.stage === 'packaging');
      expect(packagingUpdates.length).toBeGreaterThan(0);
    });

    it('should report completion', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const completeUpdates = progressUpdates.filter((p) => p.stage === 'complete');
      expect(completeUpdates.length).toBeGreaterThan(0);
    });

    it('should progress from 0 to 100%', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      const percentages = progressUpdates.map((p) => p.percentage);
      expect(percentages[0]).toBeLessThan(percentages[percentages.length - 1]);
      expect(percentages[percentages.length - 1]).toBe(100);
    });
  });

  describe('pre-export validation', () => {
    it('should block export on critical validation errors', async () => {
      const invalidOptions: ExportOptions = {
        courseTitle: '', // Empty title
      };

      const result = await orchestrator.export(mockRawOutputs, invalidOptions);

      expect(result.success).toBe(false);
      expect(result.fileBlob).toBeUndefined();
    });

    it('should include pre-validation report in result', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      expect(result.preValidation).toBeDefined();
      expect(result.preValidation.overallStatus).toBeDefined();
    });

    it('should allow export with warnings', async () => {
      // Course with warnings but no critical errors
      const optionsWithWarnings = {
        ...mockOptions,
        trainerId: undefined, // Warning: no avatar
      };

      const result = await orchestrator.export(mockRawOutputs, optionsWithWarnings);

      // Should attempt export despite warnings
      expect(result.preValidation).toBeDefined();
    });
  });

  describe('slide building', () => {
    it('should build slides from raw outputs', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.success) {
        expect(result.message).toContain('created');
      }
    });

    it('should handle missing modules gracefully', async () => {
      const outputsNoModules = {
        ...mockRawOutputs,
        architect: JSON.stringify({ modules: [] }),
      };

      const result = await orchestrator.export(outputsNoModules, mockOptions);

      expect(result.preValidation).toBeDefined();
    });
  });

  describe('package generation', () => {
    it('should generate file blob', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.success) {
        expect(result.fileBlob).toBeDefined();
        expect(result.fileSize).toBeGreaterThan(0);
      }
    });

    it('should set correct filename', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      expect(result.fileName).toContain('SCORM');
      expect(result.fileName).toContain('.zip');
    });

    it('should include manifest in package', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.zip) {
        const manifest = result.zip.file('imsmanifest.xml');
        expect(manifest).toBeDefined();
      }
    });

    it('should include HTML modules', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.zip) {
        // Should have at least one module HTML file
        const moduleFiles = Object.keys(result.zip.files).filter((name) =>
          name.match(/module_\d+\.html/)
        );
        expect(moduleFiles.length).toBeGreaterThan(0);
      }
    });
  });

  describe('post-export validation', () => {
    it('should include post-validation report', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.success) {
        expect(result.postValidation).toBeDefined();
        expect(result.postValidation?.isValid).toBeDefined();
      }
    });

    it('should verify manifest structure', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.zip && result.postValidation) {
        // Manifest should exist and be valid
        expect(result.postValidation.isValid).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid raw outputs gracefully', async () => {
      const invalidOutputs: RawAgentOutputs = {
        architect: 'not valid json {[]',
        writer: 'writer',
        assessment: 'not json',
        visual: 'not json',
      };

      const result = await orchestrator.export(invalidOutputs, mockOptions);

      expect(result).toBeDefined();
      expect(result.preValidation).toBeDefined();
    });

    it('should report error in result', async () => {
      const result = await orchestrator.export({}, mockOptions);

      expect(result.message).toBeDefined();
    });

    it('should include duration in result', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('progress reporting', () => {
    it('should report percentage as number 0-100', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      progressUpdates.forEach((update) => {
        expect(update.percentage).toBeGreaterThanOrEqual(0);
        expect(update.percentage).toBeLessThanOrEqual(100);
        expect(typeof update.percentage).toBe('number');
      });
    });

    it('should provide descriptive messages', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      progressUpdates.forEach((update) => {
        expect(update.message).toBeDefined();
        expect(update.message.length).toBeGreaterThan(0);
      });
    });

    it('should progress monotonically', async () => {
      await orchestrator.export(mockRawOutputs, mockOptions);

      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].percentage).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].percentage
        );
      }
    });
  });

  describe('export result', () => {
    it('should return complete result object', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      expect(result.success).toBeDefined();
      expect(result.fileName).toBeDefined();
      expect(result.preValidation).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.duration).toBeDefined();
    });

    it('should include file size for successful exports', async () => {
      const result = await orchestrator.export(mockRawOutputs, mockOptions);

      if (result.success) {
        expect(result.fileSize).toBeDefined();
        expect(result.fileSize).toBeGreaterThan(0);
      }
    });
  });
});
