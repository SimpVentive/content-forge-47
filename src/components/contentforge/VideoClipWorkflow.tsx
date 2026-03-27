import React, { useState, useRef } from "react";
import { X, Play, Scissors, Film, Check, ChevronRight, Pencil, MapPin, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InsertedVideo } from "./VideosTab";

/* ── helpers ── */
function parseDuration(iso: string): string {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0");
  const min = parseInt(m[2] || "0");
  const sec = parseInt(m[3] || "0");
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function durationToSeconds(iso: string): number {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || "0") * 3600 + parseInt(m[2] || "0") * 60 + parseInt(m[3] || "0");
}

function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return 0;
}

function formatSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function tryParseJSON(raw: string | undefined | null): any | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { return null; } }
    return null;
  }
}

/* ── Types ── */
interface ClipItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  clipType: "all" | "range";
  startTime: string;
  endTime: string;
  customName: string;
  insertAfterModule: string;
}

interface VideoClipWorkflowProps {
  youtubeRaw: string;
  modules: string[];
  courseTitle: string;
  language?: string;
  level?: string;
  duration?: string;
  onComplete: (clips: ClipItem[]) => void;
  onSkip: () => void;
}

/* ═══════════════════════════════════════
   STEP 1: Ask if user wants videos
   ═══════════════════════════════════════ */
const AskInsertDialog: React.FC<{ onYes: () => void; onNo: () => void }> = ({ onYes, onNo }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onNo} />
    <div className="relative bg-card rounded-2xl shadow-2xl w-[600px] max-w-[92vw] overflow-hidden" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Gradient accent bar */}
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #ef4444 0%, #4f46e5 50%, #7c3aed 100%)" }} />

      <div className="px-10 pt-10 pb-8">
        {/* Icon + Badge row */}
        <div className="flex items-center justify-center gap-4 mb-7">
          <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
            <Film className="w-9 h-9 text-white" />
          </div>
        </div>

        <h2 className="text-[26px] font-[800] text-foreground text-center tracking-tight mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Enhance with YouTube Videos?
        </h2>

        <p className="text-[15px] text-muted-foreground text-center leading-relaxed max-w-[420px] mx-auto mb-8">
          We found relevant YouTube videos for your course modules. Browse, clip specific segments, and insert them directly into your e-learning.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: "🎬", title: "Browse", desc: "Videos per module" },
            { icon: "✂️", title: "Clip", desc: "Select time ranges" },
            { icon: "📍", title: "Insert", desc: "Place in course" },
          ].map((f) => (
            <div key={f.title} className="bg-secondary/60 rounded-xl p-3.5 text-center">
              <span className="text-[22px] block mb-1.5">{f.icon}</span>
              <p className="text-[13px] font-bold text-foreground">{f.title}</p>
              <p className="text-[11px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 h-[52px] rounded-xl text-[15px] font-bold text-muted-foreground border-2 border-border hover:bg-secondary/60 transition-all"
          >
            Skip for Now
          </button>
          <button
            onClick={onYes}
            className="flex-[1.5] h-[52px] rounded-xl text-[15px] font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <Play className="w-4 h-4" /> Yes, Let's Browse Videos
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════
   STEP 2: Select clip range after playing
   ═══════════════════════════════════════ */
const ClipRangeDialog: React.FC<{
  video: any;
  onConfirm: (clipType: "all" | "range", start: string, end: string) => void;
  onCancel: () => void;
}> = ({ video, onConfirm, onCancel }) => {
  const [clipType, setClipType] = useState<"all" | "range">("all");
  const [startTime, setStartTime] = useState("0:00");
  const [endTime, setEndTime] = useState(parseDuration(video.duration));
  const totalDur = parseDuration(video.duration);

  const startSec = clipType === "all" ? 0 : timeToSeconds(startTime);
  const endSec = clipType === "all" ? durationToSeconds(video.duration) : timeToSeconds(endTime);
  const src = `https://www.youtube.com/embed/${video.videoId}?start=${startSec}&end=${endSec}&autoplay=0&rel=0&modestbranding=1`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#0f172a] rounded-2xl shadow-2xl w-[640px] max-w-[95vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-white truncate">{video.title}</h3>
            <p className="text-[13px] text-white/50 mt-0.5">{video.channelTitle} · {totalDur}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 ml-3">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Video embed */}
        <div className="w-full aspect-video">
          <iframe src={src} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>

        {/* Clip selection */}
        <div className="p-5 space-y-4">
          <p className="text-[14px] font-bold text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-primary" />
            Select the range of the clip you want to insert
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setClipType("all")}
              className={`flex-1 h-12 rounded-xl text-[14px] font-bold transition-all border-2 ${
                clipType === "all"
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/20 text-white/60 hover:border-white/40"
              }`}
            >
              🎬 Use Entire Video
            </button>
            <button
              onClick={() => setClipType("range")}
              className={`flex-1 h-12 rounded-xl text-[14px] font-bold transition-all border-2 ${
                clipType === "range"
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/20 text-white/60 hover:border-white/40"
              }`}
            >
              ✂️ Custom Range
            </button>
          </div>

          {clipType === "range" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">From</label>
                <input
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="0:00"
                  className="w-full h-10 border border-white/20 rounded-xl text-[14px] text-center bg-white/5 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <span className="text-white/40 mt-5 text-[16px]">→</span>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1 block">To</label>
                <input
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder={totalDur}
                  className="w-full h-10 border border-white/20 rounded-xl text-[14px] text-center bg-white/5 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => onConfirm(clipType, clipType === "all" ? "0:00" : startTime, clipType === "all" ? totalDur : endTime)}
            className="w-full h-12 rounded-xl text-[15px] font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <Check className="w-4 h-4" /> Confirm & Add Clip
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   STEP 3: After adding — ask insert another?
   ═══════════════════════════════════════ */
const InsertAnotherDialog: React.FC<{ clipCount: number; onYes: () => void; onDone: () => void }> = ({ clipCount, onYes, onDone }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <div className="relative bg-card rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="p-7 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-[20px] font-extrabold text-foreground mb-1">Clip Added!</h2>
        <p className="text-[14px] text-muted-foreground">
          You have <span className="font-bold text-foreground">{clipCount}</span> clip{clipCount > 1 ? "s" : ""} selected. Want to add another?
        </p>
      </div>
      <div className="flex border-t border-border">
        <button onClick={onDone} className="flex-1 h-13 py-4 text-[14px] font-bold text-muted-foreground hover:bg-secondary/50 transition-all">
          Done Adding
        </button>
        <div className="w-px bg-border" />
        <button onClick={onYes} className="flex-1 h-13 py-4 text-[14px] font-bold text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Another
        </button>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════
   STEP 4: Review, rename, preview, assign
   ═══════════════════════════════════════ */
const ClipReviewPanel: React.FC<{
  clips: ClipItem[];
  modules: string[];
  onUpdateClip: (id: string, updates: Partial<ClipItem>) => void;
  onRemoveClip: (id: string) => void;
  onFinish: () => void;
  onPreviewAll: () => void;
}> = ({ clips, modules, onUpdateClip, onRemoveClip, onFinish, onPreviewAll }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card rounded-2xl shadow-2xl w-[680px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-[20px] font-extrabold text-foreground flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Review Your Clips ({clips.length})
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">Rename clips and assign them to modules in your e-learning</p>
        </div>

        {/* Clips list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {clips.map((clip, idx) => (
            <div key={clip.id} className="bg-secondary/50 rounded-xl p-4 space-y-3">
              <div className="flex gap-3">
                <img src={clip.thumbnail} alt="" className="w-[120px] aspect-video rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingId === clip.id ? (
                    <input
                      autoFocus
                      value={clip.customName}
                      onChange={e => onUpdateClip(clip.id, { customName: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                      className="w-full h-8 border border-primary rounded-lg px-2 text-[13px] font-bold bg-card text-foreground focus:outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-bold text-foreground truncate">{clip.customName}</h4>
                      <button onClick={() => setEditingId(clip.id)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{clip.channelTitle}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Clip: {clip.clipType === "all" ? "Full video" : `${clip.startTime} → ${clip.endTime}`}
                  </p>
                </div>
                <button onClick={() => onRemoveClip(clip.id)} className="text-[11px] text-destructive font-bold hover:underline shrink-0 self-start">
                  Remove
                </button>
              </div>

              {/* Module assignment */}
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <label className="text-[11px] font-semibold text-muted-foreground shrink-0">Insert after:</label>
                <select
                  value={clip.insertAfterModule}
                  onChange={e => onUpdateClip(clip.id, { insertAfterModule: e.target.value })}
                  className="flex-1 h-8 border border-border rounded-lg text-[12px] bg-card text-foreground px-2 focus:outline-none focus:border-primary"
                >
                  <option value="">— Select module —</option>
                  {modules.map((mod, i) => (
                    <option key={i} value={mod}>{mod}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={onPreviewAll}
            className="h-10 px-5 rounded-xl text-[13px] font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5" /> Preview All Clips
          </button>
          <button
            onClick={onFinish}
            className="h-10 px-6 rounded-xl text-[13px] font-bold text-white transition-all flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <Check className="w-3.5 h-3.5" /> Done — Insert into Course
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   STEP 5: Preview all clips player
   ═══════════════════════════════════════ */
const ClipPlayer: React.FC<{ clips: ClipItem[]; onClose: () => void }> = ({ clips, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const clip = clips[currentIdx];
  if (!clip) return null;

  const startSec = clip.clipType === "all" ? 0 : timeToSeconds(clip.startTime);
  const endSec = clip.clipType === "all" ? durationToSeconds(clip.duration) : timeToSeconds(clip.endTime);
  const src = `https://www.youtube.com/embed/${clip.videoId}?start=${startSec}&end=${endSec}&autoplay=1&rel=0&modestbranding=1`;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f172a] rounded-2xl shadow-2xl w-[720px] max-w-[95vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] text-white/40 font-semibold">Clip {currentIdx + 1} of {clips.length}</p>
            <h3 className="text-[16px] font-bold text-white">{clip.customName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="w-full aspect-video">
          <iframe key={`${clip.videoId}-${currentIdx}`} src={src} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="h-9 px-4 rounded-lg border border-white/20 text-white text-[13px] font-semibold disabled:opacity-30 hover:bg-white/5 transition-all"
          >
            ← Previous
          </button>
          <p className="text-[12px] text-white/50">
            {clip.insertAfterModule ? `→ ${clip.insertAfterModule}` : "No module assigned"}
          </p>
          {currentIdx < clips.length - 1 ? (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              className="h-9 px-4 rounded-lg text-white text-[13px] font-bold transition-all flex items-center gap-1"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-white text-[13px] font-bold transition-all flex items-center gap-1"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN WORKFLOW ORCHESTRATOR
   ═══════════════════════════════════════ */
export const VideoClipWorkflow: React.FC<VideoClipWorkflowProps> = ({ youtubeRaw, modules, onComplete, onSkip }) => {
  const [step, setStep] = useState<"ask" | "browse" | "clipRange" | "insertAnother" | "review" | "preview" | "done">("ask");
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [browseModule, setBrowseModule] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const idCounter = useRef(0);

  const data = tryParseJSON(youtubeRaw);
  const allModules: { module_title: string; videos: any[] }[] = data?.modules || [];

  const handleSelectVideo = (video: any) => {
    setSelectedVideo(video);
    setStep("clipRange");
  };

  const handleClipConfirm = (clipType: "all" | "range", start: string, end: string) => {
    if (!selectedVideo) return;
    idCounter.current += 1;
    const newClip: ClipItem = {
      id: `clip-${idCounter.current}`,
      videoId: selectedVideo.videoId,
      title: selectedVideo.title,
      channelTitle: selectedVideo.channelTitle,
      thumbnail: selectedVideo.thumbnail,
      duration: selectedVideo.duration,
      clipType,
      startTime: start,
      endTime: end,
      customName: `Module ${clips.length + 1} Video`,
      insertAfterModule: "",
    };
    setClips(prev => [...prev, newClip]);
    setSelectedVideo(null);
    setStep("insertAnother");
  };

  const handleUpdateClip = (id: string, updates: Partial<ClipItem>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleRemoveClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  };

  // Step: ASK
  if (step === "ask") {
    return <AskInsertDialog onYes={() => setStep("browse")} onNo={onSkip} />;
  }

  // Step: CLIP RANGE (after playing)
  if (step === "clipRange" && selectedVideo) {
    return <ClipRangeDialog video={selectedVideo} onConfirm={handleClipConfirm} onCancel={() => { setSelectedVideo(null); setStep("browse"); }} />;
  }

  // Step: INSERT ANOTHER?
  if (step === "insertAnother") {
    return <InsertAnotherDialog clipCount={clips.length} onYes={() => setStep("browse")} onDone={() => setStep("review")} />;
  }

  // Step: REVIEW clips
  if (step === "review") {
    return (
      <ClipReviewPanel
        clips={clips}
        modules={modules}
        onUpdateClip={handleUpdateClip}
        onRemoveClip={handleRemoveClip}
        onFinish={() => { onComplete(clips); setStep("done"); }}
        onPreviewAll={() => setStep("preview")}
      />
    );
  }

  // Step: PREVIEW all clips
  if (step === "preview") {
    return <ClipPlayer clips={clips} onClose={() => setStep("review")} />;
  }

  // Step: BROWSE videos
  if (step === "browse") {
    const filteredMods = browseModule === "all" ? allModules : allModules.filter(m => m.module_title === browseModule);
    const q = searchQ.toLowerCase();

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-card rounded-2xl shadow-2xl w-[750px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-extrabold text-foreground flex items-center gap-2">
                <Film className="w-5 h-5 text-destructive" /> Browse YouTube Videos
              </h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">Click a video to play it, then select a clip range to insert</p>
            </div>
            {clips.length > 0 && (
              <button onClick={() => setStep("review")} className="h-9 px-4 rounded-lg text-[12px] font-bold text-white flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                Review {clips.length} Clip{clips.length > 1 ? "s" : ""} <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search + Filter */}
          <div className="px-6 pt-4 pb-2 space-y-2">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search videos..."
              className="w-full h-9 border border-border rounded-lg text-[12px] px-3 bg-card text-foreground focus:outline-none focus:border-primary"
            />
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setBrowseModule("all")} className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all ${browseModule === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-border"}`}>
                All
              </button>
              {allModules.map(m => (
                <button key={m.module_title} onClick={() => setBrowseModule(m.module_title)} className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all ${browseModule === m.module_title ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-border"}`}>
                  {m.module_title}
                </button>
              ))}
            </div>
          </div>

          {/* Videos grid */}
          <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4 mt-2">
            {filteredMods.map((mod, mi) => {
              const vids = q ? mod.videos.filter((v: any) => v.title?.toLowerCase().includes(q)) : mod.videos;
              if (vids.length === 0) return null;
              return (
                <div key={mi}>
                  <h4 className="text-[13px] font-bold text-foreground pl-3 border-l-[3px] border-primary mb-2">{mod.module_title}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {vids.map((video: any, vi: number) => {
                      const isAdded = clips.some(c => c.videoId === video.videoId);
                      return (
                        <div
                          key={vi}
                          onClick={() => !isAdded && handleSelectVideo(video)}
                          className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${isAdded ? "border-primary/40 opacity-60" : "border-border hover:border-primary/30"}`}
                        >
                          <div className="relative">
                            <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
                            {isAdded && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> Added</span>
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{parseDuration(video.duration)}</span>
                          </div>
                          <div className="p-2">
                            <h5 className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight">{video.title}</h5>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{video.channelTitle}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <button onClick={onSkip} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Skip Videos
            </button>
            {clips.length > 0 && (
              <button onClick={() => setStep("review")} className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                Review {clips.length} Clip{clips.length > 1 ? "s" : ""} <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
