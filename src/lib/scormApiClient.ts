/**
 * SCORM API Client - Communicates with LMS via SCORM 1.2 API
 * Tracks learner progress, completion, and scores
 */

export type LessonStatus = "passed" | "completed" | "incomplete" | "failed" | "not attempted";

export interface LessonData {
  status: LessonStatus;
  score: number; // 0-100
  timeSpent: number; // milliseconds
  completionStatus: "completed" | "incomplete";
  progressMeasure: number; // 0-1
}

/**
 * SCORM API Client - Wrapper around LMS API
 */
export class ScormApiClient {
  private api: any = null;
  private initialized: boolean = false;
  private dataModel: Map<string, any> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 500;

  constructor() {
    this.findApi();
  }

  /**
   * Searches for SCORM API in window hierarchy
   */
  private findApi(): void {
    let api: any = null;

    // Search in current window
    if (window.API?.LMSInitialize) {
      api = window.API;
    }
    // Search in parent window (for frameset scenarios)
    else if (window.parent && window.parent !== window) {
      if (window.parent.API?.LMSInitialize) {
        api = window.parent.API;
      }
      // Search in opener (for popup scenarios)
      else if (window.opener?.API?.LMSInitialize) {
        api = window.opener.API;
      }
    }
    // SCORM 2004 support (4th edition)
    else if (window.API_1_3?.Initialize) {
      api = window.API_1_3;
    }

    this.api = api;

    if (api) {
      console.log("[SCORM API] API found:", {
        isSCORM12: !!api.LMSInitialize,
        isSCORM2004: !!api.Initialize,
      });
    } else {
      console.warn("[SCORM API] No SCORM API found in window hierarchy");
    }
  }

  /**
   * Initializes communication with LMS
   */
  async initialize(): Promise<boolean> {
    if (!this.api) {
      console.warn("[SCORM API] Cannot initialize - API not found");
      return false;
    }

    if (this.initialized) {
      return true;
    }

    try {
      const success = this.api.LMSInitialize?.("") ?? this.api.Initialize?.("");

      if (success === "true" || success === true) {
        this.initialized = true;
        console.log("[SCORM API] Initialized successfully");
        return true;
      } else {
        const errorCode = this.api.LMSGetLastError?.() ?? this.api.GetLastError?.("");
        console.error("[SCORM API] Initialization failed:", errorCode);
        return false;
      }
    } catch (error) {
      console.error("[SCORM API] Initialization error:", error);
      return false;
    }
  }

  /**
   * Sets a CMI data model value
   */
  setValue(element: string, value: any): boolean {
    if (!this.api || !this.initialized) {
      console.warn("[SCORM API] Not initialized");
      return false;
    }

    try {
      const result = this.api.LMSSetValue?.(element, String(value)) ??
                     this.api.SetValue?.(element, String(value));

      if (result === "true" || result === true) {
        this.dataModel.set(element, value);
        return true;
      } else {
        const errorCode = this.api.LMSGetLastError?.() ?? this.api.GetLastError?.("");
        console.warn(`[SCORM API] Failed to set ${element}:`, errorCode);
        return false;
      }
    } catch (error) {
      console.error(`[SCORM API] Error setting ${element}:`, error);
      return false;
    }
  }

  /**
   * Gets a CMI data model value
   */
  getValue(element: string): string | null {
    if (!this.api || !this.initialized) {
      return null;
    }

    try {
      const value = this.api.LMSGetValue?.(element) ?? this.api.GetValue?.(element);

      if (value !== "" && value !== undefined && value !== null) {
        return String(value);
      }

      return null;
    } catch (error) {
      console.error(`[SCORM API] Error getting ${element}:`, error);
      return null;
    }
  }

  /**
   * Commits data to LMS
   */
  async commit(): Promise<boolean> {
    if (!this.api || !this.initialized) {
      return false;
    }

    try {
      const result = this.api.LMSCommit?.("") ?? this.api.Commit?.("");

      if (result === "true" || result === true) {
        console.log("[SCORM API] Data committed successfully");
        return true;
      } else {
        const errorCode = this.api.LMSGetLastError?.() ?? this.api.GetLastError?.("");
        console.warn("[SCORM API] Commit failed:", errorCode);
        return false;
      }
    } catch (error) {
      console.error("[SCORM API] Commit error:", error);
      return false;
    }
  }

  /**
   * Sets lesson status
   */
  setStatus(status: LessonStatus): boolean {
    return this.setValue("cmi.core.lesson_status", status);
  }

  /**
   * Sets score
   */
  setScore(score: number): boolean {
    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
    return this.setValue("cmi.core.score.raw", normalizedScore);
  }

  /**
   * Sets time spent (in HH:MM:SS format)
   */
  setTimeSpent(ms: number): boolean {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    return this.setValue("cmi.core.time_limit_action", timeString);
  }

  /**
   * Marks course as complete
   */
  async setComplete(): Promise<boolean> {
    const success = this.setStatus("completed");
    if (success) {
      await this.commit();
    }
    return success;
  }

  /**
   * Marks course as passed
   */
  async setPassed(score: number): Promise<boolean> {
    this.setStatus("passed");
    this.setScore(score);
    await this.commit();
    return true;
  }

  /**
   * Marks course as failed
   */
  async setFailed(score: number): Promise<boolean> {
    this.setStatus("failed");
    this.setScore(score);
    await this.commit();
    return true;
  }

  /**
   * Tracks a learner interaction/event
   */
  trackInteraction(description: string, type: "choice" | "true-false" | "essay" | "matching" | "performance" | "sequencing" | "likert" | "multiple-choice" = "choice", correct: boolean = false): boolean {
    try {
      const timestamp = new Date().toISOString();
      const interactionData = {
        id: `interaction_${Date.now()}`,
        type,
        description,
        correct,
        timestamp,
      };

      // Store interaction (implementation depends on LMS)
      this.dataModel.set("interaction", interactionData);

      console.log("[SCORM API] Tracked interaction:", interactionData);
      return true;
    } catch (error) {
      console.error("[SCORM API] Error tracking interaction:", error);
      return false;
    }
  }

  /**
   * Terminates session with LMS
   */
  async finish(): Promise<boolean> {
    if (!this.api || !this.initialized) {
      return false;
    }

    try {
      // Final commit before finish
      await this.commit();

      const result = this.api.LMSFinish?.("") ?? this.api.Terminate?.("");

      if (result === "true" || result === true) {
        this.initialized = false;
        console.log("[SCORM API] Session finished");
        return true;
      } else {
        console.warn("[SCORM API] Finish failed");
        return false;
      }
    } catch (error) {
      console.error("[SCORM API] Finish error:", error);
      return false;
    }
  }

  /**
   * Gets current lesson status
   */
  getStatus(): LessonStatus | null {
    const status = this.getValue("cmi.core.lesson_status");
    if (status && ["passed", "completed", "incomplete", "failed", "not attempted"].includes(status)) {
      return status as LessonStatus;
    }
    return null;
  }

  /**
   * Gets current score
   */
  getScore(): number | null {
    const score = this.getValue("cmi.core.score.raw");
    if (score !== null) {
      const parsed = parseInt(score, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Checks if API is available and initialized
   */
  isReady(): boolean {
    return this.api !== null && this.initialized;
  }

  /**
   * Gets diagnostic information
   */
  getDiagnostics(): {
    apiFound: boolean;
    initialized: boolean;
    hasData: boolean;
    dataCount: number;
  } {
    return {
      apiFound: this.api !== null,
      initialized: this.initialized,
      hasData: this.dataModel.size > 0,
      dataCount: this.dataModel.size,
    };
  }
}

// Global SCORM API reference (for type augmentation)
declare global {
  interface Window {
    API?: {
      LMSInitialize?: (empty: string) => string | boolean;
      LMSFinish?: (empty: string) => string | boolean;
      LMSSetValue?: (element: string, value: string) => string | boolean;
      LMSGetValue?: (element: string) => string;
      LMSCommit?: (empty: string) => string | boolean;
      LMSGetLastError?: () => string;
      LMSGetErrorString?: (errorCode: string) => string;
      LMSGetDiagnostic?: (errorCode: string) => string;
    };
    API_1_3?: {
      Initialize?: (empty: string) => string | boolean;
      Terminate?: (empty: string) => string | boolean;
      SetValue?: (element: string, value: string) => string | boolean;
      GetValue?: (element: string) => string;
      Commit?: (empty: string) => string | boolean;
      GetLastError?: () => string;
      GetErrorString?: (errorCode: string) => string;
      GetDiagnostic?: (errorCode: string) => string;
    };
  }
}
