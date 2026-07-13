/**
 * DashboardSlide - Module opening with avatar, key message, and visuals
 * Used as the first slide of each topic to set context and introduce the trainer
 */

import React from "react";

export interface DashboardSlideProps {
  moduleTitle: string;
  topicTitle?: string;
  content: string;
  avatarImageUrl?: string;
  trainerName?: string;
  visualImageDataUrl?: string;
  visualSvg?: string;
  infographicSvg?: string;
}

export const DashboardSlide: React.FC<DashboardSlideProps> = ({
  moduleTitle,
  topicTitle,
  content,
  avatarImageUrl,
  trainerName = "Trainer",
  visualImageDataUrl,
  visualSvg,
  infographicSvg,
}) => {
  return (
    <div className="scorm-dashboard-slide bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-white">
        <h1 className="text-2xl font-bold mb-1">{topicTitle || moduleTitle}</h1>
        <p className="text-indigo-100 text-sm">Module: {moduleTitle}</p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-8">
        {/* Left: Avatar + Message (2/3 width) */}
        <div className="lg:col-span-2">
          {avatarImageUrl && (
            <div className="flex gap-4 mb-6 pb-6 border-b border-slate-200">
              <div className="flex-shrink-0">
                <img
                  src={avatarImageUrl}
                  alt={trainerName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-indigo-500 shadow-md"
                />
              </div>
              <div className="flex-grow">
                <p className="font-bold text-slate-900 text-lg mb-2">{trainerName}</p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  {content.split("\n")[0] || content}
                </p>
              </div>
            </div>
          )}

          {/* Full content below avatar */}
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
            {content.split("\n").map((line, i) => (
              line.trim() && (
                <p key={i} className="mb-3">
                  {line}
                </p>
              )
            ))}
          </div>
        </div>

        {/* Right: Visual Context (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
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
            ) : infographicSvg ? (
              <div className="text-center">
                <p className="text-slate-600 text-sm font-semibold mb-3">Module Infographic</p>
                <div
                  className="max-w-full max-h-80"
                  dangerouslySetInnerHTML={{ __html: infographicSvg }}
                />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-slate-500 text-sm">Visual Context</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSlide;
