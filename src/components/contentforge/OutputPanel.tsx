import React, { useState } from "react";
import { OutputData } from "@/types/agents";
import { FileText, BookOpen, ClipboardCheck, Package } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<keyof OutputData>("outline");
  const content = outputData[activeTab];

  return (
    <div className="bg-card rounded-2xl shadow-card p-7">
      <h2 className="text-[24px] font-[800] text-foreground mb-5">Course Output</h2>

      {/* Tab bar */}
      <div className="flex gap-2 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`h-9 px-[18px] rounded-lg text-[14px] font-bold flex items-center gap-1.5 transition-all duration-[180ms] ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-border"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="min-h-[300px] py-5">
        {content ? (
          <div className="text-[15px] text-foreground/90 whitespace-pre-wrap leading-[1.7] animate-fade-in">
            {content}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-[16px] font-semibold text-muted-foreground">Run the pipeline to see output</p>
          </div>
        )}
      </div>
    </div>
  );
};
