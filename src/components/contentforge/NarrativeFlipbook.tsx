import React, { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize2, Minimize2, Printer } from "lucide-react";
import type { TopicNarrative } from "@/lib/visualNarrativeService";

interface NarrativeFlipbookProps {
  narratives: TopicNarrative[];
  displayStyle?: "page-flip" | "smooth-slide" | "step-reveal";
  onSceneChange?: (topicIndex: number, sceneIndex: number) => void;
  captionsEnabled?: boolean;
}

export const NarrativeFlipbook: React.FC<NarrativeFlipbookProps> = ({
  narratives,
  displayStyle = "smooth-slide",
  onSceneChange,
  captionsEnabled = true,
}) => {
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("contentforge.narrativeFlipbook.audioEnabled") === "true";
    } catch {
      return false;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const flipbookContainerRef = useRef<HTMLDivElement>(null);

  const currentTopic = narratives[currentTopicIndex];
  const currentScene = currentTopic?.scenes[currentSceneIndex];

  const totalScenes = narratives.reduce((sum, n) => sum + n.scenes.length, 0);
  const hasAnyAudio = narratives.some((n) => n.scenes.some((scene) => Boolean(scene.audioDataUrl)));
  const currentSceneNumber = narratives
    .slice(0, currentTopicIndex)
    .reduce((sum, n) => sum + n.scenes.length, 0) + currentSceneIndex + 1;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const playCurrentAudio = useCallback(() => {
    if (!audioEnabled || !currentScene?.audioDataUrl || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      console.warn("Could not play audio:", err);
    });
  }, [audioEnabled, currentScene?.audioDataUrl]);

  const handlePrevious = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    stopAudio();

    let nextTopicIndex = currentTopicIndex;
    let nextSceneIndex = currentSceneIndex;

    if (currentSceneIndex > 0) {
      nextSceneIndex = currentSceneIndex - 1;
    } else if (currentTopicIndex > 0) {
      nextTopicIndex = currentTopicIndex - 1;
      nextSceneIndex = narratives[currentTopicIndex - 1].scenes.length - 1;
    }

    setCurrentTopicIndex(nextTopicIndex);
    setCurrentSceneIndex(nextSceneIndex);
    onSceneChange?.(nextTopicIndex, nextSceneIndex);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentSceneIndex, currentTopicIndex, isTransitioning, narratives, onSceneChange, stopAudio]);

  const handleNext = useCallback(() => {
    if (isTransitioning || !currentTopic) return;
    if (currentTopicIndex === narratives.length - 1 && currentSceneIndex === currentTopic.scenes.length - 1) return;
    setIsTransitioning(true);
    stopAudio();

    let nextTopicIndex = currentTopicIndex;
    let nextSceneIndex = currentSceneIndex;

    if (currentSceneIndex < currentTopic.scenes.length - 1) {
      nextSceneIndex = currentSceneIndex + 1;
    } else if (currentTopicIndex < narratives.length - 1) {
      nextTopicIndex = currentTopicIndex + 1;
      nextSceneIndex = 0;
    }

    setCurrentTopicIndex(nextTopicIndex);
    setCurrentSceneIndex(nextSceneIndex);
    onSceneChange?.(nextTopicIndex, nextSceneIndex);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentSceneIndex, currentTopic, currentTopicIndex, isTransitioning, narratives.length, onSceneChange, stopAudio]);

  const handleFullscreen = useCallback(async () => {
    if (!flipbookContainerRef.current) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }

      if (flipbookContainerRef.current.requestFullscreen) {
        await flipbookContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        return;
      }

      setIsFullscreen((current) => !current);
    } catch {
      setIsFullscreen((current) => !current);
    }
  }, []);

  const handleAudioToggle = useCallback((enabled: boolean) => {
    setAudioEnabled(enabled);
    try {
      window.localStorage.setItem("contentforge.narrativeFlipbook.audioEnabled", String(enabled));
    } catch {
      // Keep audio state in memory if storage is blocked.
    }

    if (!enabled) {
      stopAudio();
    }
  }, [stopAudio]);

  const handlePrint = useCallback(() => {
    // Trigger browser print dialog
    window.print();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") handlePrevious();
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious]);

  // Add print styles
  useEffect(() => {
    const styleId = "narrative-flipbook-print-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media print {
          [data-print-hide] {
            display: none !important;
          }
          .print\\:ml-0 {
            margin-left: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === flipbookContainerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Auto-play audio when scene changes
  useEffect(() => {
    stopAudio();
    window.setTimeout(playCurrentAudio, 80);
  }, [currentSceneIndex, currentTopicIndex, playCurrentAudio, stopAudio]);

  useEffect(() => {
    if (audioEnabled) playCurrentAudio();
    else stopAudio();
  }, [audioEnabled, playCurrentAudio, stopAudio]);

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
    <div
      ref={flipbookContainerRef}
      className={`w-full bg-white rounded-xl shadow-lg overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 rounded-none z-50" : "relative"
      }`}
    >
      {/* Left-side Toolbar */}
      <div
        className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center gap-2 bg-black/10 backdrop-blur-sm px-3 py-6 z-40"
        data-print-hide
      >
        <button
          onClick={handlePrevious}
          disabled={isTransitioning || (currentTopicIndex === 0 && currentSceneIndex === 0)}
          className="p-3 rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-white/20 text-gray-800 hover:text-gray-900"
          title="Previous scene (← or A)"
          aria-label="Previous scene"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleNext}
          disabled={isTransitioning || (currentTopicIndex === narratives.length - 1 && currentSceneIndex === currentTopic.scenes.length - 1)}
          className="p-3 rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-white/20 text-gray-800 hover:text-gray-900"
          title="Next scene (→ or D)"
          aria-label="Next scene"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <div className="h-px w-6 bg-white/30 my-2" />

        <button
          onClick={handleFullscreen}
          className="p-3 rounded-lg hover:bg-white/30 transition-all bg-white/20 text-gray-800 hover:text-gray-900"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="w-6 h-6" />
          ) : (
            <Maximize2 className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={handlePrint}
          className="p-3 rounded-lg hover:bg-white/30 transition-all bg-white/20 text-gray-800 hover:text-gray-900"
          title="Print current page"
          aria-label="Print"
        >
          <Printer className="w-6 h-6" />
        </button>
      </div>

      {/* Flipbook Container */}
      <div className="relative bg-gradient-to-b from-white to-gray-50 flex flex-col">
        {/* Scene Display */}
        <div className="overflow-hidden flex items-center justify-center bg-black/5 relative max-h-[70vh] ml-16 print:ml-0">
          {currentScene.imageDataUrl ? (
            <img
              src={currentScene.imageDataUrl}
              alt={currentScene.caption}
              className={`w-full h-auto max-h-[70vh] object-contain ${transitionClass} ${isTransitioning ? "opacity-75" : "opacity-100"}`}
            />
          ) : (
            <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <div className="w-12 h-12 border-3 border-white/50 border-t-white rounded-full animate-spin" />
                </div>
                <p className="text-white/70 text-sm">Generating image...</p>
              </div>
            </div>
          )}
        </div>

        {/* Caption Area (Comic-style text) — directly under the image */}
        <div className="bg-white border-t-2 border-gray-200 px-6 py-4 ml-16 print:ml-0">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">{currentScene.title}</h3>
            {captionsEnabled && <p className="text-[15px] leading-relaxed text-gray-700">{currentScene.caption}</p>}

            {/* Hidden audio element controlled by the bottom toolbar */}
            {currentScene.audioDataUrl && (
              <audio ref={audioRef} src={currentScene.audioDataUrl} preload="metadata" />
            )}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between ml-16 print:ml-0" data-print-hide>
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
        <div className="flex items-center justify-end gap-2 text-right">
          {hasAnyAudio && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
              <button
                onClick={() => handleAudioToggle(true)}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${audioEnabled ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                type="button"
                aria-pressed={audioEnabled}
                title="Turn audio on for all scenes"
              >
                <Volume2 className="h-3.5 w-3.5" /> On
              </button>
              <button
                onClick={() => handleAudioToggle(false)}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${!audioEnabled ? "bg-gray-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                type="button"
                aria-pressed={!audioEnabled}
                title="Turn audio off for all scenes"
              >
                <VolumeX className="h-3.5 w-3.5" /> Off
              </button>
            </div>
          )}
          <button
            onClick={handleFullscreen}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-gray-700 transition-colors hover:bg-gray-100"
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <p className="max-w-[180px] truncate text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{currentTopic.topicTitle}</span>
          </p>
        </div>
      </div>

      {/* Instructions Overlay (First Time) */}
      <div className="absolute top-4 right-4 text-xs text-white bg-black/40 px-3 py-2 rounded-lg pointer-events-none" data-print-hide>
        ← → or A/D keys to navigate
      </div>
    </div>
  );
};
