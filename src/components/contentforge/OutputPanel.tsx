import React, { useState } from "react";
import { OutputData } from "@/types/agents";
import { FileText, BookOpen, ClipboardCheck, Package, Sparkles } from "lucide-react";

interface OutputPanelProps {
  outputData: OutputData;
}

const tabs = [
  { key: "outline" as const, label: "Outline", icon: BookOpen },
  { key: "script" as const, label: "Script", icon: FileText },
  { key: "assessment" as const, label: "Assessment", icon: ClipboardCheck },
  { key: "package" as const, label: "Package", icon: Package },
];

export const OutputPanel: React.FC<OutputPanelProps> = ({ outputData }) => {
  const [activeTab, setActiveTab] = useState<keyof OutputData>("script");
  const content = outputData[activeTab];

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
        {content ? (
          <div className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.7] animate-fade-in">
            {content}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-[14px] font-semibold text-muted-foreground">Run the pipeline to see output</p>
          </div>
        )}
      </div>
    </div>
  );
};
