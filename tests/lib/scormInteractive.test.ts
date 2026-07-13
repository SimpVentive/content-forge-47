/**
 * Unit Tests for Phase 4: Interactive Elements
 * Tests audio player, quiz engine, SCORM API, progress tracker
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  parseSentences,
  generateAudioCues,
  findActiveSentence,
  formatTime,
} from '@/lib/scormAudioPlayer';
import {
  createQuizState,
  recordAnswer,
  updateProgress,
  generateQuizSummary,
  getCurrentQuestion,
  moveToNextQuestion,
} from '@/lib/scormQuizEngine';
import { ScormApiClient } from '@/lib/scormApiClient';
import { ProgressTracker } from '@/lib/scormProgressTracker';

describe('Phase 4: Interactive Elements Tests', () => {
  describe('scormAudioPlayer', () => {
    describe('parseSentences', () => {
      it('should split text by sentence boundaries', () => {
        const text = 'First sentence. Second sentence! Third sentence?';
        const sentences = parseSentences(text);

        expect(sentences.length).toBe(3);
        expect(sentences[0].text).toContain('First');
        expect(sentences[1].text).toContain('Second');
        expect(sentences[2].text).toContain('Third');
      });

      it('should handle empty strings', () => {
        expect(parseSentences('')).toEqual([]);
        expect(parseSentences('   ')).toEqual([]);
      });

      it('should handle single sentence', () => {
        const sentences = parseSentences('Only one sentence.');
        expect(sentences.length).toBe(1);
      });
    });

    describe('generateAudioCues', () => {
      it('should distribute sentences across duration', () => {
        const text = 'First. Second. Third.';
        const cues = generateAudioCues(text, 3000); // 3 seconds

        expect(cues.length).toBeGreaterThan(0);
        expect(cues[0].startMs).toBe(0);
        expect(cues[cues.length - 1].endMs).toBeLessThanOrEqual(3000);
      });

      it('should set correct time ranges for each cue', () => {
        const text = 'First. Second. Third.';
        const cues = generateAudioCues(text, 3000);

        cues.forEach((cue, i) => {
          if (i > 0) {
            expect(cue.startMs).toBeGreaterThanOrEqual(cues[i - 1].startMs);
          }
          expect(cue.endMs).toBeGreaterThan(cue.startMs);
        });
      });
    });

    describe('findActiveSentence', () => {
      it('should find active sentence at given time', () => {
        const cues = generateAudioCues('First. Second. Third.', 3000);
        const activeCue = findActiveSentence(cues, 500); // 0.5 seconds

        expect(activeCue).toBeDefined();
        expect(activeCue?.startMs).toBeLessThanOrEqual(500);
      });

      it('should return undefined before first cue', () => {
        const cues = generateAudioCues('First. Second.', 1000);
        const cue = findActiveSentence(cues, -100);

        expect(cue).toBeUndefined();
      });
    });

    describe('formatTime', () => {
      it('should format milliseconds as MM:SS', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(60000)).toBe('1:00');
        expect(formatTime(125000)).toBe('2:05');
        expect(formatTime(3661000)).toBe('61:01');
      });
    });
  });

  describe('scormQuizEngine', () => {
    let quizState: ReturnType<typeof createQuizState>;

    beforeEach(() => {
      quizState = createQuizState([
        {
          id: 'q1',
          question: 'What is 2+2?',
          options: ['3', '4', '5'],
          correctAnswer: '4',
        },
        {
          id: 'q2',
          question: 'What is 3+3?',
          options: ['6', '9', '12'],
          correctAnswer: '6',
        },
      ]);
    });

    describe('recordAnswer', () => {
      it('should mark correct answer', () => {
        const answer = recordAnswer(quizState, 'q1', '4');
        expect(answer.isCorrect).toBe(true);
        expect(quizState.progress.correctCount).toBe(1);
      });

      it('should mark incorrect answer', () => {
        const answer = recordAnswer(quizState, 'q1', '3');
        expect(answer.isCorrect).toBe(false);
        expect(quizState.progress.correctCount).toBe(0);
      });

      it('should track multiple attempts', () => {
        recordAnswer(quizState, 'q1', '3'); // Incorrect
        recordAnswer(quizState, 'q1', '4'); // Correct

        const answer = quizState.answers.get('q1');
        expect(answer?.attemptNumber).toBe(2);
        expect(answer?.isCorrect).toBe(true);
      });

      it('should update answered count', () => {
        recordAnswer(quizState, 'q1', '4');
        expect(quizState.progress.answeredCount).toBe(1);
      });
    });

    describe('updateProgress', () => {
      it('should calculate score percentage', () => {
        recordAnswer(quizState, 'q1', '4'); // Correct
        recordAnswer(quizState, 'q2', '6'); // Correct

        expect(quizState.progress.score).toBe(100);
      });

      it('should calculate partial score', () => {
        recordAnswer(quizState, 'q1', '4'); // Correct
        recordAnswer(quizState, 'q2', '9'); // Incorrect

        expect(quizState.progress.score).toBe(50);
      });

      it('should set completion status', () => {
        expect(quizState.isComplete).toBe(false);

        recordAnswer(quizState, 'q1', '4');
        recordAnswer(quizState, 'q2', '6');

        expect(quizState.isComplete).toBe(true);
      });
    });

    describe('generateQuizSummary', () => {
      it('should determine pass status (70% threshold)', () => {
        recordAnswer(quizState, 'q1', '4'); // 50% = fail
        let summary = generateQuizSummary(quizState);
        expect(summary.passed).toBe(false);

        recordAnswer(quizState, 'q2', '6'); // 100% = pass
        summary = generateQuizSummary(quizState);
        expect(summary.passed).toBe(true);
      });

      it('should include correct/total count', () => {
        recordAnswer(quizState, 'q1', '4');
        const summary = generateQuizSummary(quizState);

        expect(summary.correctCount).toBe(1);
        expect(summary.totalCount).toBe(2);
      });
    });

    describe('getCurrentQuestion', () => {
      it('should return current question', () => {
        const question = getCurrentQuestion(quizState);
        expect(question?.id).toBe('q1');
      });

      it('should return next question after navigation', () => {
        moveToNextQuestion(quizState);
        const question = getCurrentQuestion(quizState);
        expect(question?.id).toBe('q2');
      });
    });

    describe('moveToNextQuestion', () => {
      it('should advance to next question', () => {
        expect(quizState.currentQuestionIndex).toBe(0);
        moveToNextQuestion(quizState);
        expect(quizState.currentQuestionIndex).toBe(1);
      });

      it('should return false at last question', () => {
        moveToNextQuestion(quizState);
        const canMove = moveToNextQuestion(quizState);
        expect(canMove).toBe(false);
      });
    });
  });

  describe('scormApiClient', () => {
    let client: ScormApiClient;

    beforeEach(() => {
      client = new ScormApiClient();

      // Mock SCORM API
      (window as any).API = {
        LMSInitialize: jest.fn(() => 'true'),
        LMSSetValue: jest.fn(() => 'true'),
        LMSGetValue: jest.fn(() => ''),
        LMSCommit: jest.fn(() => 'true'),
        LMSFinish: jest.fn(() => 'true'),
        LMSGetLastError: jest.fn(() => '0'),
      };
    });

    describe('initialize', () => {
      it('should call LMSInitialize', async () => {
        await client.initialize();
        expect((window as any).API.LMSInitialize).toHaveBeenCalledWith('');
      });

      it('should set initialized flag', async () => {
        await client.initialize();
        expect(client.isReady()).toBe(true);
      });
    });

    describe('setStatus', () => {
      it('should set lesson status', async () => {
        await client.initialize();
        client.setStatus('passed');

        expect((window as any).API.LMSSetValue).toHaveBeenCalledWith(
          'cmi.core.lesson_status',
          'passed'
        );
      });
    });

    describe('setScore', () => {
      it('should normalize score to 0-100', async () => {
        await client.initialize();

        client.setScore(150);
        expect((window as any).API.LMSSetValue).toHaveBeenCalledWith(
          'cmi.core.score.raw',
          '100'
        );

        client.setScore(-10);
        expect((window as any).API.LMSSetValue).toHaveBeenCalledWith(
          'cmi.core.score.raw',
          '0'
        );
      });
    });

    describe('isReady', () => {
      it('should return false if not initialized', () => {
        const newClient = new ScormApiClient();
        expect(newClient.isReady()).toBe(false);
      });

      it('should return true if initialized', async () => {
        await client.initialize();
        expect(client.isReady()).toBe(true);
      });
    });
  });

  describe('scormProgressTracker', () => {
    let tracker: ProgressTracker;

    beforeEach(() => {
      tracker = new ProgressTracker('course1', 10);
    });

    describe('viewSlide', () => {
      it('should record slide view', () => {
        tracker.viewSlide(0, 'content');
        expect(tracker.getProgressState().viewedSlides).toBe(1);
      });

      it('should not double-count repeat views', () => {
        tracker.viewSlide(0, 'content');
        tracker.viewSlide(0, 'content');
        expect(tracker.getProgressState().viewedSlides).toBe(1);
      });
    });

    describe('completeSlide', () => {
      it('should mark slide as complete', () => {
        tracker.viewSlide(0, 'content');
        tracker.completeSlide(0);
        expect(tracker.getProgressState().completedSlides).toBe(1);
      });

      it('should not double-count completion', () => {
        tracker.viewSlide(0, 'content');
        tracker.completeSlide(0);
        tracker.completeSlide(0);
        expect(tracker.getProgressState().completedSlides).toBe(1);
      });
    });

    describe('getProgressPercentage', () => {
      it('should calculate completion percentage', () => {
        tracker.viewSlide(0, 'content');
        tracker.completeSlide(0);
        tracker.viewSlide(1, 'content');
        tracker.completeSlide(1);

        const percentage = tracker.getProgressPercentage();
        expect(percentage).toBe(20); // 2 of 10
      });

      it('should return 0 if no slides completed', () => {
        expect(tracker.getProgressPercentage()).toBe(0);
      });

      it('should return 100 if all slides completed', () => {
        for (let i = 0; i < 10; i++) {
          tracker.viewSlide(i, 'content');
          tracker.completeSlide(i);
        }
        expect(tracker.getProgressPercentage()).toBe(100);
      });
    });

    describe('getProgressReport', () => {
      it('should generate detailed report', () => {
        tracker.viewSlide(0, 'content');
        tracker.completeSlide(0);

        const report = tracker.getProgressReport();
        expect(report.courseId).toBe('course1');
        expect(report.slidesCompleted).toBe(1);
        expect(report.totalSlides).toBe(10);
        expect(report.percentage).toBe(10);
      });
    });
  });
});
