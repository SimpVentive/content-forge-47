import { useState, useRef } from "react";
import { Play, Pause, Volume2, Maximize, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export interface VideoItem {
  videoId: string;
  videoUrl: string;
  title: string;
  duration: number;
  status: "pending" | "processing" | "ready" | "failed";
}

interface VideoPlayerPreviewProps {
  videos: VideoItem[];
  onDownloadAll?: () => void;
  onBack?: () => void;
  onDelete?: (videoId: string) => void;
}

export const VideoPlayerPreview = ({ videos, onDownloadAll, onBack, onDelete }: VideoPlayerPreviewProps) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = videos[currentVideoIndex];
  const totalVideos = videos.length;
  const isReady = currentVideo?.status === "ready";

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!currentVideo?.videoUrl) return;
    const a = document.createElement("a");
    a.href = currentVideo.videoUrl;
    a.download = `${currentVideo.title}.mp4`;
    a.click();
  };

  const goToPrevious = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
      setIsPlaying(false);
    }
  };

  const goToNext = () => {
    if (currentVideoIndex < totalVideos - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
      setIsPlaying(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0f172a] mb-2">Your Generated Videos</h1>
        <p className="text-sm text-[#6b7280]">{totalVideos} video{totalVideos !== 1 ? "s" : ""} ready to view</p>
      </div>

      {/* Video Display Grid */}
      {totalVideos === 1 ? (
        // Single video - large player
        <div className="space-y-6">
          <div className="bg-black rounded-xl overflow-hidden">
            {isReady ? (
              <div className="relative bg-black aspect-video flex items-center justify-center group">
                <video
                  ref={videoRef}
                  src={currentVideo.videoUrl}
                  className="w-full h-full"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Play Button Overlay */}
                {!isPlaying && (
                  <button
                    onClick={handlePlayPause}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </button>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePlayPause}
                      className="text-white hover:opacity-80 transition-opacity"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button className="text-white hover:opacity-80 transition-opacity">
                      <Volume2 className="w-5 h-5" />
                    </button>
                    <div className="flex-1" />
                    <button className="text-white hover:opacity-80 transition-opacity">
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-slate-100 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-[#6b7280]">{currentVideo.status === "processing" ? "Generating..." : "Pending..."}</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-[#0f172a] mb-1">{currentVideo.title}</h2>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#6b7280]">Duration: {formatDuration(currentVideo.duration)}</p>
              <p className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-medium">
                {currentVideo.status === "ready" ? "Ready" : "Processing..."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isReady && (
                <>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#4f46e5] text-white font-medium rounded-lg hover:brightness-110 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(currentVideo.videoId)}
                      className="px-4 py-2 border border-[#e2e8f0] text-[#6b7280] font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Multiple videos - grid + current player
        <div className="space-y-6">
          {/* Current Video Player */}
          <div className="bg-black rounded-xl overflow-hidden">
            {isReady ? (
              <div className="relative bg-black aspect-video flex items-center justify-center group">
                <video
                  ref={videoRef}
                  src={currentVideo.videoUrl}
                  className="w-full h-full"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {!isPlaying && (
                  <button
                    onClick={handlePlayPause}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-slate-100 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Video Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Video {currentVideoIndex + 1} of {totalVideos}: {currentVideo.title}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={goToPrevious}
                disabled={currentVideoIndex === 0}
                className="p-2 border border-[#e2e8f0] rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                disabled={currentVideoIndex === totalVideos - 1}
                className="p-2 border border-[#e2e8f0] rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video Thumbnails Grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {videos.map((video, index) => (
              <button
                key={video.videoId}
                onClick={() => {
                  setCurrentVideoIndex(index);
                  setIsPlaying(false);
                }}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentVideoIndex ? "border-[#4f46e5]" : "border-[#e2e8f0] hover:border-[#4f46e5]"
                }`}
              >
                <div className="aspect-video bg-slate-200 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white opacity-60" />
                </div>
                <div className="absolute inset-0 flex flex-col items-end justify-end p-2">
                  <span className="text-xs font-medium text-white bg-black/50 px-2 py-1 rounded">
                    {formatDuration(video.duration)}
                  </span>
                </div>
                {video.status !== "ready" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isReady && (
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#4f46e5] text-white font-semibold rounded-lg hover:brightness-110 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Current Video
              </button>
            )}
            {onDownloadAll && (
              <button
                onClick={onDownloadAll}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#4f46e5] text-[#4f46e5] font-semibold rounded-lg hover:bg-indigo-50 transition-all"
              >
                <Download className="w-4 h-4" />
                Download All Videos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex gap-2 mt-8 pt-8 border-t border-[#e2e8f0]">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 px-4 py-3 border-2 border-[#e2e8f0] text-[#0f172a] font-semibold rounded-lg hover:bg-slate-50 transition-all"
          >
            Back to Settings
          </button>
        )}
        <button className="flex-1 px-4 py-3 bg-[#059669] text-white font-semibold rounded-lg hover:brightness-110 transition-all">
          Launch Video Course
        </button>
      </div>
    </div>
  );
};
