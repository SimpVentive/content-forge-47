import React, { useState } from "react";
import { OutputData, RawAgentOutputs } from "@/types/agents";
import { FileText, BookOpen, ClipboardCheck, Package, Sparkles, Check, Clock, Layers, BarChart3, AlertTriangle, Download, Play, Youtube, Loader2 } from "lucide-react";
import { exportScormPackage } from "@/lib/scormExport";
import { toast } from "sonner";
import { VoicePreview } from "./VoicePreview";
import { SlidePreview } from "./SlidePreview";
import { InfographicPreview } from "./InfographicPreview";
import { LearnerPreview } from "./LearnerPreview";
import { VideosTab, InsertedVideo } from "./VideosTab";

interface OutputPanelProps {
  outputData: OutputData;
  rawOutputs: RawAgentOutputs;
  courseTitle: string;
  workflowClips?: any[];
  courseDuration?: string;
}

const tabs = [
  { key: "outline" as const, label: "Outline", icon: BookOpen },
  { key: "videos" as const, label: "Videos", icon: Youtube },
  { key: "script" as const, label: "Script", icon: FileText },
  { key: "assessment" as const, label: "Assessment", icon: ClipboardCheck },
  { key: "preview" as const, label: "Learner Preview", icon: Play },
  { key: "package" as const, label: "Package", icon: Package },
];

/* Try to parse JSON from a string that might have markdown fences */
function tryParseJSON(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { return null; }
    }
    return null;
  }
}

/* ─── Assessment Renderer ─── */
const AssessmentView: React.FC<{ raw: string }> = ({ raw }) => {
  const data = tryParseJSON(raw);
  if (!data) return <pre className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{raw}</pre>;

  return (
    <div className="space-y-6 animate-fade-in">
      {data.mcq && (
        <div>
          <h3 className="text-[16px] font-bold text-foreground mb-3 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Multiple Choice Questions
          </h3>
          <div className="space-y-4">
            {data.mcq.map((q: any, i: number) => (
              <div key={i} className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-[14px] font-semibold text-foreground">{i + 1}. {q.question}</p>
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">{q.blooms_level}</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(q.options || []).map((opt: string, j: number) => {
                    const letter = String.fromCharCode(65 + j);
                    const isCorrect = opt === q.correct_answer || letter === q.correct_answer || q.correct_answer?.includes(opt);
                    return (
                      <div key={j} className={`text-[13px] px-3 py-1.5 rounded-lg ${isCorrect ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200" : "text-foreground/70"}`}>
                        {letter}. {opt}
                        {isCorrect && <Check className="w-3 h-3 inline ml-1.5" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.scenarios && (
        <div>
          <h3 className="text-[16px] font-bold text-foreground mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Scenario-Based Questions
          </h3>
          <div className="space-y-4">
            {data.scenarios.map((s: any, i: number) => (
              <div key={i} className="bg-secondary/50 rounded-xl p-4">
                <p className="text-[14px] font-semibold text-foreground mb-3">{s.situation}</p>
                <div className="space-y-1.5">
                  {(s.options || []).map((opt: string, j: number) => {
                    const isCorrect = opt === s.best_response;
                    return (
                      <div key={j} className={`text-[13px] px-3 py-2 rounded-lg cursor-pointer transition-all ${isCorrect ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200" : "bg-card hover:bg-border/50 text-foreground/80"}`}>
                        {opt}
                        {isCorrect && <Check className="w-3 h-3 inline ml-1.5" />}
                      </div>
                    );
                  })}
                </div>
                {s.rationale && (
                  <p className="text-[12px] text-muted-foreground mt-2 italic">💡 {s.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.reflection && (
        <div>
          <h3 className="text-[16px] font-bold text-foreground mb-3">Reflection Exercise</h3>
          <div className="bg-secondary/50 rounded-xl p-4">
            <p className="text-[14px] font-semibold text-foreground mb-2">{data.reflection.prompt}</p>
            {data.reflection.guidance && (
              <p className="text-[12px] text-muted-foreground mb-3">Guidance: {data.reflection.guidance}</p>
            )}
            <textarea
              className="w-full border-[1.5px] border-border rounded-xl px-3 py-2.5 text-[13px] bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              rows={4}
              placeholder="Write your reflection here..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Package Renderer ─── */
const PackageView: React.FC<{ raw: string; archRaw: string; visualRaw: string; courseTitle: string; rawOutputs: RawAgentOutputs; insertedVideos: InsertedVideo[]; courseDuration?: string }> = ({ raw, archRaw, visualRaw, courseTitle, rawOutputs, insertedVideos, courseDuration }) => {
  const data = tryParseJSON(raw);
  const meta = data?.metadata || {};
  const [checklist, setChecklist] = useState<boolean[]>(
    new Array((data?.deployment_checklist || []).length).fill(false)
  );
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!data) return <pre className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{raw}</pre>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Learner Preview Modal */}
      {showLearnerPreview && (
        <LearnerPreview
          courseTitle={courseTitle}
          rawOutputs={rawOutputs}
          onClose={() => setShowLearnerPreview(false)}
          insertedVideos={insertedVideos}
          courseDuration={courseDuration}
        />
      )}

      {/* 1. Slide Preview */}
      {archRaw && visualRaw && (
        <SlidePreview archRaw={archRaw} visualRaw={visualRaw} courseTitle={courseTitle} />
      )}

      {/* 2. Metadata */}
      <div>
        <h3 className="text-[18px] font-extrabold text-foreground mb-4">{meta.title || "Course Package"}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Modules", value: meta.total_modules || meta.modules || "—", icon: Layers },
            { label: "Topics", value: meta.total_topics || meta.topics || "—", icon: BarChart3 },
            { label: "Duration", value: meta.estimated_completion_time || meta.duration || "—", icon: Clock },
            { label: "Difficulty", value: meta.difficulty_level || meta.difficulty || "—", icon: AlertTriangle },
          ].map((stat) => (
            <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 text-center">
              <stat.icon className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-[18px] font-extrabold text-foreground">{stat.value}</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SCORM Manifest */}
      {data.scorm_manifest?.assets && (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">SCORM Manifest</h3>
          <div className="bg-secondary/50 rounded-xl p-3 space-y-1">
            {data.scorm_manifest.assets.map((asset: string | { name?: string; type?: string }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[13px] text-foreground/80">
                <span className="text-primary">📄</span>
                {typeof asset === "string" ? asset : asset.name || JSON.stringify(asset)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Deployment Checklist */}
      {data.deployment_checklist && (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">Deployment Checklist</h3>
          <div className="space-y-1.5">
            {data.deployment_checklist.map((item: string | { step?: string }, i: number) => (
              <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                <button
                  onClick={() => setChecklist(prev => { const next = [...prev]; next[i] = !next[i]; return next; })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    checklist[i] ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                  }`}
                >
                  {checklist[i] && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className={`text-[13px] ${checklist[i] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {typeof item === "string" ? item : item.step || JSON.stringify(item)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 5. QA Summary */}
      {data.qa_summary && (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">QA Summary</h3>
          <div className="space-y-1">
            {(data.qa_summary.agents_completed || []).map((agent: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[13px]">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-foreground">{agent}</span>
              </div>
            ))}
            {(data.qa_summary.gaps || []).length > 0 && (
              <div className="mt-2">
                {data.qa_summary.gaps.map((gap: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {gap}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Action Buttons — Preview + Export */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowLearnerPreview(true)}
          className="flex-1 h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 border-2 border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5]/5 transition-all"
        >
          <Play className="w-4 h-4" />
          Preview as Learner
        </button>
        <button
          onClick={async () => {
            setExporting(true);
            try {
              await exportScormPackage(courseTitle, rawOutputs);
              toast.success("SCORM package exported successfully!");
            } catch (err: any) {
              toast.error(err?.message || "Export failed");
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="flex-1 h-12 rounded-xl text-[15px] font-bold text-primary-foreground flex items-center justify-center gap-2 bg-primary hover:brightness-110 transition-all disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Exporting…" : "Export SCORM Package"}
        </button>
      </div>
    </div>
  );
};

/* ─── Script Renderer (highlights narration cues + voice preview) ─── */
const ScriptView: React.FC<{ raw: string; voiceRaw: string }> = ({ raw, voiceRaw }) => {
  const parts = raw.split(/(\[(?:PAUSE[^]]*?|EMPHASIZE|SLOW DOWN|SPEED UP|WHISPER|EXCITED)\])/gi);
  return (
    <div className="animate-fade-in space-y-0">
      {/* Voice Preview (at top if voice data available) */}
      {voiceRaw && <VoicePreview voiceRaw={voiceRaw} />}

      {/* Script text with SSML cue highlights */}
      <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7] mt-4">
        {parts.map((part, i) =>
          /^\[(?:PAUSE|EMPHASIZE|SLOW DOWN|SPEED UP|WHISPER|EXCITED)/i.test(part) ? (
            <span key={i} className="text-primary font-bold bg-primary/10 px-1 rounded">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  );
};

/* ─── Outline Renderer with Infographics ─── */
const OutlineView: React.FC<{ raw: string; archRaw: string; visualRaw: string }> = ({ raw, archRaw, visualRaw }) => {
  // Split outline into sections
  const sections = raw.split(/\n---\n/);
  const courseStructureIdx = sections.findIndex(s => s.includes("## Course Structure"));
  const visualDesignIdx = sections.findIndex(s => s.includes("## Visual Design Plan"));
  const complianceIdx = sections.findIndex(s => s.includes("## Compliance Report"));

  return (
    <div className="animate-fade-in space-y-4">
      {/* 1. Course structure sections (Research + Course Structure) */}
      {sections.filter((_, i) => i <= Math.max(courseStructureIdx, 0)).map((section, i) => (
        <div key={i} className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{section.trim()}</div>
      ))}

      {/* 2. Visual Assets — Infographic Gallery */}
      {archRaw && visualRaw && (
        <InfographicPreview archRaw={archRaw} visualRaw={visualRaw} />
      )}

      {/* 3. Visual Design Plan */}
      {visualDesignIdx >= 0 && (
        <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">
          {sections[visualDesignIdx].trim()}
        </div>
      )}

      {/* 4. Compliance Report */}
      {complianceIdx >= 0 && (
        <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">
          {sections[complianceIdx].trim()}
        </div>
      )}

      {/* Remaining sections not yet categorized */}
      {sections.filter((s, i) =>
        i > Math.max(courseStructureIdx, 0) &&
        i !== visualDesignIdx &&
        i !== complianceIdx
      ).map((section, i) => (
        <div key={`rest-${i}`} className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{section.trim()}</div>
      ))}
    </div>
  );
};

export const OutputPanel: React.FC<OutputPanelProps> = ({ outputData, rawOutputs, courseTitle, workflowClips = [], courseDuration }) => {
  const [activeTab, setActiveTab] = useState<string>("script");
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [insertedVideos, setInsertedVideos] = useState<InsertedVideo[]>([]);
  const hasOutput = Object.values(rawOutputs).some(v => v);
  const content = (activeTab === "preview" || activeTab === "videos") ? null : outputData[activeTab as keyof OutputData];

  // Convert workflow clips to InsertedVideo format
  const allInsertedVideos: InsertedVideo[] = React.useMemo(() => {
    const fromWorkflow: InsertedVideo[] = workflowClips.map(c => ({
      videoId: c.videoId,
      title: c.title,
      channelTitle: c.channelTitle,
      thumbnail: c.thumbnail,
      duration: c.duration,
      startTime: c.startTime || "",
      endTime: c.endTime || "",
      customName: c.customName || c.title,
      moduleTitle: c.insertAfterModule || "",
      afterSlide: -1,
    }));
    // Merge: workflow clips + manually inserted from Videos tab (avoid duplicates)
    const ids = new Set(fromWorkflow.map(v => v.videoId));
    const extra = insertedVideos.filter(v => !ids.has(v.videoId));
    return [...fromWorkflow, ...extra];
  }, [workflowClips, insertedVideos]);

  const handleInsertVideo = (video: InsertedVideo) => {
    setInsertedVideos(prev => {
      if (prev.find(v => v.videoId === video.videoId)) return prev;
      return [...prev, video];
    });
  };

  const handleRemoveVideo = (videoId: string) => {
    setInsertedVideos(prev => prev.filter(v => v.videoId !== videoId));
  };

  const renderContent = () => {
    if (activeTab === "preview") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Play className="w-10 h-10 text-primary/30 mb-3" />
          <p className="text-[14px] font-semibold text-muted-foreground">Learner Preview opened in full screen</p>
        </div>
      );
    }

    if (activeTab === "videos") {
      return (
        <VideosTab
          raw={rawOutputs.youtube}
          insertedVideos={insertedVideos}
          onInsert={handleInsertVideo}
          onRemove={handleRemoveVideo}
        />
      );
    }

    if (!content) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-[14px] font-semibold text-muted-foreground">Run the pipeline to see output</p>
        </div>
      );
    }

    switch (activeTab) {
      case "assessment":
        return <AssessmentView raw={content} />;
      case "package":
        return <PackageView raw={content} archRaw={rawOutputs.architect} visualRaw={rawOutputs.visual} courseTitle={courseTitle} rawOutputs={rawOutputs} insertedVideos={allInsertedVideos} courseDuration={courseDuration} />;
      case "script":
        return <ScriptView raw={content} voiceRaw={rawOutputs.voice} />;
      case "outline":
        return <OutlineView raw={content} archRaw={rawOutputs.architect} visualRaw={rawOutputs.visual} />;
      default:
        return (
          <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7] animate-fade-in">
            {content}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Learner Preview Modal */}
      {showLearnerPreview && (
        <LearnerPreview
          courseTitle={courseTitle}
          rawOutputs={rawOutputs}
          onClose={() => setShowLearnerPreview(false)}
          insertedVideos={allInsertedVideos}
          courseDuration={courseDuration}
        />
      )}

      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-[20px] font-extrabold text-foreground">Course Output</h2>
          </div>
          {hasOutput && (
            <button
              onClick={() => setShowLearnerPreview(true)}
              className="h-8 px-3 rounded-lg text-[12px] font-bold flex items-center gap-1.5 border-2 border-primary text-primary hover:bg-primary/5 transition-all"
            >
              <Play className="w-3 h-3" />
              Preview
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map((tab) => {
            const isPreview = tab.key === "preview";
            const disabled = isPreview && !hasOutput;
            return (
              <button
                key={tab.key}
                disabled={disabled}
                onClick={() => {
                  if (isPreview && hasOutput) {
                    setShowLearnerPreview(true);
                  } else if (!isPreview) {
                    setActiveTab(tab.key);
                  }
                }}
                className={`h-8 px-3 rounded-lg text-[12px] font-bold flex items-center gap-1 transition-all duration-[180ms] ${
                  disabled
                    ? "bg-secondary/50 text-muted-foreground/40 cursor-not-allowed"
                    : isPreview
                      ? "bg-accent text-primary hover:bg-primary/10 border border-primary/30"
                      : activeTab === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-border"
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {renderContent()}
      </div>
    </div>
  );
};
