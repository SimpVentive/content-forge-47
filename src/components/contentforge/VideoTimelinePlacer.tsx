import React, { useState, useCallback } from "react";
import { Film, AlertTriangle, Check, GripVertical, X, Clock, ChevronRight } from "lucide-react";

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

interface ModuleBlock {
  title: string;
  sections: string[];
}

interface VideoTimelinePlacerProps {
  clips: ClipItem[];
  modules: ModuleBlock[];
  courseDuration: string; // e.g. "5min", "10min"
  onUpdateClip: (id: string, updates: Partial<ClipItem>) => void;
  onRemoveClip: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
}

/* helpers */
function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return 0;
}

function durationToSeconds(iso: string): number {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || "0") * 3600 + parseInt(m[2] || "0") * 60 + parseInt(m[3] || "0");
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseDurationMinutes(dur: string): number {
  const n = parseInt(dur, 10);
  return isNaN(n) ? 15 : n;
}

function getClipDurationSec(clip: ClipItem): number {
  const startSec = clip.startTime ? timeToSeconds(clip.startTime) : 0;
  const endSec = clip.endTime ? timeToSeconds(clip.endTime) : durationToSeconds(clip.duration);
  return Math.max(0, endSec - startSec);
}

export const VideoTimelinePlacer: React.FC<VideoTimelinePlacerProps> = ({
  clips, modules, courseDuration, onUpdateClip, onRemoveClip, onFinish, onBack,
}) => {
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [durationWarnings, setDurationWarnings] = useState<string[]>([]);

  const courseMinutes = parseDurationMinutes(courseDuration);
  const courseSec = courseMinutes * 60;

  // Total video time inserted
  const totalVideoSec = clips.reduce((acc, c) => acc + getClipDurationSec(c), 0);

  // Check for duration warnings
  const warnings: { clipId: string; message: string }[] = [];
  clips.forEach(clip => {
    const clipSec = getClipDurationSec(clip);
    if (clipSec > courseSec) {
      warnings.push({
        clipId: clip.id,
        message: `"${clip.customName}" is ${formatSec(clipSec)} long but the course is only ${courseMinutes} min. This video exceeds the entire course duration!`,
      });
    } else if (clipSec > courseSec * 0.5) {
      warnings.push({
        clipId: clip.id,
        message: `"${clip.customName}" (${formatSec(clipSec)}) takes over half of the ${courseMinutes}-min course. Consider trimming.`,
      });
    }
  });

  if (totalVideoSec > courseSec) {
    warnings.push({
      clipId: "__total__",
      message: `Total video content (${formatSec(totalVideoSec)}) exceeds the ${courseMinutes}-min course duration. Remove or trim some clips.`,
    });
  }

  // Unassigned clips
  const unassigned = clips.filter(c => !c.insertAfterModule);
  const assigned = clips.filter(c => c.insertAfterModule);

  const handleDrop = useCallback((moduleTitle: string) => {
    if (dragClipId) {
      onUpdateClip(dragClipId, { insertAfterModule: moduleTitle });
      setDragClipId(null);
      setHoveredModule(null);
    }
  }, [dragClipId, onUpdateClip]);

  const handleUnassign = useCallback((clipId: string) => {
    onUpdateClip(clipId, { insertAfterModule: "" });
  }, [onUpdateClip]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card rounded-2xl shadow-2xl w-[860px] max-w-[95vw] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-[20px] font-extrabold text-foreground flex items-center gap-2">
            <Film className="w-5 h-5 text-destructive" />
            Place Videos in Course Timeline
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Drag video clips to a module, or click a module's drop zone. Course duration: <strong>{courseMinutes} min</strong>
          </p>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="px-6 pt-4 space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Unassigned clips */}
          {unassigned.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Unassigned Clips — drag to a module below
              </p>
              <div className="flex gap-2 flex-wrap">
                {unassigned.map(clip => {
                  const clipSec = getClipDurationSec(clip);
                  const isOverDuration = clipSec > courseSec;
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={() => setDragClipId(clip.id)}
                      onDragEnd={() => { setDragClipId(null); setHoveredModule(null); }}
                      className={`flex items-center gap-2 bg-secondary/80 rounded-xl p-2 pr-3 cursor-grab active:cursor-grabbing border-2 transition-all ${
                        isOverDuration ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-primary/30"
                      }`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <img src={clip.thumbnail} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate max-w-[160px]">{clip.customName}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatSec(clipSec)}
                          {isOverDuration && <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
                        </p>
                      </div>
                      <button onClick={() => onRemoveClip(clip.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Course Timeline
            </p>

            {/* Module blocks in horizontal timeline */}
            <div className="space-y-3">
              {modules.map((mod, mi) => {
                const modClips = assigned.filter(c => c.insertAfterModule === mod.title);
                const isHovered = hoveredModule === mod.title;
                const modVideoSec = modClips.reduce((a, c) => a + getClipDurationSec(c), 0);

                return (
                  <div
                    key={mi}
                    onDragOver={e => { e.preventDefault(); setHoveredModule(mod.title); }}
                    onDragLeave={() => setHoveredModule(null)}
                    onDrop={() => handleDrop(mod.title)}
                    className={`rounded-xl border-2 transition-all ${
                      isHovered
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-border bg-secondary/30"
                    }`}
                  >
                    {/* Module header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold text-white"
                          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                          {mi + 1}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-foreground">{mod.title}</p>
                          <p className="text-[11px] text-muted-foreground">{mod.sections.length} section{mod.sections.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      {modVideoSec > 0 && (
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Film className="w-3 h-3" /> {formatSec(modVideoSec)} video
                        </span>
                      )}
                    </div>

                    {/* Sections as horizontal flow */}
                    <div className="px-4 pb-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {mod.sections.map((sec, si) => (
                          <React.Fragment key={si}>
                            <div className="h-7 px-3 rounded-lg bg-card border border-border text-[11px] font-semibold text-foreground flex items-center">
                              {sec.length > 30 ? sec.slice(0, 30) + "…" : sec}
                            </div>
                            {si < mod.sections.length - 1 && (
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Assigned clips */}
                    {modClips.length > 0 && (
                      <div className="px-4 pb-3 space-y-1.5">
                        {modClips.map(clip => {
                          const clipSec = getClipDurationSec(clip);
                          const isOverDuration = clipSec > courseSec;
                          return (
                            <div key={clip.id} className={`flex items-center gap-2 rounded-lg p-2 border ${isOverDuration ? "border-amber-300 bg-amber-50" : "border-primary/20 bg-primary/5"}`}>
                              <img src={clip.thumbnail} alt="" className="w-14 h-9 rounded object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-foreground truncate">{clip.customName}</p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" /> {formatSec(clipSec)} · {clip.channelTitle}
                                </p>
                              </div>
                              <button
                                onClick={() => handleUnassign(clip.id)}
                                className="text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              >
                                Unassign
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty drop zone */}
                    {modClips.length === 0 && (
                      <div className={`mx-4 mb-3 h-12 rounded-lg border-2 border-dashed flex items-center justify-center text-[12px] transition-all ${
                        isHovered
                          ? "border-primary text-primary bg-primary/5"
                          : "border-border text-muted-foreground"
                      }`}>
                        {isHovered ? "Drop video here" : "Drag a video clip here"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total summary */}
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-4 mt-2">
            <div>
              <p className="text-[13px] font-bold text-foreground">
                {assigned.length} of {clips.length} clips placed
              </p>
              <p className="text-[11px] text-muted-foreground">
                Total video: {formatSec(totalVideoSec)} / Course: {courseMinutes} min
              </p>
            </div>
            <div className={`text-[13px] font-bold px-3 py-1 rounded-full ${
              totalVideoSec > courseSec
                ? "bg-amber-100 text-amber-700"
                : totalVideoSec > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-secondary text-muted-foreground"
            }`}>
              {totalVideoSec > courseSec
                ? `⚠ ${formatSec(totalVideoSec - courseSec)} over limit`
                : totalVideoSec > 0
                ? `✓ ${formatSec(courseSec - totalVideoSec)} remaining`
                : "No videos placed"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={onBack}
            className="h-10 px-5 rounded-xl text-[13px] font-bold text-foreground border border-border hover:bg-secondary transition-all"
          >
            ← Back to Browse
          </button>
          <button
            onClick={() => {
              if (warnings.some(w => w.clipId === "__total__" || clips.some(c => c.id === w.clipId && getClipDurationSec(c) > courseSec))) {
                if (!confirm("Some videos exceed the course duration. Are you sure you want to continue?")) return;
              }
              onFinish();
            }}
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
