/**
 * SCORM Quiz Engine - Handles quiz interactivity and answer tracking
 * Manages question state, scoring, and SCORM API communication
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  rationale?: string;
}

export interface QuizAnswer {
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs: number;
}

export interface QuizProgress {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  timeElapsedMs: number;
  score: number; // 0-100
}

export interface QuizState {
  questions: QuizQuestion[];
  answers: Map<string, QuizAnswer>;
  currentQuestionIndex: number;
  isComplete: boolean;
  progress: QuizProgress;
}

/**
 * Initializes a quiz with given questions
 */
export function createQuizState(questions: QuizQuestion[]): QuizState {
  return {
    questions,
    answers: new Map(),
    currentQuestionIndex: 0,
    isComplete: false,
    progress: {
      totalQuestions: questions.length,
      answeredCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      skippedCount: 0,
      timeElapsedMs: 0,
      score: 0,
    },
  };
}

/**
 * Records an answer to a question
 */
export function recordAnswer(
  state: QuizState,
  questionId: string,
  selectedOption: string
): QuizAnswer {
  const question = state.questions.find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  const isCorrect = selectedOption.trim() === question.correctAnswer.trim();
  const existingAnswer = state.answers.get(questionId);
  const attemptNumber = (existingAnswer?.attemptNumber ?? 0) + 1;

  const answer: QuizAnswer = {
    questionId,
    selectedOption,
    isCorrect,
    attemptNumber,
    timeTakenMs: 0,
  };

  state.answers.set(questionId, answer);
  updateProgress(state);

  return answer;
}

/**
 * Updates overall quiz progress metrics
 */
export function updateProgress(state: QuizState): void {
  const progress = state.progress;

  progress.answeredCount = state.answers.size;
  progress.skippedCount = Math.max(0, progress.totalQuestions - progress.answeredCount);

  let correctCount = 0;
  for (const answer of state.answers.values()) {
    if (answer.isCorrect) {
      correctCount++;
    }
  }

  progress.correctCount = correctCount;
  progress.incorrectCount = progress.answeredCount - correctCount;

  // Calculate score as percentage of correct answers
  progress.score =
    progress.totalQuestions > 0
      ? Math.round((correctCount / progress.totalQuestions) * 100)
      : 0;

  // Update completion status
  state.isComplete = progress.answeredCount === progress.totalQuestions;
}

/**
 * Gets the current question
 */
export function getCurrentQuestion(state: QuizState): QuizQuestion | undefined {
  return state.questions[state.currentQuestionIndex];
}

/**
 * Gets the answer for a specific question
 */
export function getAnswer(state: QuizState, questionId: string): QuizAnswer | undefined {
  return state.answers.get(questionId);
}

/**
 * Navigates to next question
 */
export function moveToNextQuestion(state: QuizState): boolean {
  if (state.currentQuestionIndex < state.questions.length - 1) {
    state.currentQuestionIndex++;
    return true;
  }
  return false;
}

/**
 * Navigates to previous question
 */
export function moveToPreviousQuestion(state: QuizState): boolean {
  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    return true;
  }
  return false;
}

/**
 * Generates summary of quiz results
 */
export function generateQuizSummary(state: QuizState): {
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  passThreshold: number;
} {
  const passThreshold = 70; // 70% to pass
  const passed = state.progress.score >= passThreshold;

  return {
    score: state.progress.score,
    passed,
    correctCount: state.progress.correctCount,
    totalCount: state.progress.totalQuestions,
    passThreshold,
  };
}

/**
 * Creates HTML for a quiz question with interactive options
 */
export function createQuizQuestionHtml(
  question: QuizQuestion,
  questionNumber: number,
  totalQuestions: number,
  previousAnswer?: QuizAnswer
): string {
  const optionsHtml = question.options
    .map((option, index) => {
      const optionId = `option-${question.id}-${index}`;
      const letterLabel = String.fromCharCode(65 + index); // A, B, C, D
      const isSelected = previousAnswer?.selectedOption === option;

      return `
        <div class="scorm-quiz-option">
          <input
            type="radio"
            id="${optionId}"
            name="quiz-${question.id}"
            value="${escapeHtml(option)}"
            ${isSelected ? "checked" : ""}
            class="scorm-quiz-radio"
          >
          <label for="${optionId}" class="scorm-quiz-option-label">
            <span class="scorm-option-letter">${letterLabel}</span>
            <span class="scorm-option-text">${escapeHtml(option)}</span>
          </label>
        </div>
      `;
    })
    .join("");

  return `
    <div class="scorm-quiz-question" data-question-id="${question.id}">
      <div class="scorm-quiz-header">
        <h3 class="scorm-quiz-question-text">${escapeHtml(question.question)}</h3>
        <div class="scorm-quiz-counter">Question ${questionNumber} of ${totalQuestions}</div>
      </div>

      <fieldset class="scorm-quiz-options">
        <legend class="sr-only">Select your answer</legend>
        ${optionsHtml}
      </fieldset>

      ${
        previousAnswer
          ? `
        <div class="scorm-quiz-feedback ${previousAnswer.isCorrect ? "correct" : "incorrect"}">
          <span class="scorm-feedback-icon">${previousAnswer.isCorrect ? "✓" : "✗"}</span>
          <span class="scorm-feedback-text">
            ${previousAnswer.isCorrect ? "Correct!" : "Incorrect"}
          </span>
        </div>
      `
          : ""
      }

      ${
        question.rationale
          ? `
        <div class="scorm-quiz-rationale">
          <p class="scorm-rationale-label">Why?</p>
          <p class="scorm-rationale-text">${escapeHtml(question.rationale)}</p>
        </div>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Creates CSS for quiz interactivity
 */
export function createQuizCss(): string {
  return `
    .scorm-quiz-question {
      background: white;
      border-radius: 0.5rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .scorm-quiz-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 1.5rem;
      gap: 1rem;
    }

    .scorm-quiz-question-text {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
      flex: 1;
    }

    .scorm-quiz-counter {
      font-size: 0.875rem;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
      background-color: #f1f5f9;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
    }

    .scorm-quiz-options {
      border: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .scorm-quiz-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 200ms ease;
    }

    .scorm-quiz-option:hover {
      border-color: #cbd5e1;
      background-color: #f8fafc;
    }

    .scorm-quiz-radio {
      width: 20px;
      height: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .scorm-quiz-radio:checked + .scorm-quiz-option-label {
      font-weight: 600;
      color: #0f172a;
    }

    .scorm-quiz-option-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      flex: 1;
    }

    .scorm-option-letter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: #e2e8f0;
      font-weight: 700;
      color: #334155;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .scorm-option-text {
      color: #334155;
    }

    .scorm-quiz-feedback {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .scorm-quiz-feedback.correct {
      background-color: #dcfce7;
      color: #166534;
    }

    .scorm-quiz-feedback.incorrect {
      background-color: #fee2e2;
      color: #991b1b;
    }

    .scorm-feedback-icon {
      font-size: 1.125rem;
    }

    .scorm-quiz-rationale {
      margin-top: 1.5rem;
      padding: 1rem;
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 0.375rem;
    }

    .scorm-rationale-label {
      font-size: 0.875rem;
      font-weight: 700;
      color: #0c4a6e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 0.5rem 0;
    }

    .scorm-rationale-text {
      color: #0c4a6e;
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    /* Screen reader only text */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
  `;
}

/**
 * Initializes quiz interactivity
 * Call after DOM is ready
 */
export function initializeQuiz(
  state: QuizState,
  onAnswerChange?: (answer: QuizAnswer) => void
): {
  cleanup: () => void;
  submitAnswer: (questionId: string, selectedOption: string) => QuizAnswer;
} {
  const handleAnswerChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input || !input.name?.startsWith("quiz-")) return;

    const questionId = input.getAttribute("value") ? input.name.replace("quiz-", "") : "";
    if (!questionId) return;

    const answer = recordAnswer(state, questionId, input.value);
    onAnswerChange?.(answer);
  };

  // Attach event listeners to all radio buttons
  const radioButtons = document.querySelectorAll(".scorm-quiz-radio");
  radioButtons.forEach((radio) => {
    radio.addEventListener("change", handleAnswerChange);
  });

  const cleanup = () => {
    radioButtons.forEach((radio) => {
      radio.removeEventListener("change", handleAnswerChange);
    });
  };

  return {
    cleanup,
    submitAnswer: (questionId: string, selectedOption: string) => {
      return recordAnswer(state, questionId, selectedOption);
    },
  };
}

/**
 * Helper to escape HTML in strings
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
