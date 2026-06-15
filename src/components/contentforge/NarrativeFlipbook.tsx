import React, { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TopicNarrative } from "@/lib/visualNarrativeService";

interface NarrativeFlipbookProps {
  narratives: TopicNarrative[];
  displayStyle?: "page-flip" | "smooth-slide" | "step-reveal";
  onSceneChange?: (topicIndex: number, sceneIndex: number) => void;
}

export const NarrativeFlipbook: React.FC<NarrativeFlipbookProps> = ({
  narratives,
  displayStyle = "smooth-slide",
  onSceneChange,
}) => {
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentTopic = narratives[currentTopicIndex];
  const currentScene = currentTopic?.scenes[currentSceneIndex];

  const totalScenes = narratives.reduce((sum, n) => sum + n.scenes.length, 0);
  const currentSceneNumber = narratives
    .slice(0, currentTopicIndex)
    .reduce((sum, n) => sum + n.scenes.length, 0) + currentSceneIndex + 1;

  const handlePrevious = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    } else if (currentTopicIndex > 0) {
      setCurrentTopicIndex(currentTopicIndex - 1);
      setCurrentSceneIndex(narratives[currentTopicIndex - 1].scenes.length - 1);
    }

    onSceneChange?.(currentTopicIndex, currentSceneIndex - 1);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentSceneIndex, currentTopicIndex, isTransitioning, narratives, onSceneChange]);

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (currentSceneIndex < currentTopic.scenes.length - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
    } else if (currentTopicIndex < narratives.length - 1) {
      setCurrentTopicIndex(currentTopicIndex + 1);
      setCurrentSceneIndex(0);
    }

    onSceneChange?.(currentTopicIndex, currentSceneIndex + 1);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentSceneIndex, currentTopicIndex, currentTopic.scenes.length, isTransitioning, narratives.length, onSceneChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") handlePrevious();
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious]);

  if (!currentScene) {
    return (
      <div className="flex items-center justify-center w-full h-96 bg-gray-100 rounded-lg">
        <p className="text-gray-500">No narratives available</p>
      </div>
    );
  }

  const transitionClass = displayStyle === "page-flip"
    ? "transition-all duration-500 ease-in-out transform"
    : displayStyle === "step-reveal"
      ? "transition-opacity duration-300 ease-in-out"
      : "transition-all duration-400 ease-out";

  return (
    <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Flipbook Container */}
      <div className="relative bg-gradient-to-b from-white to-gray-50 aspect-video flex flex-col">
        {/* Scene Display */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/5 relative">
          {currentScene.imageDataUrl ? (
            <img
              src={currentScene.imageDataUrl}
              alt={currentScene.caption}
              className={`w-full h-full object-cover ${transitionClass} ${isTransitioning ? "opacity-75" : "opacity-100"}`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <div className="w-12 h-12 border-3 border-white/50 border-t-white rounded-full animate-spin" />
                </div>
                <p className="text-white/70 text-sm">Generating image...</p>
              </div>
            </div>
          )}
        </div>

        {/* Caption Area (Comic-style text) */}
        <div className="bg-white border-t-2 border-gray-200 px-6 py-4 min-h-20">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-900">{currentScene.title}</h3>
            <p className="text-[15px] leading-relaxed text-gray-700">{currentScene.caption}</p>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={isTransitioning || (currentTopicIndex === 0 && currentSceneIndex === 0)}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous scene"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <span className="text-sm text-gray-600 font-medium">
            Scene {currentSceneNumber} of {totalScenes}
          </span>

          <button
            onClick={handleNext}
            disabled={isTransitioning || (currentTopicIndex === narratives.length - 1 && currentSceneIndex === currentTopic.scenes.length - 1)}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next scene"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 mx-6 h-2 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(currentSceneNumber / totalScenes) * 100}%` }}
          />
        </div>

        {/* Topic Indicator */}
        <div className="text-right">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{currentTopic.topicTitle}</span>
          </p>
        </div>
      </div>

      {/* Instructions Overlay (First Time) */}
      <div className="absolute top-4 right-4 text-xs text-white bg-black/40 px-3 py-2 rounded-lg pointer-events-none">
        ← → or A/D keys to navigate
      </div>
    </div>
  );
};
