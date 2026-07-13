/**
 * Unit Tests for scormValidator.ts
 * Tests pre-export validation logic
 */

import { describe, it, expect } from '@jest/globals';
import { ScormValidator, type ValidationReport } from '@/lib/scormValidator';

describe('scormValidator - Unit Tests', () => {
  let validator: ScormValidator;

  beforeEach(() => {
    validator = new ScormValidator();
  });

  describe('validate - Course Structure', () => {
    it('should fail if course title is empty', () => {
      const report = validator.validate({
        courseTitle: '',
        modules: [{ title: 'Module 1', slides: [{ type: 'content' }] }],
      });

      expect(report.overallStatus).toBe('failed');
      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should warn if course title is very long', () => {
      const longTitle = 'A'.repeat(250);
      const report = validator.validate({
        courseTitle: longTitle,
        modules: [],
      });

      expect(report.summary.warnings.length).toBeGreaterThan(0);
    });

    it('should pass with valid course title', () => {
      const report = validator.validate({
        courseTitle: 'Valid Course Title',
        modules: [{ title: 'Module 1', slides: [{ type: 'content' }] }],
      });

      expect(report.summary.criticalIssues.length).toBe(0);
    });
  });

  describe('validate - Modules', () => {
    it('should fail if no modules found', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [],
      });

      expect(report.overallStatus).toBe('failed');
      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should warn if module has no title', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: '', slides: [{ type: 'content' }] }],
      });

      expect(report.summary.warnings.length).toBeGreaterThan(0);
    });

    it('should warn if module has no slides', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'Module 1', slides: [] }],
      });

      expect(report.summary.warnings.length).toBeGreaterThan(0);
    });

    it('should warn if module uses only one slide type', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [
          {
            title: 'Module 1',
            slides: [
              { type: 'content' },
              { type: 'content' },
              { type: 'content' },
            ],
          },
        ],
      });

      expect(report.summary.warnings.length).toBeGreaterThan(0);
    });

    it('should pass with valid module structure', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [
          {
            title: 'Module 1',
            slides: [{ type: 'content' }, { type: 'assessment' }],
          },
        ],
      });

      expect(report.summary.criticalIssues.length).toBe(0);
    });
  });

  describe('validate - Avatar', () => {
    it('should warn if no avatar configured', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        avatar: undefined,
      });

      const avatarWarnings = report.summary.warnings.filter((w) =>
        w.message.toLowerCase().includes('avatar')
      );
      expect(avatarWarnings.length).toBeGreaterThan(0);
    });

    it('should warn if avatar has no name', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        avatar: { trainerName: '' },
      });

      const warnings = report.summary.warnings.filter((w) =>
        w.message.toLowerCase().includes('name')
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should pass with valid avatar', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        avatar: {
          trainerName: 'John Trainer',
          imageUrl: 'trainer.jpg',
        },
      });

      const avatarErrors = report.summary.criticalIssues.filter((e) =>
        e.message.toLowerCase().includes('avatar')
      );
      expect(avatarErrors.length).toBe(0);
    });
  });

  describe('validate - Visuals', () => {
    it('should warn if no visuals found', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        visuals: { allVisuals: new Map() },
      });

      const visualWarnings = report.summary.warnings.filter((w) =>
        w.message.toLowerCase().includes('visual')
      );
      expect(visualWarnings.length).toBeGreaterThan(0);
    });

    it('should pass with visuals present', () => {
      const visuals = new Map([['Topic 1', { imageDataUrl: 'image.jpg' }]]);
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        visuals: { allVisuals: visuals },
      });

      const criticalVizErrors = report.summary.criticalIssues.filter((e) =>
        e.message.toLowerCase().includes('visual')
      );
      expect(criticalVizErrors.length).toBe(0);
    });
  });

  describe('validate - Quizzes', () => {
    it('should warn if no quizzes found', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
        quizzes: [],
      });

      const quizWarnings = report.summary.warnings.filter((w) =>
        w.message.toLowerCase().includes('assessment')
      );
      expect(quizWarnings.length).toBeGreaterThan(0);
    });

    it('should fail if quiz has no question text', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'assessment' }] }],
        quizzes: [
          {
            question: '',
            options: ['A', 'B'],
            correct_answer: 'A',
          },
        ],
      });

      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should fail if quiz has <2 options', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'assessment' }] }],
        quizzes: [
          {
            question: 'Question?',
            options: ['Only one option'],
            correct_answer: 'Only one option',
          },
        ],
      });

      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should fail if quiz has no correct answer', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'assessment' }] }],
        quizzes: [
          {
            question: 'Question?',
            options: ['A', 'B', 'C'],
            correct_answer: '',
          },
        ],
      });

      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should pass with valid quiz', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'assessment' }] }],
        quizzes: [
          {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correct_answer: '4',
          },
        ],
      });

      const quizErrors = report.summary.criticalIssues.filter((e) =>
        e.message.toLowerCase().includes('question')
      );
      expect(quizErrors.length).toBe(0);
    });
  });

  describe('Overall Status', () => {
    it('should return "passed" when no errors/warnings', () => {
      const report = validator.validate({
        courseTitle: 'Valid Course',
        modules: [
          {
            title: 'Module 1',
            slides: [{ type: 'content' }, { type: 'assessment' }],
          },
        ],
        avatar: { trainerName: 'Trainer', imageUrl: 'img.jpg' },
        visuals: { allVisuals: new Map([['Topic', { imageDataUrl: 'img.jpg' }]]) },
        quizzes: [
          {
            question: 'Q?',
            options: ['A', 'B'],
            correct_answer: 'A',
          },
        ],
      });

      expect(report.overallStatus).toBe('passed');
    });

    it('should return "warning" when only warnings exist', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [{ title: 'M1', slides: [{ type: 'content' }] }],
      });

      expect(report.overallStatus).toBe('warning');
    });

    it('should return "failed" when critical issues exist', () => {
      const report = validator.validate({
        courseTitle: '',
        modules: [],
      });

      expect(report.overallStatus).toBe('failed');
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations based on issues', () => {
      const report = validator.validate({
        courseTitle: 'Course',
        modules: [],
      });

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('critical');
    });
  });
});
