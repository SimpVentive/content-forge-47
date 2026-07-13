/**
 * MediaQuizSlide - Standard multiple choice question with visual answer feedback
 * Used for assessment slides with clear right/wrong answer indication
 */

import React from "react";

export interface MediaQuizSlideProps {
  moduleTitle: string;
  questionNumber: number;
  totalQuestions: number;
  question: {
    question: string;
    options: string[];
    correct_answer: string;
    module_title?: string;
    topic_title?: string;
    rationale?: string;
  };
}

export const MediaQuizSlide: React.FC<MediaQuizSlideProps> = ({
  moduleTitle,
  questionNumber,
  totalQuestions,
  question,
}) => {
  const options = Array.isArray(question.options) ? question.options : [];
  const correctAnswer = question.correct_answer || "";
  const topicTitle = question.topic_title || "";

  return (
    <div className="scorm-media-quiz-slide bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Knowledge Check</h2>
          <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
        <p className="text-purple-100 text-sm">
          {topicTitle ? `${topicTitle} • ${moduleTitle}` : `Module: ${moduleTitle}`}
        </p>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Question */}
        <div className="mb-6">
          <p className="text-lg font-semibold text-slate-900">{question.question}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-600">Progress</span>
            <span className="text-xs text-slate-500">
              {questionNumber} of {totalQuestions}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all"
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Answer Options */}
        <div className="space-y-3 mb-6">
          {options.map((option, index) => {
            const isCorrect = option.trim() === correctAnswer.trim();
            const letterLabel = String.fromCharCode(65 + index); // A, B, C, D

            return (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isCorrect
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`font-bold w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                      isCorrect
                        ? "bg-green-500 text-white"
                        : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {letterLabel}
                  </div>
                  <div className="flex-grow">
                    <p
                      className={`${
                        isCorrect
                          ? "text-green-900 font-semibold"
                          : "text-slate-700"
                      }`}
                    >
                      {option}
                    </p>
                    {isCorrect && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-green-700 text-xs font-bold">✓</span>
                        <span className="text-xs text-green-700 font-semibold">
                          Correct Answer
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {question.rationale && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
              Key Learning Point
            </p>
            <p className="text-slate-700 text-sm leading-relaxed">{question.rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaQuizSlide;
