/**
 * SummaryPanelSlide - Module summary with key takeaways and review prompts
 * Used as the last slide of each module to reinforce learning and transition
 */

import React from "react";

export interface SummaryPanelSlideProps {
  moduleTitle: string;
  moduleIndex: number;
  totalModules: number;
  takeaways: string[];
  isLastModule?: boolean;
}

export const SummaryPanelSlide: React.FC<SummaryPanelSlideProps> = ({
  moduleTitle,
  moduleIndex,
  totalModules,
  takeaways,
  isLastModule = false,
}) => {
  const displayTakeaways = takeaways.filter(Boolean).slice(0, 5);

  return (
    <div className="scorm-summary-panel-slide bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg shadow-lg overflow-hidden text-white">
      {/* Header */}
      <div className="px-8 py-8 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold">Module Summary</h2>
          <span className="text-xs font-semibold bg-white/10 px-3 py-1 rounded-full">
            Module {moduleIndex + 1} of {totalModules}
          </span>
        </div>
        <p className="text-slate-300">{moduleTitle}</p>
      </div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {/* Key Takeaways */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-yellow-400">★</span>
            Key Takeaways
          </h3>
          <ul className="space-y-3">
            {displayTakeaways.map((takeaway, index) => (
              <li key={index} className="flex gap-3 items-start">
                <span className="text-indigo-400 font-bold mt-1">{index + 1}.</span>
                <span className="text-slate-100 leading-relaxed">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Progress Section */}
        <div className="pt-6 border-t border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Course Progress
          </p>
          <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
              style={{ width: `${((moduleIndex + 1) / totalModules) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {moduleIndex + 1} of {totalModules} modules completed
          </p>
        </div>

        {/* Next Steps */}
        <div className="pt-6 border-t border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            What's Next?
          </p>
          {isLastModule ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-300 font-semibold mb-2">🎉 Course Complete!</p>
              <p className="text-slate-200 text-sm">
                You've completed all modules. Review your learning by revisiting key slides or
                exploring the course resources.
              </p>
            </div>
          ) : (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
              <p className="text-indigo-300 font-semibold mb-2">
                Module {moduleIndex + 2} Coming Up
              </p>
              <p className="text-slate-200 text-sm">
                Continue to the next module to build on these concepts and deepen your
                understanding.
              </p>
            </div>
          )}
        </div>

        {/* Self-Assessment */}
        <div className="pt-6 border-t border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Self-Check
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span className="text-green-400">✓</span>
              I understand the main concepts
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span className="text-green-400">✓</span>
              I can apply this knowledge
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span className="text-green-400">✓</span>
              I'm ready for the next module
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-700 text-center">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Content Forge Learning Module
        </p>
      </div>
    </div>
  );
};

export default SummaryPanelSlide;
