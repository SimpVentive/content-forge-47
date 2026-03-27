import React, { useState } from "react";
import { Eye, ThumbsUp, Play, X, Check, Trash2, Search, Clock, Plus, ChevronDown, ChevronUp, Film } from "lucide-react";

/* ── helpers ── */
function tryParseJSON(raw: string | undefined | null): any | null {
  if (!raw) return null;
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
const ClipModal = ({ video, startTime, endTime, onClose, onInsert, isInserted }: {
  video: any; startTime: string; endTime: string; onClose: () => void; onInsert: () => void; isInserted: boolean;
}) => {
  const startSec = startTime ? timeToSeconds(startTime) : 0;
  const endSec = endTime ? timeToSeconds(endTime) : durationToSeconds(video.duration);
  const src = `https://www.youtube.com/embed/${video.videoId}?start=${startSec}${endSec ? `&end=${endSec}` : ""}&autoplay=1&rel=0&modestbranding=1`;
  const clipDur = formatClipDuration(startSec, endSec || durationToSeconds(video.duration));

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-[680px] max-w-[95vw] rounded-2xl overflow-hidden bg-[#0f172a] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-white truncate">{video.title}</h3>
            <p className="text-[13px] text-white/50 mt-0.5">{video.channelTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 ml-3">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="w-full aspect-video">
          <iframe src={src} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-white/50 bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Clip: {clipDur}
            </span>
            <span className="text-[12px] text-white/40">
              {startTime || "0:00"} → {endTime || parseDuration(video.duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-white/20 text-white text-[13px] font-semibold hover:bg-white/5 transition-all">
              Close
            </button>
            {!isInserted && (
              <button onClick={onInsert} className="h-9 px-5 rounded-lg text-white text-[13px] font-bold transition-all flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                <Plus className="w-3.5 h-3.5" /> Insert into Course
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Compact Video Card ── */
const VideoCard = ({ video, moduleTitle, isInserted, insertedInfo, onInsert, onRemove }: {
  video: any; moduleTitle: string; isInserted: boolean; insertedInfo?: InsertedVideo;
  onInsert: (startTime: string, endTime: string) => void; onRemove: () => void;
}) => {
  const [startTime, setStartTime] = useState(insertedInfo?.startTime || "");
  const [endTime, setEndTime] = useState(insertedInfo?.endTime || "");
  const [showClip, setShowClip] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dur = parseDuration(video.duration);

  return (
    <>
      {showClip && (
        <ClipModal
          video={video} startTime={startTime} endTime={endTime}
          onClose={() => setShowClip(false)}
          onInsert={() => { onInsert(startTime, endTime); setShowClip(false); }}
          isInserted={isInserted}
        />
      )}
      <div className={`bg-card rounded-xl border transition-all hover:shadow-md ${isInserted ? "border-emerald-400 ring-1 ring-emerald-400/20" : "border-border"}`}>
        {/* Top: Thumbnail + Info Row */}
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className="relative w-[160px] shrink-0 rounded-lg overflow-hidden cursor-pointer group" onClick={() => setShowClip(true)}>
            <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                <Play className="w-4 h-4 text-primary ml-0.5" />
              </div>
            </div>
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{dur}</span>
            {isInserted && (
              <span className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Added
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h4 className="text-[13px] font-bold text-foreground line-clamp-2 leading-tight">{video.title}</h4>
              <p className="text-[11px] text-muted-foreground mt-1">{video.channelTitle}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(video.viewCount)}</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(video.likeCount)}</span>
            </div>
          </div>
        </div>

        {/* Expand toggle for clip controls */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/5 transition-all border-t border-border"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide clip options" : "Set clip range & insert"}
        </button>

        {/* Expanded clip controls */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Start</label>
                <input
                  value={startTime} onChange={e => setStartTime(e.target.value)}
                  placeholder="0:00"
                  className="w-full h-8 border border-border rounded-lg text-[12px] text-center bg-card focus:outline-none focus:border-primary"
                />
              </div>
              <span className="text-[11px] text-muted-foreground mt-4">→</span>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">End</label>
                <input
                  value={endTime} onChange={e => setEndTime(e.target.value)}
                  placeholder={dur}
                  className="w-full h-8 border border-border rounded-lg text-[12px] text-center bg-card focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Leave end blank to use full video. Set start/end to clip a specific segment.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowClip(true)} className="flex-1 h-8 rounded-lg text-[11px] font-bold border border-primary text-primary hover:bg-primary/5 transition-all">
                Preview Clip
              </button>
              {isInserted ? (
                <button onClick={onRemove} className="flex-1 h-8 rounded-lg text-[11px] font-bold text-destructive border border-destructive hover:bg-destructive/5 transition-all flex items-center justify-center gap-1">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              ) : (
                <button
                  onClick={() => onInsert(startTime, endTime)}
                  className="flex-1 h-8 rounded-lg text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  <Plus className="w-3 h-3" /> Insert into Course
                </button>
              )}
            </div>
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
  const [searchQuery, setSearchQuery] = useState("");

  if (!raw) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <Film className="w-8 h-8 text-destructive/40" />
        </div>
        <p className="text-[15px] font-bold text-foreground mb-1">YouTube Resources</p>
        <p className="text-[13px] text-muted-foreground">Run the pipeline to search for relevant videos</p>
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

  const totalVideos = modules.reduce((acc, m) => acc + m.videos.length, 0);

  const handleInsert = (video: any, moduleTitle: string, startTime: string, endTime: string) => {
    onInsert({
      videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
      thumbnail: video.thumbnail, duration: video.duration,
      startTime, endTime, moduleTitle, afterSlide: 0,
    });
  };

  // Filter by search query
  const filterVideos = (videos: any[]) => {
    if (!searchQuery) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(v => v.title.toLowerCase().includes(q) || v.channelTitle.toLowerCase().includes(q));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-extrabold text-foreground">YouTube Resources</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">{totalVideos} videos found · {insertedVideos.length} inserted</p>
        </div>
      </div>

      {/* How to use hint */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-[12px] text-foreground leading-relaxed">
        <p className="font-bold text-primary mb-1">💡 How to insert videos into your course</p>
        <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
          <li>Browse videos by module below</li>
          <li>Click <strong>"Set clip range & insert"</strong> to expand clip options</li>
          <li>Set start/end times to clip a specific segment (or leave blank for full video)</li>
          <li>Click <strong>"Preview Clip"</strong> to watch, then <strong>"Insert into Course"</strong></li>
        </ol>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="w-full h-9 pl-9 pr-3 border border-border rounded-lg text-[12px] bg-card text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Module filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveFilter("all")}
          className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all ${activeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-border"}`}
        >
          All Modules
        </button>
        {modules.map(m => (
          <button
            key={m.module_title}
            onClick={() => setActiveFilter(m.module_title)}
            className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all ${activeFilter === m.module_title ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-border"}`}
          >
            {m.module_title} ({m.videos.length})
          </button>
        ))}
      </div>

      {/* Inserted Videos Summary (top) */}
      {insertedVideos.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-bold text-emerald-800 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {insertedVideos.length} video{insertedVideos.length > 1 ? "s" : ""} inserted
            </p>
            <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {formatClipDuration(0, totalInsertedTime)} total
            </span>
          </div>
          <div className="space-y-1.5">
            {insertedVideos.map(v => (
              <div key={v.videoId} className="flex items-center gap-2 bg-white rounded-lg p-2">
                <img src={v.thumbnail} alt="" className="w-12 h-8 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">{v.title}</p>
                  <p className="text-[10px] text-muted-foreground">{v.moduleTitle} · {v.startTime || "0:00"} → {v.endTime || parseDuration(v.duration)}</p>
                </div>
                <button onClick={() => onRemove(v.videoId)} className="text-[11px] text-destructive font-semibold hover:underline shrink-0">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module sections */}
      {filteredModules.map((mod, mi) => {
        const videos = filterVideos(mod.videos);
        return (
          <div key={mi}>
            <h4 className="text-[14px] font-bold text-foreground pl-3 border-l-[3px] border-primary mb-2">{mod.module_title}</h4>
            {videos.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic pl-3">No videos found for this topic</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {videos.map((video: any) => (
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
        );
      })}
    </div>
  );
};
