import { useLocation, useNavigate } from "react-router-dom";
import { VideoPlayerPreview } from "@/components/VideoPlayerPreview";
import { ArrowLeft } from "lucide-react";
import contentForgeLogo from "@/assets/contentforge-logo.png";

const VideoPreviewPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const videos = state?.videos ?? [];
  const courseTitle = state?.courseTitle ?? "Your Course";

  if (videos.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No videos found.</p>
          <button onClick={() => navigate("/forge")} className="text-primary underline">
            Back to Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      <header className="h-[64px] bg-white border-b border-slate-200 flex items-center px-6 gap-4">
        <img src={contentForgeLogo} alt="ContentForge" className="h-9 object-contain" />
        <span className="text-xl font-bold text-slate-800 flex-1 truncate">{courseTitle}</span>
        <button
          onClick={() => navigate("/forge")}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Builder
        </button>
      </header>
      <div className="p-6">
        <VideoPlayerPreview
          videos={videos}
          onBack={() => navigate("/forge")}
          onDownloadAll={() => {
            videos.forEach((v: any) => {
              if (v.videoUrl) {
                const a = document.createElement("a");
                a.href = v.videoUrl;
                a.download = `${v.title}.mp4`;
                a.click();
              }
            });
          }}
        />
      </div>
    </div>
  );
};

export default VideoPreviewPage;
