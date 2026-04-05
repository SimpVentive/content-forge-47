import React from "react";
import { Eye, EyeOff, Film, Highlighter } from "lucide-react";

export const HIGHLIGHT_PALETTES = {
  yellow: {
    label: "Light Yellow",
    background: "hsl(var(--highlight-yellow-bg))",
    border: "hsl(var(--highlight-yellow-border))",
    foreground: "hsl(var(--highlight-yellow-foreground))",
  },
  mint: {
    label: "Soft Mint",
    background: "hsl(var(--highlight-mint-bg))",
    border: "hsl(var(--highlight-mint-border))",
    foreground: "hsl(var(--highlight-mint-foreground))",
  },
  sky: {
    label: "Soft Blue",
    background: "hsl(var(--highlight-sky-bg))",
    border: "hsl(var(--highlight-sky-border))",
    foreground: "hsl(var(--highlight-sky-foreground))",
  },
} as const;

export type HighlightPalette = keyof typeof HIGHLIGHT_PALETTES;

interface PreviewActionBarProps {
  highlightEnabled: boolean;
  highlightPalette: HighlightPalette;
  onToggleHighlight: () => void;
  onSelectPalette: (palette: HighlightPalette) => void;
  onPlaceVideos?: () => void;
  unassignedCount?: number;
}

export const PreviewActionBar: React.FC<PreviewActionBarProps> = ({
  highlightEnabled,
  highlightPalette,
  onToggleHighlight,
  onSelectPalette,
  onPlaceVideos,
  unassignedCount = 0,
}) => {
  return (
    <div className="absolute top-[76px] left-6 right-6 md:left-auto z-50 flex max-w-[calc(100vw-3rem)] flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-card backdrop-blur-md">
      <div className="flex items-center gap-2 rounded-xl bg-secondary/80 px-2 py-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Highlighter className="h-4 w-4" />
        </div>
        <button
          onClick={onToggleHighlight}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all ${
            highlightEnabled
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "bg-card text-muted-foreground hover:bg-secondary"
          }`}
          type="button"
        >
          {highlightEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Highlight {highlightEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-secondary/70 px-2 py-1.5">
        {Object.entries(HIGHLIGHT_PALETTES).map(([key, palette]) => {
          const isActive = highlightPalette === key;
          return (
            <button
              key={key}
              onClick={() => onSelectPalette(key as HighlightPalette)}
              className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[12px] font-semibold transition-all ${
                isActive
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
              type="button"
            >
              <span
                className="h-4 w-4 rounded-full border border-border"
                style={{
                  backgroundColor: palette.background,
                  boxShadow: `inset 0 0 0 1px ${palette.border}`,
                }}
              />
              <span className="hidden xl:inline">{palette.label}</span>
            </button>
          );
        })}
      </div>

      {unassignedCount > 0 && onPlaceVideos && (
        <button
          onClick={onPlaceVideos}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground shadow-btn-primary transition-all hover:brightness-110"
          type="button"
        >
          <Film className="h-4 w-4" />
          Insert {unassignedCount} Video{unassignedCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
};