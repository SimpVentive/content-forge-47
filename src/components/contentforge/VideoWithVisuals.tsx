/**
 * Video with Synchronized Visual Overlays
 *
 * Displays HeyGen avatar video alongside animated SVG diagrams that are
 * synchronized with the narration timing.
 */

import React, { useState, useEffect, useRef } from "react";

export interface VisualOverlay {
  svgContent: string;
  startSeconds: number;
  durationSeconds: number;
}

interface VideoWithVisualsProps {
  videoUrl: string;
  videoDurationSeconds: number;
  visualOverlays: VisualOverlay[];
  title?: string;
}

export const VideoWithVisuals: React.FC<VideoWithVisualsProps> = ({
  videoUrl,
  videoDurationSeconds,
  visualOverlays,
  title,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeVisuals, setActiveVisuals] = useState<VisualOverlay[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track video playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  // Determine which visuals should be active at current time
  useEffect(() => {
    const active = visualOverlays.filter(
      (visual) =>
        currentTime >= visual.startSeconds &&
        currentTime < visual.startSeconds + visual.durationSeconds
    );
    setActiveVisuals(active);
  }, [currentTime, visualOverlays]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}

      <div className="flex gap-6 bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Video Section */}
        <div className="flex-1 flex flex-col">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full bg-black"
            style={{ aspectRatio: "16 / 9" }}
          />
          <div className="p-4 bg-gray-50 text-sm text-gray-600">
            <p>
              {Math.floor(currentTime / 60)}:
              {String(Math.floor(currentTime % 60)).padStart(2, "0")} /{" "}
              {Math.floor(videoDurationSeconds / 60)}:
              {String(Math.floor(videoDurationSeconds % 60)).padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* Visuals Section */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-auto max-h-96">
          {visualOverlays.length > 0 ? (
            <div className="relative flex-1 p-4">
              {activeVisuals.length > 0 ? (
                <div className="space-y-4">
                  {activeVisuals.map((visual, idx) => (
                    <div
                      key={idx}
                      className="animate-fadeIn"
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: visual.svgContent,
                        }}
                        className="max-w-full h-auto"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-center">
                    Visuals will appear here<br />
                    as the video plays
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No visual overlays available</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in;
        }

        svg {
          width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};

export default VideoWithVisuals;
