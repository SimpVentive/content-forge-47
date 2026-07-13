/**
 * ScenarioSlide - Situation-based question with context and answer options
 * Used for scenario-based assessments where a real-world situation provides context
 */

import React from "react";

export interface ScenarioSlideProps {
  moduleTitle: string;
  questionNumber: number;
  totalQuestions: number;
  question: {
    question: string;
    options: string[];
    correct_answer: string;
    situation?: string;
    scenario?: string;
    context?: string;
    rationale?: string;
  };
}

export const ScenarioSlide: React.FC<ScenarioSlideProps> = ({
  moduleTitle,
  questionNumber,
  totalQuestions,
  question,
}) => {
  const situationText = question.situation || question.scenario || question.context || "";
  const options = Array.isArray(question.options) ? question.options : [];
  const correctAnswer = question.correct_answer || "";

  return (
    <div className="scorm-scenario-slide bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-8 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Scenario Question</h2>
          <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
        <p className="text-orange-100 text-sm">Module: {moduleTitle}</p>
      </div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {/* Situation/Context */}
        {situationText && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">Situation</p>
            <p className="text-slate-700 leading-relaxed">{situationText}</p>
          </div>
        )}

        {/* Question */}
        <div>
          <p className="text-lg font-semibold text-slate-900 mb-4">{question.question}</p>
        </div>

        {/* Answer Options */}
        <div className="space-y-3">
          {options.map((option, index) => {
            const isCorrect = option.trim() === correctAnswer.trim();
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  isCorrect
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isCorrect
                        ? "border-green-500 bg-green-500"
                        : "border-slate-400"
                    }`}
                  >
                    {isCorrect && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className={`${
                      isCorrect
                        ? "text-green-900 font-semibold"
                        : "text-slate-700"
                    }`}>
                      {option}
                    </p>
                    {isCorrect && (
                      <p className="text-xs text-green-700 mt-1 font-semibold">
                        ✓ Correct Answer
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation/Rationale */}
        {question.rationale && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Why This Answer?
            </p>
            <p className="text-slate-700 leading-relaxed text-sm">{question.rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSlide;
