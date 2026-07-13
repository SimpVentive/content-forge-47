/**
 * ScormLearnerPreview - Server-rendered learner interface for SCORM export
 * This is a simplified, static version of LearnerPreview designed for ReactDOMServer.renderToString()
 *
 * Key differences from LearnerPreview:
 * - No hooks (useState, useEffect, useCallback, etc.)
 * - No async operations (data pre-loaded)
 * - No event handlers or interactivity (static HTML)
 * - Deterministic structure suitable for SCORM packaging
 * - All media references are relative paths in the ZIP
 */

import React from "react";
import { DashboardSlide } from "./DashboardSlide";
import { GuidedNotesSlide } from "./GuidedNotesSlide";
import { ScenarioSlide } from "./ScenarioSlide";
import { MediaQuizSlide } from "./MediaQuizSlide";
import { SummaryPanelSlide } from "./SummaryPanelSlide";
import type { Slide } from "@/lib/slideBuilder";

export interface ScormLearnerPreviewProps {
  courseTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  totalModules: number;
  slides: Slide[];
  avatarImageUrl?: string;
  trainerName?: string;
}

/**
 * Main SCORM learner preview - renders entire module as static HTML
 * Uses specific slide components based on slide type
 */
export const ScormLearnerPreview: React.FC<ScormLearnerPreviewProps> = ({
  courseTitle,
  moduleTitle,
  moduleIndex,
  totalModules,
  slides,
  avatarImageUrl,
  trainerName = "Trainer",
}) => {
  let assessmentQuestionIndex = 0;

  return (
    <div className="scorm-module-container bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen p-6">
      {/* Header */}
      <div className="scorm-header mb-8 pb-4 border-b border-slate-300">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-indigo-600">
            Module {moduleIndex + 1} of {totalModules}
          </span>
          <span className="text-sm text-slate-600">{slides.length} slides</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">{moduleTitle}</h1>
        <p className="text-sm text-slate-600">Part of: {courseTitle}</p>
      </div>

      {/* Slides Container */}
      <div className="scorm-slides-grid space-y-8">
        {slides.map((slide, index) => {
          // Render slides based on type
          if (slide.type === "title") {
            return (
              <div
                key={index}
                className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-12 text-white text-center"
              >
                <h1 className="text-4xl font-bold mb-4">{courseTitle}</h1>
                <p className="text-indigo-100 text-lg">{slide.moduleTitle}</p>
              </div>
            );
          }

          if (slide.type === "objectives") {
            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 py-6 text-white">
                  <h2 className="text-2xl font-bold">Module Overview</h2>
                </div>
                <div className="p-8 space-y-8">
                  {slide.courseObjective && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-3 text-indigo-600">
                        Course Objective:
                      </h3>
                      <p className="text-slate-700 leading-relaxed">{slide.courseObjective}</p>
                    </div>
                  )}
                  {slide.courseContent && slide.courseContent.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-3 text-indigo-600">
                        Course Content:
                      </h3>
                      <ul className="space-y-2">
                        {slide.courseContent.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-700">
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (slide.type === "content") {
            const contentTemplate = slide.contentTemplate || "guided-notes";

            if (contentTemplate === "dashboard") {
              return (
                <DashboardSlide
                  key={index}
                  moduleTitle={slide.moduleTitle}
                  topicTitle={slide.topicTitle}
                  content={slide.content || ""}
                  avatarImageUrl={avatarImageUrl}
                  trainerName={trainerName}
                  visualImageDataUrl={slide.visualImageDataUrl}
                  visualSvg={slide.visualSvg}
                  infographicSvg={slide.infographicSvg}
                />
              );
            }

            return (
              <GuidedNotesSlide
                key={index}
                moduleTitle={slide.moduleTitle}
                topicTitle={slide.topicTitle || ""}
                topicPartIndex={slide.topicPartIndex || 0}
                topicPartCount={slide.topicPartCount || 1}
                content={slide.content || ""}
                visualImageDataUrl={slide.visualImageDataUrl}
                visualSvg={slide.visualSvg}
                infographicSvg={slide.infographicSvg}
              />
            );
          }

          if (slide.type === "assessment") {
            assessmentQuestionIndex++;
            const assessmentQuestions = slides.filter((s) => s.type === "assessment");

            if (slide.contentTemplate === "scenario" && slide.question?.situation) {
              return (
                <ScenarioSlide
                  key={index}
                  moduleTitle={slide.moduleTitle}
                  questionNumber={assessmentQuestionIndex}
                  totalQuestions={assessmentQuestions.length}
                  question={slide.question}
                />
              );
            }

            return (
              <MediaQuizSlide
                key={index}
                moduleTitle={slide.moduleTitle}
                questionNumber={assessmentQuestionIndex}
                totalQuestions={assessmentQuestions.length}
                question={slide.question || {
                  question: "",
                  options: [],
                  correct_answer: "",
                }}
              />
            );
          }

          if (slide.type === "summary") {
            return (
              <SummaryPanelSlide
                key={index}
                moduleTitle={slide.moduleTitle}
                moduleIndex={slide.moduleIndex}
                totalModules={totalModules}
                takeaways={slide.takeaways || []}
                isLastModule={slide.moduleIndex === totalModules - 1}
              />
            );
          }

          // Fallback for other slide types
          return null;
        })}
      </div>

      {/* Footer */}
      <div className="scorm-footer mt-12 pt-6 border-t border-slate-300 text-center text-sm text-slate-600">
        <p>© Content Forge Learning Module - {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};

export default ScormLearnerPreview;
