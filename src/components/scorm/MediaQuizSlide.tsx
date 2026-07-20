/**
 * MediaQuizSlide - Media + Quiz screen matching LearnerPreview layout
 * Left: featured media + key explanation
 * Right: instructor's guide + learning objectives + quick check
 */

import React from "react";

export interface MediaQuizSlideProps {
  moduleTitle: string;
  topicTitle?: string;
  content?: string;
  questionNumber?: number;
  totalQuestions?: number;
  avatarImageUrl?: string;
  trainerName?: string;
  visualImageDataUrl?: string;
  visualSvg?: string;
  question?: {
    question: string;
    options: string[];
    correct_answer: string;
    rationale?: string;
  };
}

export const MediaQuizSlide: React.FC<MediaQuizSlideProps> = ({
  moduleTitle,
  topicTitle,
  content,
  questionNumber,
  totalQuestions,
  avatarImageUrl,
  trainerName = "Trainer",
  visualImageDataUrl,
  visualSvg,
  question,
}) => {
  const isAssessment = questionNumber !== undefined;
  const options = question?.options || [];
  const correctAnswer = question?.correct_answer || "";
  const contentLines = content?.split("\n").filter(l => l.trim()) || [];
  const firstParagraph = contentLines[0] || content || "";

  return (
    <div className="bg-white rounded-[30px] border border-[#d6e1ef] shadow-[0_22px_54px_rgba(15,23,42,0.1)]">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#e2e8f0]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[12px] font-[900] uppercase tracking-[0.18em] text-[#5f7b9e]">
              {isAssessment ? "Knowledge Check" : "Media + Quiz Screen"}
            </p>
            <h2 className="mt-2 text-[32px] font-[900] leading-tight text-[#123d78]">
              {topicTitle || moduleTitle}
            </h2>
            {firstParagraph && !isAssessment && (
              <p className="mt-2 text-[15px] text-[#5f7898]">{firstParagraph}</p>
            )}
          </div>
          {isAssessment && (
            <span className="text-[12px] font-[900] uppercase tracking-[0.14em] text-[#4b6592] bg-[#e8eef9] px-4 py-2 rounded-full">
              Question {questionNumber} of {totalQuestions}
            </span>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* LEFT COLUMN: Featured Media + Explanation */}
          <div className="space-y-5">
            {/* Featured Media */}
            {visualImageDataUrl || visualSvg ? (
              <div className="overflow-hidden rounded-[24px] border border-[#d8e2ef] bg-[#f4f8fc] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">
                    Featured Media
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-[800] text-[#355fa8] shadow-sm">
                    Interactive asset zone
                  </span>
                </div>
                <div className="overflow-hidden rounded-[18px] border border-[#d8deea] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
                  <div className="aspect-video w-full bg-[#eef3f8] flex items-center justify-center">
                    {visualImageDataUrl ? (
                      <img
                        src={visualImageDataUrl}
                        alt={topicTitle || "Visual"}
                        className="w-full h-full object-cover"
                      />
                    ) : visualSvg ? (
                      <div
                        className="w-full h-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: visualSvg }}
                      />
                    ) : (
                      <p className="text-[14px] text-[#607896]">
                        Hero media or animation placeholder
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Key Explanation */}
            {!isAssessment && (
              <div className="rounded-[18px] border border-[#d8e2ef] bg-white p-4">
                <p className="text-[11px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">
                  Key Explanation
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#35506f]">
                  {contentLines.slice(1).join(" ") || firstParagraph}
                </p>
              </div>
            )}

            {/* Assessment Question */}
            {isAssessment && question && (
              <div className="space-y-4">
                <div>
                  <p className="text-[16px] font-[600] text-[#123d78] mb-4">
                    {question.question}
                  </p>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-[600] text-[#4b6592]">Progress</span>
                    <span className="text-[11px] text-[#7c8eb0]">
                      {questionNumber} of {totalQuestions}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600"
                      style={{ width: `${((questionNumber || 0) / (totalQuestions || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                  {options.map((option, index) => {
                    const isCorrect = option.trim() === correctAnswer.trim();
                    const label = String.fromCharCode(65 + index);
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isCorrect
                            ? "border-green-500 bg-green-50"
                            : "border-slate-200 bg-slate-50"
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
                            {label}
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
                              <p className="text-xs text-green-700 font-semibold mt-1">
                                ✓ Correct Answer
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rationale */}
                {question.rationale && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                      Why This Answer
                    </p>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {question.rationale}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Instructor Guide + Learning Objectives */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Instructor's Guide */}
            <div className="overflow-hidden rounded-[24px] border border-[#d8e2ef] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
              <div className="border-b border-[#e2e8f0] px-4 py-3">
                <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">
                  {trainerName}'s Guide
                </p>
                <p className="mt-0.5 text-[12px] text-[#607896]">
                  Presenter-led explanation and follow-up example
                </p>
              </div>
              <div className="p-4">
                {avatarImageUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={avatarImageUrl}
                      alt={trainerName}
                      className="w-24 h-24 rounded-full object-cover border-4 border-[#e2e8f0] mb-3"
                    />
                    <p className="text-[14px] font-[600] text-[#123d78]">{trainerName}</p>
                    <p className="text-[12px] text-[#4b6592] mt-1">
                      Speaking
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-[#7c8eb0] text-center py-4">
                    Your instructor guide will appear here
                  </p>
                )}
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="rounded-[22px] border border-[#d8e2ef] bg-[#f4f8fc] p-4 shadow-sm">
              <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#4b6592]">
                Learning Objectives
              </p>
              <div className="mt-3 space-y-3">
                {[topicTitle, moduleTitle].filter(Boolean).map((obj, index) => (
                  <div key={index} className="flex items-start gap-2 text-[13px] text-[#24486f]">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b]" />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Check / Quick Fact */}
            {!isAssessment && (
              <div className="rounded-[22px] border border-[#f2d089] bg-[#fff5d6] p-4 shadow-sm">
                <p className="text-[12px] font-[900] uppercase tracking-[0.16em] text-[#9a6a1a]">
                  Quick Fact
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#6f5b35]">
                  {firstParagraph || "A key insight from this lesson"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaQuizSlide;
