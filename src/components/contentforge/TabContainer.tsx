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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200/50 px-8 py-0 flex items-center gap-0 shadow-sm backdrop-blur-sm">
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-5 py-4 text-[14px] font-semibold transition-all relative group ${
              activeTab === tab.id
                ? "text-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-[18px]">{tab.icon}</span>
            {tab.label}

            {/* Active indicator */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-full" />
            )}

            {/* Hover effect */}
            {activeTab !== tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 group-hover:bg-slate-300 transition-all rounded-t-full" />
            )}
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
