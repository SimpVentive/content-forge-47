import React, { useState } from "react";
import { OutputData, RawAgentOutputs } from "@/types/agents";
import { FileText, BookOpen, ClipboardCheck, Package, Sparkles, Check, Clock, Layers, BarChart3, AlertTriangle, Download, Play, Youtube, Loader2, AlertCircle, Info } from "lucide-react";
import { exportScormPackage } from "@/lib/scormExport";
import { validateCourse, type QAReport } from "@/lib/qaValidator";
import { generateFlipbookHTML } from "@/lib/flipbookGenerator";
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
  avatarTrainerId?: string;
  isRunning?: boolean;
  slideLayout?: {
    maxLines: number;
    minFontSize: number;
    lineSpacing: number;
  };
  learnerNotesEnabled?: boolean;
  resourcesPanelEnabled?: boolean;
  glossaryEnabled?: boolean;
  discussionEnabled?: boolean;
  assessmentIntensity?: "light" | "standard" | "deep";
  flipStylePreference?: "dramatic" | "subtle" | "bound";
  textLanguage?: string;
  narratorLanguage?: string;
  onUpdateVisualTopic?: (moduleTitle: string, topicTitle: string, updates: Record<string, unknown>) => void;
  onUpdateCourseContent?: (section: "outline" | "script" | "assessment" | "package", value: string) => void;
  onOpenLearnerPreview?: () => void;
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

function exportFlipbookHTML(courseTitle: string, rawOutputs: RawAgentOutputs) {
  let html = rawOutputs.flipbookHTML;
  if (!html) {
    const narratives = tryParseJSON(rawOutputs.narrativeScenes || "");
    if (!Array.isArray(narratives) || narratives.length === 0) {
      throw new Error("No flipbook scenes found. Regenerate with Image Course selected.");
    }
    html = generateFlipbookHTML(narratives, courseTitle, "smooth-slide");
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50) || "course"}_Flipbook.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* Assessment Renderer */
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
                  <p className="text-[12px] text-muted-foreground mt-2 italic">Tip: {s.rationale}</p>
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

/* Package Renderer */
const PackageView: React.FC<{ raw: string; archRaw: string; visualRaw: string; courseTitle: string; rawOutputs: RawAgentOutputs; insertedVideos: InsertedVideo[]; courseDuration?: string; avatarTrainerId?: string; slideLayout?: { maxLines: number; minFontSize: number; lineSpacing: number }; learnerNotesEnabled?: boolean; resourcesPanelEnabled?: boolean; glossaryEnabled?: boolean; discussionEnabled?: boolean; assessmentIntensity?: "light" | "standard" | "deep"; flipStylePreference?: "dramatic" | "subtle" | "bound"; textLanguage?: string; narratorLanguage?: string; onUpdateVisualTopic?: (moduleTitle: string, topicTitle: string, updates: Record<string, unknown>) => void }> = ({ raw, archRaw, visualRaw, courseTitle, rawOutputs, insertedVideos, courseDuration, avatarTrainerId, slideLayout, learnerNotesEnabled, resourcesPanelEnabled, glossaryEnabled, discussionEnabled, assessmentIntensity, flipStylePreference, textLanguage, narratorLanguage, onUpdateVisualTopic }) => {
  const data = tryParseJSON(raw);
  const meta = data?.metadata || {};
  const [checklist, setChecklist] = useState<boolean[]>(
    new Array((data?.deployment_checklist || []).length).fill(false)
  );
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!data) return <pre className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{raw}</pre>;

  const isFlipbook = !!data?.flipbook_assets;
  const checklistComplete = checklist.filter(Boolean).length === checklist.length;
  const [qaReport, setQaReport] = useState<QAReport | null>(null);
  const [approvedByAdmin, setApprovedByAdmin] = useState(false);

  React.useEffect(() => {
    const runQA = async () => {
      if (raw && archRaw && visualRaw) {
        try {
          const report = await validateCourse(raw, data?.metadata || {}, data?.flipbook_assets?.images || []);
          setQaReport(report);
        } catch (err) {
          console.error("QA validation error:", err);
        }
      }
    };
    runQA();
  }, [raw, archRaw, visualRaw]);

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
          avatarTrainerId={avatarTrainerId}
          slideLayout={slideLayout}
          learnerNotesEnabled={learnerNotesEnabled}
          resourcesPanelEnabled={resourcesPanelEnabled}
          glossaryEnabled={glossaryEnabled}
          discussionEnabled={discussionEnabled}
          assessmentIntensity={assessmentIntensity}
          flipStylePreference={flipStylePreference}
          textLanguage={textLanguage}
          narratorLanguage={narratorLanguage}
          onUpdateVisualTopic={onUpdateVisualTopic}
        />
      )}

      {/* QA REPORT */}
      {qaReport && (
        <div className={`border-2 rounded-2xl p-6 ${
          qaReport.passed
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-300"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              {qaReport.passed ? (
                <Check className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <h3 className={`text-[16px] font-bold ${qaReport.passed ? "text-emerald-900" : "text-amber-900"}`}>
                  Quality Score: {qaReport.score}/100
                </h3>
                <p className={`text-[13px] ${qaReport.passed ? "text-emerald-800" : "text-amber-800"}`}>
                  {qaReport.summary}
                </p>
              </div>
            </div>
          </div>

          {qaReport.issues.length > 0 && (
            <div className="space-y-2 mb-4">
              {qaReport.issues.slice(0, 5).map((issue, i) => (
                <div key={i} className={`text-[12px] p-3 rounded-lg ${
                  issue.type === "error"
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : issue.type === "warning"
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}>
                  <div className="font-semibold flex items-center gap-2">
                    {issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️"}
                    [{issue.section.toUpperCase()}] {issue.message}
                  </div>
                  {issue.details && <div className="text-[11px] mt-1 opacity-80">{issue.details}</div>}
                </div>
              ))}
              {qaReport.issues.length > 5 && (
                <div className="text-[12px] text-gray-600 italic">
                  + {qaReport.issues.length - 5} more issue(s)
                </div>
              )}
            </div>
          )}

          {qaReport.recommendations.length > 0 && (
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-[12px] font-semibold mb-2">Recommendations:</p>
              <ul className="text-[12px] space-y-1">
                {qaReport.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!qaReport.passed && (
            <div className="mt-4 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approvedByAdmin}
                  onChange={(e) => setApprovedByAdmin(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-[13px] font-semibold text-amber-900">
                  I have reviewed these issues and approve export anyway
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* STATUS BANNER */}
      <div className={`border-2 rounded-2xl p-6 ${
        qaReport?.passed || approvedByAdmin
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200"
          : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300"
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${qaReport?.passed || approvedByAdmin ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
              <h2 className={`text-[20px] font-bold ${qaReport?.passed || approvedByAdmin ? "text-emerald-900" : "text-amber-900"}`}>
                {qaReport?.passed || approvedByAdmin ? "✓ Ready to Export!" : "⚠ Review Required Before Export"}
              </h2>
            </div>
            <p className={`text-[14px] ${qaReport?.passed || approvedByAdmin ? "text-emerald-800" : "text-amber-800"}`}>
              Your {isFlipbook ? "flipbook" : "course"} package {qaReport?.passed || approvedByAdmin ? "is complete and ready to download." : "has quality issues - please review or approve to continue."}
            </p>
          </div>
          <div className="text-[28px]">{qaReport?.passed || approvedByAdmin ? "📦" : "🔍"}</div>
        </div>
      </div>

      {/* 1. Slide Preview */}
      {archRaw && visualRaw && (
        <SlidePreview archRaw={archRaw} visualRaw={visualRaw} courseTitle={courseTitle} />
      )}

      {/* 2. Metadata */}
      <div>
        <h3 className="text-[18px] font-extrabold text-foreground mb-4">
          {meta.title || (isFlipbook ? "Flipbook Package" : "Course Package")}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Modules", value: meta.total_modules || meta.modules || "-", icon: Layers },
            { label: "Topics", value: meta.total_topics || meta.topics || "-", icon: BarChart3 },
            { label: "Duration", value: meta.estimated_completion_time || meta.duration || "-", icon: Clock },
            { label: "Difficulty", value: meta.difficulty_level || meta.difficulty || "-", icon: AlertTriangle },
          ].map((stat) => (
            <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 text-center">
              <stat.icon className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-[18px] font-extrabold text-foreground">{stat.value}</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Flipbook Assets OR SCORM Manifest */}
      {data.flipbook_assets ? (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">Flipbook Assets</h3>
          <div className="bg-secondary/50 rounded-xl p-3 space-y-3">
            {data.flipbook_assets.images && data.flipbook_assets.images.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-foreground/70 mb-1">Images</p>
                <div className="space-y-0.5">
                  {data.flipbook_assets.images.map((img: string, i: number) => (
                    <div key={i} className="text-[12px] text-foreground/80 pl-2">• {img}</div>
                  ))}
                </div>
              </div>
            )}
            {data.flipbook_assets.audio_files && data.flipbook_assets.audio_files.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-foreground/70 mb-1">Audio Files</p>
                <div className="space-y-0.5">
                  {data.flipbook_assets.audio_files.map((audio: string, i: number) => (
                    <div key={i} className="text-[12px] text-foreground/80 pl-2">🔊 {audio}</div>
                  ))}
                </div>
              </div>
            )}
            {data.flipbook_assets.interactive_elements && data.flipbook_assets.interactive_elements.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-foreground/70 mb-1">Interactive Elements</p>
                <div className="space-y-0.5">
                  {data.flipbook_assets.interactive_elements.map((elem: string, i: number) => (
                    <div key={i} className="text-[12px] text-foreground/80 pl-2">⚡ {elem}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : data.scorm_manifest?.assets ? (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">SCORM Manifest</h3>
          <div className="bg-secondary/50 rounded-xl p-3 space-y-1">
            {data.scorm_manifest.assets.map((asset: string | { name?: string; type?: string }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[13px] text-foreground/80">
                <span className="text-primary">File</span>
                {typeof asset === "string" ? asset : asset.name || JSON.stringify(asset)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

      {/* DEPLOYMENT CHECKLIST PROGRESS */}
      {data.deployment_checklist && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-[13px] font-semibold text-blue-900 mb-2">Pre-Export Checklist</p>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(checklist.filter(Boolean).length / checklist.length) * 100}%` }}
            />
          </div>
          <p className="text-[12px] text-blue-800 mt-2">
            {checklist.filter(Boolean).length} of {checklist.length} items completed
          </p>
        </div>
      )}

      {/* 6. ACTION BUTTONS - BIG AND PROMINENT */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowLearnerPreview(true)}
            className="h-14 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 border-2 border-blue-500 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
          >
            <Play className="w-5 h-5" />
            Preview Course
          </button>
          <button
            onClick={async () => {
              if (qaReport && !qaReport.passed && !approvedByAdmin) {
                toast.error("Please address QA issues or approve to continue");
                return;
              }
              setExporting(true);
              try {
                const hasVoice = !!rawOutputs.voice;
                await exportScormPackage(courseTitle, rawOutputs, {
                  includeVoice: hasVoice,
                  onProgress: (msg) => toast.info(msg, { duration: 3000 }),
                });
                toast.success(hasVoice
                  ? "SCORM package with voice narration exported!"
                  : "SCORM package exported successfully!");
              } catch (err: any) {
                toast.error(err?.message || "Export failed");
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting || (qaReport && !qaReport.passed && !approvedByAdmin)}
            className="h-14 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {exporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {isFlipbook ? "Export Flipbook" : "Export Package"}
              </>
            )}
          </button>
        </div>

        {/* NEXT STEPS */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[13px] font-bold text-amber-900 mb-2">📋 Next Steps:</p>
          <ol className="text-[12px] text-amber-800 space-y-1 list-decimal list-inside">
            <li>Review the deployment checklist above</li>
            <li>Click "{isFlipbook ? "Export Flipbook" : "Export Package"}" to download</li>
            <li>{isFlipbook ? "Upload the HTML to your LMS or web server" : "Import SCORM package to your LMS"}</li>
            <li>Test with learners and gather feedback</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

/* Script Renderer (highlights narration cues + voice preview) */
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

/* Outline Renderer with Infographics */
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

      {/* 2. Visual Assets - Infographic Gallery */}
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

export const OutputPanel: React.FC<OutputPanelProps> = ({ outputData, rawOutputs, courseTitle, workflowClips = [], courseDuration, avatarTrainerId, isRunning, slideLayout, learnerNotesEnabled, resourcesPanelEnabled, glossaryEnabled, discussionEnabled, assessmentIntensity, flipStylePreference, textLanguage, narratorLanguage, onUpdateVisualTopic, onUpdateCourseContent, onOpenLearnerPreview }) => {
  const [activeTab, setActiveTab] = useState<string>("script");
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [showPostPreviewDialog, setShowPostPreviewDialog] = useState(false);
  const [insertedVideos, setInsertedVideos] = useState<InsertedVideo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showScriptConfirm, setShowScriptConfirm] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [scriptDialogEditing, setScriptDialogEditing] = useState(false);
  const [scriptDialogDraft, setScriptDialogDraft] = useState("");
  const prevIsRunningRef = React.useRef<boolean>(Boolean(isRunning));
  const hasOutput = Object.values(rawOutputs).some(v => v);
  const content = (activeTab === "preview" || activeTab === "videos") ? null : outputData[activeTab as keyof OutputData];
  const canEditTab = activeTab === "outline" || activeTab === "script" || activeTab === "assessment" || activeTab === "package";

  React.useEffect(() => {
    setIsEditing(false);
    setEditValue(content || "");
  }, [activeTab, content]);

  React.useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = Boolean(isRunning);
    if (wasRunning && !isRunning && (outputData.script || "").trim().length > 0) {
      setShowScriptConfirm(true);
    }
  }, [isRunning, outputData.script]);

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
      if (prev.find(v => v.videoId === video.videoId)) {
        toast.info("Video already inserted");
        return prev;
      }
      toast.success(`"${video.title}" inserted into course`);
      return [...prev, video];
    });
  };

  const handleRemoveVideo = (videoId: string) => {
    setInsertedVideos(prev => {
      const video = prev.find(v => v.videoId === videoId);
      if (video) toast("Video removed from course");
      return prev.filter(v => v.videoId !== videoId);
    });
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
      if (activeTab === "package") {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-[16px] font-extrabold text-foreground mb-2">Package Not Ready Yet</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[320px]">
              You haven't inserted videos into your course yet. Once you complete the video placement, you can generate and export the SCORM package.
            </p>
            <div className="mt-4 flex flex-col gap-2 items-center">
              <span className="text-[11px] text-muted-foreground">Steps to complete:</span>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</span>
                Run the pipeline
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</span>
                Insert or place videos
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">3</span>
                Export SCORM package
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-[14px] font-semibold text-muted-foreground">Run the pipeline to see output</p>
        </div>
      );
    }

    if (isEditing && canEditTab) {
      return (
        <div className="space-y-3">
          <textarea
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            className="min-h-[360px] w-full rounded-xl border border-border bg-background px-4 py-3 text-[13px] leading-[1.7] text-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (canEditTab && onUpdateCourseContent) {
                  onUpdateCourseContent(activeTab as "outline" | "script" | "assessment" | "package", editValue);
                }
                setIsEditing(false);
              }}
              className="h-9 rounded-lg bg-primary px-4 text-[12px] font-bold text-primary-foreground"
              type="button"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditValue(content || "");
                setIsEditing(false);
              }}
              className="h-9 rounded-lg border border-border px-4 text-[12px] font-bold text-foreground"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "assessment":
        return <AssessmentView raw={content} />;
      case "package":
        return <PackageView raw={content} archRaw={rawOutputs.architect} visualRaw={rawOutputs.visual} courseTitle={courseTitle} rawOutputs={rawOutputs} insertedVideos={allInsertedVideos} courseDuration={courseDuration} avatarTrainerId={avatarTrainerId} slideLayout={slideLayout} learnerNotesEnabled={learnerNotesEnabled} resourcesPanelEnabled={resourcesPanelEnabled} glossaryEnabled={glossaryEnabled} discussionEnabled={discussionEnabled} assessmentIntensity={assessmentIntensity} flipStylePreference={flipStylePreference} textLanguage={textLanguage} narratorLanguage={narratorLanguage} onUpdateVisualTopic={onUpdateVisualTopic} />;
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

  const scriptContent = outputData.script || "";

  const openScriptDialog = () => {
    setScriptDialogDraft(scriptContent);
    setScriptDialogEditing(false);
    setShowScriptDialog(true);
  };

  const handleScriptDialogSave = () => {
    if (onUpdateCourseContent) {
      onUpdateCourseContent("script", scriptDialogDraft);
    }
    setScriptDialogEditing(false);
    setShowScriptDialog(false);
    toast.success("Script saved");
    // Auto-open Learner Preview after script approval
    setTimeout(() => onOpenLearnerPreview?.(), 300);
  };

  const handleScriptDialogCancelEdit = () => {
    setScriptDialogDraft(scriptContent);
    setScriptDialogEditing(false);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Learner Preview Modal */}
      {showLearnerPreview && (
        <LearnerPreview
          courseTitle={courseTitle}
          rawOutputs={rawOutputs}
          onClose={() => {
            setShowLearnerPreview(false);
            setShowPostPreviewDialog(true);
          }}
          insertedVideos={allInsertedVideos}
          courseDuration={courseDuration}
          avatarTrainerId={avatarTrainerId}
          slideLayout={slideLayout}
          learnerNotesEnabled={learnerNotesEnabled}
          resourcesPanelEnabled={resourcesPanelEnabled}
          glossaryEnabled={glossaryEnabled}
          discussionEnabled={discussionEnabled}
          assessmentIntensity={assessmentIntensity}
          flipStylePreference={flipStylePreference}
          textLanguage={textLanguage}
          narratorLanguage={narratorLanguage}
          onUpdateVisualTopic={onUpdateVisualTopic}
        />
      )}

      {/* Post-Preview Dialog */}
      {showPostPreviewDialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPostPreviewDialog(false)} />
          <div className="relative w-[420px] max-w-[92vw] rounded-2xl bg-card shadow-2xl overflow-hidden animate-fade-in">
            <div className="h-1.5 w-full bg-primary" />
            <div className="px-7 pt-7 pb-6">
              <h2 className="text-[18px] font-bold text-foreground mb-2">Package Ready</h2>
              <p className="text-[14px] text-foreground/80 mb-6">
                Would you like to generate the downloadable package now?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPostPreviewDialog(false)}
                  className="px-5 h-10 rounded-xl text-[13px] font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-all"
                >
                  No, Later
                </button>
                <button
                  onClick={() => {
                    setShowPostPreviewDialog(false);
                    setActiveTab("package");
                  }}
                  className="px-5 h-10 rounded-xl text-[13px] font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all"
                >
                  Yes, Generate Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScriptConfirm && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowScriptConfirm(false)} />
          <div className="relative w-[440px] max-w-[92vw] rounded-2xl bg-card shadow-2xl overflow-hidden animate-fade-in">
            <div className="h-1.5 w-full bg-primary" />
            <div className="px-7 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-[17px] font-extrabold text-foreground leading-tight">View and Edit the Script</h3>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
                The script has been generated. Would you like to review it now? You can make edits before it's used in the course.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptConfirm(false)}
                  className="h-10 px-4 rounded-lg text-[13px] font-bold border border-border text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowScriptConfirm(false);
                    openScriptDialog();
                  }}
                  className="h-10 px-5 rounded-lg text-[13px] font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScriptDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => !scriptDialogEditing && setShowScriptDialog(false)}
          />
          <div className="relative w-[860px] max-w-[94vw] h-[82vh] rounded-2xl bg-card shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-[18px] font-extrabold text-foreground leading-tight">Course Script</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {scriptDialogEditing ? "Editing — make your changes and click Save" : "Review the script below. Click Edit to make changes."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (scriptDialogEditing) return;
                  setShowScriptDialog(false);
                }}
                disabled={scriptDialogEditing}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <span className="text-[18px] leading-none text-muted-foreground">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {scriptDialogEditing ? (
                <textarea
                  value={scriptDialogDraft}
                  onChange={(event) => setScriptDialogDraft(event.target.value)}
                  className="w-full h-full min-h-[55vh] resize-none rounded-xl border border-border bg-background px-4 py-3 text-[13px] leading-[1.7] text-foreground focus:border-primary focus:outline-none font-mono"
                />
              ) : (
                <pre className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{scriptDialogDraft}</pre>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-card">
              {scriptDialogEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleScriptDialogCancelEdit}
                    className="h-10 px-4 rounded-lg text-[13px] font-bold border border-border text-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleScriptDialogSave}
                    className="h-10 px-5 rounded-lg text-[13px] font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowScriptDialog(false)}
                    className="h-10 px-4 rounded-lg text-[13px] font-bold border border-border text-foreground hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptDialogEditing(true)}
                    className="h-10 px-5 rounded-lg text-[13px] font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563EB' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-[20px] font-extrabold text-foreground">Course Output</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEditTab && !!content && !isEditing && (
              <button
                onClick={() => {
                  setEditValue(content || "");
                  setIsEditing(true);
                }}
                className="h-8 px-3 rounded-lg text-[12px] font-bold border border-border text-foreground hover:bg-secondary transition-all"
                type="button"
              >
                Edit
              </button>
            )}
          </div>
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
                className={`h-8 px-3 rounded-lg text-[12px] font-bold flex items-center gap-1 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5 ${
                  disabled
                    ? "bg-secondary/50 text-muted-foreground/40 cursor-not-allowed"
                    : isPreview
                      ? "bg-white text-primary border-2 border-primary hover:bg-primary/5"
                      : activeTab === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-border"
                }`}
                style={{
                  boxShadow: disabled
                    ? "none"
                    : activeTab === tab.key
                      ? "0 3px 0 rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)"
                      : "0 2px 0 rgba(0,0,0,0.06), 0 3px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
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

