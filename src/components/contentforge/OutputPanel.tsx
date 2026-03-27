import React, { useState } from "react";
import { OutputData } from "@/types/agents";
import { FileText, BookOpen, ClipboardCheck, Package, Sparkles, Check, Clock, Layers, BarChart3, AlertTriangle, Download } from "lucide-react";

interface OutputPanelProps {
  outputData: OutputData;
}

const tabs = [
  { key: "outline" as const, label: "Outline", icon: BookOpen },
  { key: "script" as const, label: "Script", icon: FileText },
  { key: "assessment" as const, label: "Assessment", icon: ClipboardCheck },
  { key: "package" as const, label: "Package", icon: Package },
];

/* Try to parse JSON from a string that might have markdown fences */
function tryParseJSON(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    // Try stripping markdown code fences
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
      {/* MCQs */}
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
                  <p className="text-[14px] font-semibold text-foreground">
                    {i + 1}. {q.question}
                  </p>
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    {q.blooms_level}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(q.options || []).map((opt: string, j: number) => {
                    const letter = String.fromCharCode(65 + j);
                    const isCorrect = opt === q.correct_answer || letter === q.correct_answer || q.correct_answer?.includes(opt);
                    return (
                      <div
                        key={j}
                        className={`text-[13px] px-3 py-1.5 rounded-lg ${
                          isCorrect
                            ? "bg-status-complete/10 text-status-complete font-semibold border border-status-complete/30"
                            : "text-foreground/70"
                        }`}
                      >
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

      {/* Scenarios */}
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
                      <div
                        key={j}
                        className={`text-[13px] px-3 py-2 rounded-lg cursor-pointer transition-all ${
                          isCorrect
                            ? "bg-status-complete/10 text-status-complete font-semibold border border-status-complete/30"
                            : "bg-card hover:bg-border/50 text-foreground/80"
                        }`}
                      >
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

      {/* Reflection */}
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
const PackageView: React.FC<{ raw: string }> = ({ raw }) => {
  const data = tryParseJSON(raw);
  if (!data) return <pre className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-[1.7]">{raw}</pre>;

  const meta = data.metadata || {};
  const [checklist, setChecklist] = useState<boolean[]>(
    new Array((data.deployment_checklist || []).length).fill(false)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metadata */}
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

      {/* SCORM Manifest */}
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

      {/* Deployment Checklist */}
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

      {/* QA Summary */}
      {data.qa_summary && (
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">QA Summary</h3>
          <div className="space-y-1">
            {(data.qa_summary.agents_completed || []).map((agent: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[13px]">
                <Check className="w-3.5 h-3.5 text-status-complete" />
                <span className="text-foreground">{agent}</span>
              </div>
            ))}
            {(data.qa_summary.gaps || []).length > 0 && (
              <div className="mt-2">
                {data.qa_summary.gaps.map((gap: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] text-status-queued">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {gap}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        disabled
        className="w-full h-12 rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        title="Full export coming in next build"
      >
        <Download className="w-4 h-4" />
        Export Package
      </button>
      <p className="text-[11px] text-muted-foreground text-center -mt-4">Full export coming in next build</p>
    </div>
  );
};

/* ─── Script Renderer (highlights narration cues) ─── */
const ScriptView: React.FC<{ raw: string }> = ({ raw }) => {
  // Highlight narration cues like [PAUSE 1s], [EMPHASIZE], etc.
  const parts = raw.split(/(\[(?:PAUSE[^]]*?|EMPHASIZE|SLOW DOWN|SPEED UP|WHISPER|EXCITED)\])/gi);
  return (
    <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7] animate-fade-in">
      {parts.map((part, i) =>
        /^\[(?:PAUSE|EMPHASIZE|SLOW DOWN|SPEED UP|WHISPER|EXCITED)/i.test(part) ? (
          <span key={i} className="text-primary font-bold bg-primary/10 px-1 rounded">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
};

export const OutputPanel: React.FC<OutputPanelProps> = ({ outputData }) => {
  const [activeTab, setActiveTab] = useState<keyof OutputData>("script");
  const content = outputData[activeTab];

  const renderContent = () => {
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
        return <PackageView raw={content} />;
      case "script":
        return <ScriptView raw={content} />;
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
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-[20px] font-extrabold text-foreground">Course Output</h2>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-8 px-3 rounded-lg text-[12px] font-bold flex items-center gap-1 transition-all duration-[180ms] ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-border"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {renderContent()}
      </div>
    </div>
  );
};
