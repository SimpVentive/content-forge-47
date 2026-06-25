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
    <div className="h-full flex flex-col bg-slate-50">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-0 flex items-center gap-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2.5 px-4 py-3.5 text-[13px] font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 bg-blue-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
};
