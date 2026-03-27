import React, { useState } from "react";
import { Eye, ThumbsUp, Play, X, ExternalLink, Check, Trash2 } from "lucide-react";

/* ── helpers ── */
function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { return null; } }
    return null;
  }
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0");
  const min = parseInt(m[2] || "0");
  const sec = parseInt(m[3] || "0");
  if (h > 0) return `${h}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${min}:${String(sec).padStart(2,"0")}`;
}

function durationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1]||"0")*3600 + parseInt(m[2]||"0")*60 + parseInt(m[3]||"0");
}

function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return (parts[0]||0)*60 + (parts[1]||0);
  if (parts.length === 3) return (parts[0]||0)*3600 + (parts[1]||0)*60 + (parts[2]||0);
  return 0;
}

function formatCount(n: string | number): string {
  const num = typeof n === "string" ? parseInt(n) : n;
  if (num >= 1_000_000) return `${(num/1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num/1_000).toFixed(1)}K`;
  return String(num);
}

function formatClipDuration(startSec: number, endSec: number): string {
  const diff = endSec - startSec;
  if (diff <= 0) return "0 sec";
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  if (m > 0 && s > 0) return `${m} min ${s} sec`;
  if (m > 0) return `${m} min`;
  return `${s} sec`;
}

export interface InsertedVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  startTime: string;
  endTime: string;
  moduleTitle: string;
  afterSlide: number;
}

interface VideosTabProps {
  raw: string;
  insertedVideos: InsertedVideo[];
  onInsert: (video: InsertedVideo) => void;
  onRemove: (videoId: string) => void;
}

/* ── Clip Preview Modal ── */
const ClipModal: React.FC<{
  video: any;
  startTime: string;
  endTime: string;
  onClose: () => void;
  onInsert: () => void;
  isInserted: boolean;
}> = ({ video, startTime, endTime, onClose, onInsert, isInserted }) => {
  const startSec = startTime ? timeToSeconds(startTime) : 0;
  const endSec = endTime ? timeToSeconds(endTime) : durationToSeconds(video.duration);
  const src = `https://www.youtube.com/embed/${video.videoId}?start=${startSec}${endSec ? `&end=${endSec}` : ""}&autoplay=1&rel=0&modestbranding=1`;
  const clipDur = formatClipDuration(startSec, endSec || durationToSeconds(video.duration));

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-[600px] max-w-[95vw] rounded-2xl overflow-hidden" style={{ background: "#1e293b" }} onClick={e => e.stopPropagation()}>
        <div className="p-4">
          <h3 className="text-[16px] font-bold text-white truncate">{video.title}</h3>
        </div>
        <div className="w-full aspect-video">
          <iframe
            src={src}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-[13px] text-white/60 bg-white/10 px-3 py-1 rounded-full">Clip: {clipDur}</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-white/20 text-white text-[13px] font-semibold hover:bg-white/5 transition-all">
              Close
            </button>
            {!isInserted && (
              <button onClick={onInsert} className="h-9 px-4 rounded-lg text-white text-[13px] font-bold transition-all" style={{ background: "#4f46e5" }}>
                Insert into Course
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Video Card ── */
const VideoCard: React.FC<{
  video: any;
  moduleTitle: string;
  isInserted: boolean;
  insertedInfo?: InsertedVideo;
  onInsert: (startTime: string, endTime: string) => void;
  onRemove: () => void;
}> = ({ video, moduleTitle, isInserted, insertedInfo, onInsert, onRemove }) => {
  const [startTime, setStartTime] = useState(insertedInfo?.startTime || "");
  const [endTime, setEndTime] = useState(insertedInfo?.endTime || "");
  const [showClip, setShowClip] = useState(false);
  const dur = parseDuration(video.duration);

  return (
    <>
      {showClip && (
        <ClipModal
          video={video}
          startTime={startTime}
          endTime={endTime}
          onClose={() => setShowClip(false)}
          onInsert={() => { onInsert(startTime, endTime); setShowClip(false); }}
          isInserted={isInserted}
        />
      )}
      <div className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${isInserted ? "border-l-4 border-emerald-500" : ""}`}>
        {isInserted && (
          <div className="bg-emerald-500 text-white text-[12px] font-semibold px-3 py-1.5 flex items-center gap-1.5">
            <Check className="w-3 h-3" /> Inserted into {moduleTitle}
          </div>
        )}
        {/* Thumbnail */}
        <div className="relative group cursor-pointer" onClick={() => setShowClip(true)}>
          <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
              <Play className="w-5 h-5 text-[#4f46e5] ml-0.5" />
            </div>
          </div>
          <span className="absolute top-2 left-2 bg-black/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded">{dur}</span>
        </div>

        {/* Body */}
        <div className="p-3.5">
          <h4 className="text-[14px] font-bold text-[#0f172a] line-clamp-2 leading-tight mb-1">{video.title}</h4>
          <p className="text-[12px] text-[#6b7280] mb-2">{video.channelTitle}</p>
          <div className="flex items-center gap-3 text-[12px] text-[#94a3b8]">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(video.viewCount)} views</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(video.likeCount)} likes</span>
          </div>
        </div>

        {/* Clip Controls */}
        <div className="bg-[#f8fafc] border-t border-[#e2e8f0] px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#475569] mb-2">Select clip range</p>
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] text-[#94a3b8]">Start</label>
              <input
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                placeholder="0:00"
                className="w-[72px] h-[36px] border border-[#e2e8f0] rounded-lg text-[13px] text-center focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
            <span className="text-[12px] text-[#94a3b8] mt-4">to</span>
            <div>
              <label className="text-[10px] text-[#94a3b8]">End</label>
              <input
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                placeholder={dur}
                className="w-[72px] h-[36px] border border-[#e2e8f0] rounded-lg text-[13px] text-center focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          </div>
          <p className="text-[10px] text-[#94a3b8] mt-1">Leave end blank to play to finish</p>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={() => setShowClip(true)}
            className="flex-1 h-9 rounded-lg text-[12px] font-bold border-2 border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5]/5 transition-all"
          >
            Preview Clip
          </button>
          {isInserted ? (
            <button
              onClick={onRemove}
              className="flex-1 h-9 rounded-lg text-[12px] font-bold border-2 border-red-500 text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          ) : (
            <button
              onClick={() => onInsert(startTime, endTime)}
              className="flex-1 h-9 rounded-lg text-[12px] font-bold text-white transition-all"
              style={{ background: "#4f46e5" }}
            >
              Insert into Course
            </button>
          )}
        </div>

        {isInserted && insertedInfo && (
          <div className="px-3 pb-2">
            <p className="text-[11px] text-[#94a3b8]">Will play after Slide {insertedInfo.afterSlide}</p>
          </div>
        )}
      </div>
    </>
  );
};

/* ── Main Videos Tab ── */
export const VideosTab: React.FC<VideosTabProps> = ({ raw, insertedVideos, onInsert, onRemove }) => {
  const data = tryParseJSON(raw);
  const [activeFilter, setActiveFilter] = useState("all");

  if (!raw) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Play className="w-10 h-10 text-[#ef4444]/30 mb-3" />
        <p className="text-[14px] font-semibold text-[#6b7280]">Run the pipeline to search YouTube videos</p>
      </div>
    );
  }

  if (!data?.modules) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800">
        ⚠ Add YOUTUBE_API_KEY to Lovable Secrets to enable video search
      </div>
    );
  }

  const modules: { module_title: string; videos: any[] }[] = data.modules;
  const filteredModules = activeFilter === "all" ? modules : modules.filter(m => m.module_title === activeFilter);

  const insertedIds = new Set(insertedVideos.map(v => v.videoId));

  const totalInsertedTime = insertedVideos.reduce((acc, v) => {
    const startSec = v.startTime ? timeToSeconds(v.startTime) : 0;
    const endSec = v.endTime ? timeToSeconds(v.endTime) : durationToSeconds(v.duration);
    return acc + (endSec - startSec);
  }, 0);

  const handleInsert = (video: any, moduleTitle: string, startTime: string, endTime: string) => {
    onInsert({
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnail: video.thumbnail,
      duration: video.duration,
      startTime,
      endTime,
      moduleTitle,
      afterSlide: 0, // default
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="text-[24px] font-[800] text-[#0f172a]">YouTube Resources</h3>
        <p className="text-[14px] text-[#6b7280] text-right">Review and insert videos<br/>into your course</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveFilter("all")}
          className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-all ${activeFilter === "all" ? "bg-[#4f46e5] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"}`}
        >
          All Modules
        </button>
        {modules.map(m => (
          <button
            key={m.module_title}
            onClick={() => setActiveFilter(m.module_title)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-all ${activeFilter === m.module_title ? "bg-[#4f46e5] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"}`}
          >
            {m.module_title}
          </button>
        ))}
      </div>

      {/* Module sections */}
      {filteredModules.map((mod, mi) => (
        <div key={mi}>
          <h4 className="text-[16px] font-bold text-[#0f172a] pl-3 border-l-4 border-[#4f46e5] mb-3">{mod.module_title}</h4>
          {mod.videos.length === 0 ? (
            <p className="text-[13px] text-[#94a3b8] italic">No videos found for this topic</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {mod.videos.map((video: any) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  moduleTitle={mod.module_title}
                  isInserted={insertedIds.has(video.videoId)}
                  insertedInfo={insertedVideos.find(v => v.videoId === video.videoId)}
                  onInsert={(st, et) => handleInsert(video, mod.module_title, st, et)}
                  onRemove={() => onRemove(video.videoId)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Inserted summary */}
      {insertedVideos.length > 0 && (
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 mt-6">
          <h4 className="text-[16px] font-bold text-[#0f172a] mb-3">Inserted Videos</h4>
          <div className="space-y-2">
            {insertedVideos.map(v => (
              <div key={v.videoId} className="flex items-center gap-3">
                <img src={v.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f172a] truncate">{v.title}</p>
                  <p className="text-[11px] text-[#94a3b8]">{v.moduleTitle} · {v.startTime || "0:00"} – {v.endTime || parseDuration(v.duration)}</p>
                </div>
                <button onClick={() => onRemove(v.videoId)} className="text-[12px] text-red-500 font-semibold hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <p className="text-[13px] font-semibold text-[#475569] mt-3">
            Total video time added: {formatClipDuration(0, totalInsertedTime)}
          </p>
        </div>
      )}
    </div>
  );
};
