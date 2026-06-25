import React from "react";
import { FileText, Zap, BarChart3 } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TabContainerProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export const TabContainer: React.FC<TabContainerProps> = ({ tabs, activeTab, onTabChange, children }) => {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-card px-6 py-0 flex items-center gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-0 py-4 text-[14px] font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
