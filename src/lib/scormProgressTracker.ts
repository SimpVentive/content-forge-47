/**
 * SCORM Progress Tracker - Coordinated progress tracking across audio, quizzes, and SCORM API
 * Maintains unified progress state and syncs with LMS
 */

import { ScormApiClient } from "@/lib/scormApiClient";
import { QuizProgress, QuizState } from "@/lib/scormQuizEngine";

export interface SlideProgress {
  slideIndex: number;
  slideType: string;
  viewedTimeMs: number;
  completed: boolean;
  timestamp: number;
}

export interface CourseProgress {
  courseId: string;
  totalSlides: number;
  viewedSlides: number;
  completedSlides: number;
  totalTimeSpentMs: number;
  quizProgress: QuizProgress | null;
  overallScore: number; // 0-100
  isComplete: boolean;
  slideHistory: Map<number, SlideProgress>;
}

/**
 * Tracks learner progress across the entire course
 */
export class ProgressTracker {
  private courseProgress: CourseProgress;
  private scormApi: ScormApiClient;
  private slideStartTime: number = 0;
  private lastSyncTime: number = 0;
  private syncInterval: number = 30000; // Sync every 30 seconds

  constructor(
    courseId: string,
    totalSlides: number,
    scormApi?: ScormApiClient
  ) {
    this.courseProgress = {
      courseId,
      totalSlides,
      viewedSlides: 0,
      completedSlides: 0,
      totalTimeSpentMs: 0,
      quizProgress: null,
      overallScore: 0,
      isComplete: false,
      slideHistory: new Map(),
    };

    this.scormApi = scormApi || new ScormApiClient();
  }

  /**
   * Initializes progress tracking
   */
  async initialize(): Promise<boolean> {
    const ready = await this.scormApi.initialize();

    if (ready) {
      // Load existing progress from LMS if available
      const existingScore = this.scormApi.getScore();
      if (existingScore !== null) {
        this.courseProgress.overallScore = existingScore;
      }

      console.log("[Progress Tracker] Initialized", {
        courseId: this.courseProgress.courseId,
        totalSlides: this.courseProgress.totalSlides,
        existingScore,
      });
    } else {
      console.warn("[Progress Tracker] SCORM API not available - tracking will be local only");
    }

    return ready;
  }

  /**
   * Records slide view
   */
  viewSlide(slideIndex: number, slideType: string = "content"): void {
    const existing = this.courseProgress.slideHistory.get(slideIndex);

    if (!existing) {
      this.courseProgress.viewedSlides++;
    }

    this.slideStartTime = Date.now();

    this.courseProgress.slideHistory.set(slideIndex, {
      slideIndex,
      slideType,
      viewedTimeMs: existing?.viewedTimeMs ?? 0,
      completed: existing?.completed ?? false,
      timestamp: Date.now(),
    });

    console.log("[Progress Tracker] Viewed slide:", slideIndex);
  }

  /**
   * Records slide completion (finished reading/interacting)
   */
  completeSlide(slideIndex: number): void {
    const slide = this.courseProgress.slideHistory.get(slideIndex);

    if (!slide) {
      this.viewSlide(slideIndex);
      return;
    }

    if (!slide.completed) {
      slide.completed = true;
      this.courseProgress.completedSlides++;
    }

    // Update time spent
    const timeSpent = Date.now() - this.slideStartTime;
    slide.viewedTimeMs += timeSpent;
    this.courseProgress.totalTimeSpentMs += timeSpent;

    console.log("[Progress Tracker] Completed slide:", slideIndex, {
      timeSpent,
      totalTime: this.courseProgress.totalTimeSpentMs,
    });

    // Periodic sync
    this.attemptSync();
  }

  /**
   * Updates quiz progress
   */
  updateQuizProgress(quizProgress: QuizProgress): void {
    this.courseProgress.quizProgress = quizProgress;

    // Update overall score based on quiz
    if (quizProgress.totalQuestions > 0) {
      this.courseProgress.overallScore = quizProgress.score;
    }

    console.log("[Progress Tracker] Quiz progress updated:", quizProgress);
  }

  /**
   * Calculates completion percentage
   */
  getProgressPercentage(): number {
    if (this.courseProgress.totalSlides === 0) return 0;
    return Math.round(
      (this.courseProgress.completedSlides / this.courseProgress.totalSlides) * 100
    );
  }

  /**
   * Marks course as complete
   */
  async markComplete(): Promise<boolean> {
    this.courseProgress.isComplete = true;

    console.log("[Progress Tracker] Course marked complete", {
      score: this.courseProgress.overallScore,
      timeSpent: this.courseProgress.totalTimeSpentMs,
      slidesViewed: this.courseProgress.viewedSlides,
    });

    // Final sync with LMS
    return await this.syncToLms();
  }

  /**
   * Syncs progress to SCORM LMS
   */
  private async syncToLms(): Promise<boolean> {
    if (!this.scormApi.isReady()) {
      console.warn("[Progress Tracker] SCORM API not ready for sync");
      return false;
    }

    try {
      // Update score
      this.scormApi.setScore(this.courseProgress.overallScore);

      // Update time spent
      this.scormApi.setTimeSpent(this.courseProgress.totalTimeSpentMs);

      // Determine lesson status based on progress
      if (this.courseProgress.isComplete) {
        if (this.courseProgress.overallScore >= 70) {
          this.scormApi.setStatus("passed");
        } else {
          this.scormApi.setStatus("completed");
        }
      }

      // Commit changes
      await this.scormApi.commit();

      this.lastSyncTime = Date.now();

      console.log("[Progress Tracker] Synced to SCORM LMS");
      return true;
    } catch (error) {
      console.error("[Progress Tracker] Sync failed:", error);
      return false;
    }
  }

  /**
   * Attempts periodic sync if enough time has passed
   */
  private async attemptSync(): Promise<void> {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;

    if (timeSinceLastSync > this.syncInterval) {
      await this.syncToLms();
    }
  }

  /**
   * Gets detailed progress report
   */
  getProgressReport(): {
    courseId: string;
    percentage: number;
    slidesCompleted: number;
    totalSlides: number;
    quizScore: number | null;
    totalTimeMinutes: number;
    isComplete: boolean;
    slideDetails: Array<{
      slideIndex: number;
      type: string;
      timeSpentSeconds: number;
      completed: boolean;
    }>;
  } {
    const slideDetails: Array<{
      slideIndex: number;
      type: string;
      timeSpentSeconds: number;
      completed: boolean;
    }> = [];

    for (const [index, slide] of this.courseProgress.slideHistory) {
      slideDetails.push({
        slideIndex: index,
        type: slide.slideType,
        timeSpentSeconds: Math.round(slide.viewedTimeMs / 1000),
        completed: slide.completed,
      });
    }

    slideDetails.sort((a, b) => a.slideIndex - b.slideIndex);

    return {
      courseId: this.courseProgress.courseId,
      percentage: this.getProgressPercentage(),
      slidesCompleted: this.courseProgress.completedSlides,
      totalSlides: this.courseProgress.totalSlides,
      quizScore: this.courseProgress.quizProgress?.score ?? null,
      totalTimeMinutes: Math.round(this.courseProgress.totalTimeSpentMs / 60000),
      isComplete: this.courseProgress.isComplete,
      slideDetails,
    };
  }

  /**
   * Gets current progress state
   */
  getProgressState(): CourseProgress {
    return { ...this.courseProgress };
  }

  /**
   * Cleans up and saves final state
   */
  async cleanup(): Promise<void> {
    await this.syncToLms();

    if (this.scormApi.isReady()) {
      await this.scormApi.finish();
    }

    console.log("[Progress Tracker] Cleanup complete");
  }

  /**
   * Estimates completion time based on current pace
   */
  getEstimatedTimeRemaining(): {
    estimatedMinutes: number;
    slidesRemaining: number;
  } {
    const slidesRemaining = Math.max(0, this.courseProgress.totalSlides - this.courseProgress.viewedSlides);

    if (this.courseProgress.viewedSlides === 0) {
      return { estimatedMinutes: 0, slidesRemaining };
    }

    const averageTimePerSlide = this.courseProgress.totalTimeSpentMs / this.courseProgress.viewedSlides;
    const estimatedMs = averageTimePerSlide * slidesRemaining;
    const estimatedMinutes = Math.round(estimatedMs / 60000);

    return { estimatedMinutes, slidesRemaining };
  }
}

/**
 * Creates CSS for progress bar
 */
export function createProgressBarCss(): string {
  return `
    .scorm-progress-container {
      margin-bottom: 2rem;
    }

    .scorm-progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .scorm-progress-label {
      font-weight: 600;
      color: #334155;
      font-size: 0.875rem;
    }

    .scorm-progress-value {
      font-weight: 700;
      color: #4f46e5;
      font-size: 0.875rem;
    }

    .scorm-progress-bar {
      width: 100%;
      height: 8px;
      background-color: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .scorm-progress-fill {
      height: 100%;
      background: linear-gradient(
        to right,
        #4f46e5,
        #6366f1
      );
      border-radius: 9999px;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
    }

    .scorm-time-estimate {
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: #64748b;
      display: flex;
      gap: 1.5rem;
    }

    .scorm-time-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .scorm-time-icon {
      font-size: 0.875rem;
    }
  `;
}

/**
 * Creates HTML for progress bar
 */
export function createProgressBarHtml(
  currentSlide: number,
  totalSlides: number,
  estimatedMinutesRemaining?: number
): string {
  const percentage = (currentSlide / totalSlides) * 100;

  return `
    <div class="scorm-progress-container">
      <div class="scorm-progress-header">
        <span class="scorm-progress-label">Course Progress</span>
        <span class="scorm-progress-value">${Math.round(percentage)}%</span>
      </div>
      <div class="scorm-progress-bar">
        <div class="scorm-progress-fill" style="width: ${percentage}%"></div>
      </div>
      ${
        estimatedMinutesRemaining !== undefined
          ? `
        <div class="scorm-time-estimate">
          <div class="scorm-time-item">
            <span class="scorm-time-icon">⏱</span>
            <span>Slide ${currentSlide} of ${totalSlides}</span>
          </div>
          <div class="scorm-time-item">
            <span class="scorm-time-icon">⏳</span>
            <span>~${estimatedMinutesRemaining} min remaining</span>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}
