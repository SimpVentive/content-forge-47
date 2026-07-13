/**
 * Unit Tests for slideBuilder.ts
 * Tests core slide building logic used by both LearnerPreview and SCORM
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeModuleKey,
  buildSlides,
  splitTopicContentIntoSlides,
  getTargetCourseQuestionCount,
  allocateQuestionsPerModule,
  type Module,
} from '@/lib/slideBuilder';
import type { RawAgentOutputs } from '@/types/agents';

describe('slideBuilder - Unit Tests', () => {
  describe('normalizeModuleKey', () => {
    it('should lowercase and remove special characters', () => {
      expect(normalizeModuleKey('Module 1 - Intro!')).toBe('module 1 intro');
      expect(normalizeModuleKey('ADVANCED   TOPICS')).toBe('advanced topics');
      expect(normalizeModuleKey('Test_Module#1')).toBe('test module 1');
    });

    it('should handle empty strings', () => {
      expect(normalizeModuleKey('')).toBe('');
      expect(normalizeModuleKey('   ')).toBe('');
    });
  });

  describe('splitTopicContentIntoSlides', () => {
    it('should split long content into multiple slides', () => {
      const longText = 'This is a sentence. ' * 50;
      const chunks = splitTopicContentIntoSlides(longText, 15, 10);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.wasTrimmed).toBeDefined();
      });
    });

    it('should respect max chunks per topic based on duration', () => {
      const text = 'sentence. ' * 100;

      // 3-minute course → max 2 chunks per topic
      const shortCourse = splitTopicContentIntoSlides(text, 3, 10);
      expect(shortCourse.length).toBeLessThanOrEqual(2);

      // 45-minute course → max 5 chunks per topic
      const longCourse = splitTopicContentIntoSlides(text, 45, 10);
      expect(longCourse.length).toBeLessThanOrEqual(5);
    });

    it('should trim text to word limit', () => {
      const text = 'word ' * 200; // 200 words
      const chunks = splitTopicContentIntoSlides(text, 15, 10);

      chunks.forEach((chunk) => {
        const wordCount = chunk.text.split(/\s+/).filter(Boolean).length;
        expect(wordCount).toBeLessThanOrEqual(200);
      });
    });

    it('should handle empty input gracefully', () => {
      expect(splitTopicContentIntoSlides('', 15)).toEqual([]);
      expect(splitTopicContentIntoSlides('   ', 15)).toEqual([]);
    });
  });

  describe('getTargetCourseQuestionCount', () => {
    it('should scale questions based on course duration', () => {
      const shortCourse = getTargetCourseQuestionCount(5, 'standard');
      const longCourse = getTargetCourseQuestionCount(45, 'standard');

      expect(longCourse).toBeGreaterThan(shortCourse);
    });

    it('should apply assessment intensity multiplier', () => {
      const light = getTargetCourseQuestionCount(15, 'light');
      const standard = getTargetCourseQuestionCount(15, 'standard');
      const deep = getTargetCourseQuestionCount(15, 'deep');

      expect(light).toBeLessThan(standard);
      expect(standard).toBeLessThan(deep);
    });

    it('should return minimum of 2 questions', () => {
      expect(getTargetCourseQuestionCount(0, 'light')).toBeGreaterThanOrEqual(2);
      expect(getTargetCourseQuestionCount(-10, 'light')).toBeGreaterThanOrEqual(2);
    });
  });

  describe('allocateQuestionsPerModule', () => {
    it('should allocate questions proportionally to module size', () => {
      const modules: Module[] = [
        { title: 'Module 1', topics: ['T1', 'T2', 'T3', 'T4', 'T5'] }, // 5 topics
        { title: 'Module 2', topics: ['T1', 'T2'] }, // 2 topics
      ];

      const allocation = allocateQuestionsPerModule(modules, 10);

      expect(allocation.length).toBe(2);
      expect(allocation[0]).toBeGreaterThan(allocation[1]); // Module 1 gets more
      expect(allocation[0] + allocation[1]).toBe(10);
    });

    it('should guarantee at least 1 question per module', () => {
      const modules: Module[] = [
        { title: 'M1', topics: ['T1'] },
        { title: 'M2', topics: ['T1'] },
        { title: 'M3', topics: ['T1'] },
      ];

      const allocation = allocateQuestionsPerModule(modules, 5);

      allocation.forEach((count) => {
        expect(count).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle zero modules gracefully', () => {
      const allocation = allocateQuestionsPerModule([], 10);
      expect(allocation).toEqual([]);
    });

    it('should handle zero questions gracefully', () => {
      const modules: Module[] = [{ title: 'M1', topics: ['T1'] }];
      const allocation = allocateQuestionsPerModule(modules, 0);
      expect(allocation).toEqual([]);
    });
  });

  describe('buildSlides', () => {
    const mockRawOutputs: RawAgentOutputs = {
      architect: JSON.stringify({
        modules: [
          {
            module_title: 'Introduction',
            topics: ['Topic 1', 'Topic 2'],
          },
          {
            module_title: 'Advanced',
            topics: ['Topic 3'],
          },
        ],
      }),
      writer: '## Introduction\nContent about module intro.\n\n## Topic 1\nFirst topic content.',
      assessment: JSON.stringify({
        mcq: [
          {
            question: 'What is this?',
            options: ['A', 'B', 'C'],
            correct_answer: 'A',
            module_title: 'Introduction',
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

    it('should create title slide for first module only', () => {
      const { slides } = buildSlides(mockRawOutputs);

      const titleSlides = slides.filter((s) => s.type === 'title');
      expect(titleSlides.length).toBe(1);
      expect(titleSlides[0].moduleIndex).toBe(0);
    });

    it('should create content slides for each topic', () => {
      const { slides } = buildSlides(mockRawOutputs);

      const contentSlides = slides.filter((s) => s.type === 'content');
      expect(contentSlides.length).toBeGreaterThan(0);
    });

    it('should create summary slide for each module', () => {
      const { slides, modules } = buildSlides(mockRawOutputs);

      const summarySlides = slides.filter((s) => s.type === 'summary');
      expect(summarySlides.length).toBe(modules.length);
    });

    it('should handle missing visual data gracefully', () => {
      const outputsNoVisuals = { ...mockRawOutputs, visual: '' };
      const { slides } = buildSlides(outputsNoVisuals);

      const contentSlides = slides.filter((s) => s.type === 'content');
      contentSlides.forEach((slide) => {
        expect(slide.visualImageDataUrl).toBeUndefined();
      });
    });

    it('should handle missing assessment data gracefully', () => {
      const outputsNoAssess = { ...mockRawOutputs, assessment: '' };
      const { slides } = buildSlides(outputsNoAssess);

      const assessSlides = slides.filter((s) => s.type === 'assessment');
      expect(assessSlides.length).toBe(0);
    });
  });
});
