/**
 * ScormLearnerPreview - Server-rendered learner interface matching LearnerPreview layout
 * Reproduces the exact visual layout and structure of the interactive preview in static HTML
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
 * Main SCORM learner preview - matches LearnerPreview layout exactly
 * Renders all slide types with their proper layout templates
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
    <div className="scorm-learner-preview min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Module {moduleIndex + 1} of {totalModules}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">{slides.length} slides</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{courseTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{moduleTitle}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="space-y-8">
          {slides.map((slide, index) => {
            // Title slide
            if (slide.type === "title") {
              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[30px] shadow-lg p-16 text-white text-center"
                >
                  <h1 className="text-5xl font-bold mb-4">{courseTitle}</h1>
                  <p className="text-indigo-100 text-xl">{slide.moduleTitle}</p>
                </div>
              );
            }

            // Objectives slide
            if (slide.type === "objectives") {
              return (
                <div
                  key={index}
                  className="bg-white rounded-[30px] border border-slate-200 shadow-md overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 py-6 text-white">
                    <h2 className="text-2xl font-bold">Module Overview</h2>
                  </div>
                  <div className="p-8 space-y-8">
                    {slide.courseObjective && (
                      <div>
                        <h3 className="text-lg font-bold text-indigo-600 mb-3">
                          Course Objective:
                        </h3>
                        <p className="text-slate-700 leading-relaxed">{slide.courseObjective}</p>
                      </div>
                    )}
                    {slide.courseContent && slide.courseContent.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-indigo-600 mb-3">
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

            // Content slide - render based on template
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

              if (contentTemplate === "media-quiz") {
                return (
                  <MediaQuizSlide
                    key={index}
                    moduleTitle={slide.moduleTitle}
                    topicTitle={slide.topicTitle}
                    content={slide.content || ""}
                    avatarImageUrl={avatarImageUrl}
                    trainerName={trainerName}
                    visualImageDataUrl={slide.visualImageDataUrl}
                    visualSvg={slide.visualSvg}
                  />
                );
              }

              if (contentTemplate === "summary-panel") {
                return (
                  <SummaryPanelSlide
                    key={index}
                    moduleTitle={slide.moduleTitle}
                    topicTitle={slide.topicTitle}
                    content={slide.content || ""}
                    infographicSvg={slide.infographicSvg}
                  />
                );
              }

              // Default to guided-notes
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

            // Assessment slides
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

            // Summary slide
            if (slide.type === "summary") {
              return (
                <SummaryPanelSlide
                  key={index}
                  moduleTitle={slide.moduleTitle}
                  topicTitle="Course Summary"
                  content={`This module covered ${slide.takeaways?.join(", ") || "key learning objectives"}.`}
                  infographicSvg={slide.infographicSvg}
                />
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-600 pb-6">
        <p>© Content Forge Learning Module - {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};

export default ScormLearnerPreview;
