import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useContentForge } from "@/hooks/ContentForgeContext";


const qualities = [
  { id: "720p", label: "720p - Fast", desc: "Faster generation (3-5 min per video)" },
  { id: "1080p", label: "1080p - Standard", desc: "Standard HD (5-8 min per video)" },
  { id: "4k", label: "4K - Premium", desc: "Highest quality (10-15 min per video)" },
];

const backgrounds = [
  { id: "simple", label: "Simple - Plain Color", desc: "Minimalist, distraction-free" },
  { id: "office", label: "Office - Professional Setting", desc: "Modern office background" },
  { id: "classroom", label: "Classroom - Educational", desc: "Classroom or training room" },
];

export const VideoSetup = ({ isSOP = false }: { isSOP?: boolean }) => {
  const navigate = useNavigate();
  const { setVideoSettings } = useContentForge();
  const [settings, setSettings] = useState<{
    selectedAvatar: string;
    videoQuality: "720p" | "1080p" | "4k";
    backgroundStyle: "simple" | "office" | "classroom";
  }>({
    selectedAvatar: "", // filled from Course Setup instructor at run time
    videoQuality: "1080p",
    backgroundStyle: "office",
  });

  const handleContinue = () => {
    setVideoSettings(settings);
    navigate("/forge", { state: { learningType: "video" } });
  };


  return (
    <div className="min-h-screen bg-[#f0f2f7] px-6 py-12">
      {/* Header */}
      <div className="mx-auto max-w-[700px] mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-[#6b7280] hover:text-[#0f172a] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-[800] text-[#0f172a] mb-2">Video Settings</h1>
          <p className="text-base text-[#6b7280]">Customize your course video</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[700px] space-y-8">
        {/* Instructor is selected in Course Setup — no duplicate picker here. */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-sm font-semibold text-[#0f172a]">Instructor / Avatar</p>
          <p className="text-xs text-[#6b7280] mt-1">
            Your on-screen instructor is chosen in the <span className="font-semibold">Course Setup</span> step
            (next). The same person is used to render the HeyGen video — no need to pick twice.
          </p>
        </div>


        {/* Section 2: Video Quality */}
        <div>
          <label className="text-2xl font-bold text-[#0f172a] block mb-1">Video Quality</label>
          <p className="text-xs text-[#94a3b8] mb-4">Higher quality = slower generation</p>
          <div className="space-y-2">
            {qualities.map((q) => (
              <button
                key={q.id}
                onClick={() => setSettings({ ...settings, videoQuality: q.id as any })}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  settings.videoQuality === q.id
                    ? "border-[#4f46e5] bg-[#4f46e5]/5"
                    : "border-[#e2e8f0] bg-white hover:border-[#4f46e5]"
                }`}
              >
                <p className="font-semibold text-[#0f172a]">{q.label}</p>
                <p className="text-xs text-[#6b7280]">{q.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Background Style */}
        <div>
          <label className="text-2xl font-bold text-[#0f172a] block mb-1">Background</label>
          <p className="text-xs text-[#94a3b8] mb-4">What environment should your avatar appear in?</p>
          <div className="space-y-2">
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => setSettings({ ...settings, backgroundStyle: bg.id as any })}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  settings.backgroundStyle === bg.id
                    ? "border-[#4f46e5] bg-[#4f46e5]/5"
                    : "border-[#e2e8f0] bg-white hover:border-[#4f46e5]"
                }`}
              >
                <p className="font-semibold text-[#0f172a]">{bg.label}</p>
                <p className="text-xs text-[#6b7280]">{bg.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Summary & Cost */}
        <div className="bg-[#f0f2f7] border border-[#e2e8f0] rounded-lg p-4">
          <p className="font-semibold text-[#0f172a] mb-2">Estimated Video Generation Details</p>
          <p className="text-sm text-[#6b7280] mb-1">Per video file: 5-8 minutes ({settings.videoQuality})</p>
          <p className="text-sm text-[#6b7280] mb-1">Cost: ~25 credits per video</p>
          <p className="text-xs text-[#94a3b8] italic">Total cost depends on course length</p>
          {isSOP && (
            <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
              <p className="text-sm text-[#059669] font-medium">✓ SOP Detected: Videos will include whiteboard explanations</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-6 py-3 border-2 border-[#e2e8f0] text-[#0f172a] font-semibold rounded-lg hover:bg-slate-50 transition-all"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-6 py-3 bg-[#4f46e5] text-white font-semibold rounded-lg hover:brightness-110 transition-all"
          >
            Continue to Course Setup
          </button>
        </div>
      </div>
    </div>
  );
};
