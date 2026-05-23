import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/home/BrandLogo";

const PresentationIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="12" width="48" height="36" rx="2" stroke="#4f46e5" strokeWidth="2" fill="none" />
    <circle cx="32" cy="18" r="4" fill="#4f46e5" />
    <path d="M20 28 L32 38 L44 28" stroke="#4f46e5" strokeWidth="2" fill="none" strokeLinecap="round" />
    <rect x="8" y="50" width="48" height="2" fill="#4f46e5" />
  </svg>
);

const VideoIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="12" width="48" height="40" rx="2" stroke="#0891b2" strokeWidth="2" fill="none" />
    <path d="M28 32 L44 24 L44 40 Z" fill="#0891b2" />
    <circle cx="48" cy="28" r="3" fill="#0891b2" />
    <circle cx="48" cy="36" r="3" fill="#0891b2" />
  </svg>
);

export const TypeSelector = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<"static" | "video" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectType = (type: "static" | "video") => {
    setLoading(true);
    setSelectedType(type);

    // Small delay for visual feedback
    setTimeout(() => {
      if (type === "static") {
        navigate("/forge", { state: { learningType: "static" } });
      } else {
        navigate("/setup/video", { state: { learningType: "video" } });
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f7] px-6 py-12">
      {/* Logo */}
      <div className="mb-12 flex justify-center">
        <img src={contentForgeLogo} alt="ContentForge" className="h-10 object-contain" />
      </div>

      {/* Header Section */}
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-[800] text-[#0f172a] md:text-5xl">
          Create Your Course
        </h1>
        <p className="mb-3 text-xl text-[#6b7280]">
          Choose your learning format
        </p>
        <p className="text-base text-[#94a3b8]">
          You can create animated, interactive courses in minutes
        </p>
      </div>

      {/* Cards Container */}
      <div className="mx-auto mb-12 max-w-[900px]">
        <div className="flex flex-col gap-6 md:flex-row md:gap-6">
          {/* Static E-Learning Card */}
          <div
            onClick={() => !loading && handleSelectType("static")}
            className="group flex flex-col rounded-2xl border-[1.5px] border-[#e2e8f0] bg-white p-6 transition-all duration-200 md:w-1/2 md:p-8 cursor-pointer hover:border-[#4f46e5] hover:shadow-lg hover:shadow-[rgba(79,70,229,0.15)] hover:-translate-y-0.5"
          >
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <PresentationIcon />
            </div>

            {/* Title */}
            <h2 className="mb-3 text-center text-2xl font-bold text-[#0f172a]">
              Static E-Learning
            </h2>

            {/* Description */}
            <p className="mb-6 text-center text-sm text-[#6b7280] leading-relaxed">
              Interactive slides with AI avatar narration
            </p>

            {/* Features */}
            <ul className="mb-auto space-y-2 text-sm text-[#374151]">
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>Slide-by-slide learning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>Avatar with lip-sync narration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>Interactive animations & diagrams</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>Rive & Lottie interactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>Q&A hand raise feature</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4f46e5]">•</span>
                <span>YouTube video integration</span>
              </li>
            </ul>

            {/* Footer Text */}
            <p className="mb-6 mt-6 text-xs italic text-[#94a3b8]">
              Perfect for: Training modules, compliance courses, onboarding
            </p>

            {/* Button */}
            <button
              onClick={() => !loading && handleSelectType("static")}
              disabled={loading && selectedType === "static"}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-80"
            >
              {loading && selectedType === "static" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Static Course"
              )}
            </button>
          </div>

          {/* Video Learning Card */}
          <div
            onClick={() => !loading && handleSelectType("video")}
            className="group flex flex-col rounded-2xl border-[1.5px] border-[#e2e8f0] bg-white p-6 transition-all duration-200 md:w-1/2 md:p-8 cursor-pointer hover:border-[#0891b2] hover:shadow-lg hover:shadow-[rgba(8,145,178,0.15)] hover:-translate-y-0.5"
          >
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <VideoIcon />
            </div>

            {/* Title */}
            <h2 className="mb-3 text-center text-2xl font-bold text-[#0f172a]">
              Video Learning
            </h2>

            {/* Description */}
            <p className="mb-6 text-center text-sm text-[#6b7280] leading-relaxed">
              Full-length video courses with HeyGen avatar
            </p>

            {/* Features */}
            <ul className="mb-auto space-y-2 text-sm text-[#374151]">
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Full video with animated avatar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Professional presentations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Natural gestures & expressions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Supports Standard Operating Procedures (SOPs)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Whiteboard explanations for SOPs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0891b2]">•</span>
                <span>Interactive Q&A support</span>
              </li>
            </ul>

            {/* Footer Text */}
            <p className="mb-6 mt-6 text-xs italic text-[#94a3b8]">
              Perfect for: Video courses, SOP training, demonstrations
            </p>

            {/* Button */}
            <button
              onClick={() => !loading && handleSelectType("video")}
              disabled={loading && selectedType === "video"}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0891b2] text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-80"
            >
              {loading && selectedType === "video" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Video Course"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Helper */}
      <div className="mx-auto max-w-[900px] rounded-xl border border-[#e2e8f0] bg-white p-6 md:p-8">
        <h3 className="mb-4 text-center text-lg font-semibold text-[#0f172a]">
          Not sure which to choose?
        </h3>
        <p className="text-center text-sm text-[#6b7280] leading-relaxed">
          <span className="font-medium">Static works great for quick training</span> — perfect when you need to launch fast.
          <br className="hidden md:inline" />
          <span className="font-medium">Video is better for professional, polished courses</span> — invest more time for higher-quality output.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">Feature</th>
                <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">Static</th>
                <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">Video</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#e2e8f0]">
                <td className="px-4 py-3 text-[#374151]">Avatar</td>
                <td className="px-4 py-3 text-[#374151]">Image + lip-sync</td>
                <td className="px-4 py-3 text-[#374151]">Full video</td>
              </tr>
              <tr className="border-b border-[#e2e8f0]">
                <td className="px-4 py-3 text-[#374151]">Setup time</td>
                <td className="px-4 py-3 text-[#374151]">2-3 minutes</td>
                <td className="px-4 py-3 text-[#374151]">5-10 minutes</td>
              </tr>
              <tr className="border-b border-[#e2e8f0]">
                <td className="px-4 py-3 text-[#374151]">Cost</td>
                <td className="px-4 py-3 text-[#374151]">Standard credits</td>
                <td className="px-4 py-3 text-[#374151]">Standard + video</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[#374151]">Best for</td>
                <td className="px-4 py-3 text-[#374151]">Quick training</td>
                <td className="px-4 py-3 text-[#374151]">Professional courses</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
