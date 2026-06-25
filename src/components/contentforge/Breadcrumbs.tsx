import React from "react";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, activeId, onNavigate }) => {
  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-2 max-w-full overflow-x-auto">
        {items.map((item, idx) => (
          <React.Fragment key={item.id}>
            <button
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeId === item.id
                  ? "bg-white text-primary shadow-sm border border-primary/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              {item.icon && <span className="text-[16px]">{item.icon}</span>}
              {item.label}
            </button>
            {idx < items.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
