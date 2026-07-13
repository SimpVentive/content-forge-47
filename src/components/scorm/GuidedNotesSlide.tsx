/**
 * GuidedNotesSlide - Standard content slide with structured layout
 * Used for middle slides that present learning content with optional visuals
 */

import React from "react";

export interface GuidedNotesSlideProps {
  moduleTitle: string;
  topicTitle: string;
  topicPartIndex?: number;
  topicPartCount?: number;
  content: string;
  visualImageDataUrl?: string;
  visualSvg?: string;
  infographicSvg?: string;
}

export const GuidedNotesSlide: React.FC<GuidedNotesSlideProps> = ({
  moduleTitle,
  topicTitle,
  topicPartIndex = 0,
  topicPartCount = 1,
  content,
  visualImageDataUrl,
  visualSvg,
  infographicSvg,
}) => {
  const isFirstPart = topicPartIndex === 0;
  const showPartIndicator = topicPartCount > 1;

  return (
    <div className="scorm-guided-notes-slide bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">{topicTitle}</h2>
          {showPartIndicator && (
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">
              Part {topicPartIndex + 1} of {topicPartCount}
            </span>
          )}
        </div>
        <p className="text-slate-300 text-sm">Module: {moduleTitle}</p>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-8">
        {/* Main Content (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="prose prose-sm max-w-none">
            {content.split("\n").map((paragraph, i) => {
              const trimmed = paragraph.trim();
              return trimmed ? (
                <p key={i} className="text-slate-700 mb-4 leading-relaxed">
                  {trimmed}
                </p>
              ) : null;
            })}
          </div>

          {/* Learning Objectives Badge */}
          {isFirstPart && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Learning Focus
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                  {topicTitle}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Visual (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 rounded-lg p-4 min-h-[300px] flex items-center justify-center sticky top-8">
            {visualImageDataUrl ? (
              <img
                src={visualImageDataUrl}
                alt="Visual Context"
                className="max-w-full max-h-96 rounded shadow-sm"
              />
            ) : visualSvg ? (
              <div
                className="max-w-full max-h-96"
                dangerouslySetInnerHTML={{ __html: visualSvg }}
              />
            ) : infographicSvg && isFirstPart ? (
              <div className="w-full">
                <p className="text-center text-slate-600 text-xs font-semibold mb-3">Concept Map</p>
                <div
                  className="max-w-full max-h-80"
                  dangerouslySetInnerHTML={{ __html: infographicSvg }}
                />
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <p className="text-sm">Visual Reference</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedNotesSlide;
