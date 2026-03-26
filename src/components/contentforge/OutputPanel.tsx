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
    <aside className="w-[380px] shrink-0 border-l border-border flex flex-col bg-card">
      <div className="p-5 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Output</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 mx-auto mb-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {content ? (
          <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed animate-fade-in">
            {content}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Run the pipeline to see output here</p>
          </div>
        )}
      </div>
    </aside>
  );
};
