import React, { useEffect, useRef, useState } from "react";
import { BookOpenText, Eye, EyeOff, Film, GripHorizontal, Highlighter, PanelBottomClose, PanelBottomOpen } from "lucide-react";

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

export const FLIP_STYLES = {
  dramatic: {
    label: "Physical Flip",
    shortLabel: "Physical",
  },
  subtle: {
    label: "Subtle Flip",
    shortLabel: "Subtle",
  },
  bound: {
    label: "Bound Flipchart",
    shortLabel: "Bound",
  },
} as const;

export type FlipStyle = keyof typeof FLIP_STYLES;

interface PreviewActionBarProps {
  highlightEnabled: boolean;
  highlightPalette: HighlightPalette;
  flipStyle: FlipStyle;
  onToggleHighlight: () => void;
  onSelectPalette: (palette: HighlightPalette) => void;
  onSelectFlipStyle: (style: FlipStyle) => void;
  onPlaceVideos?: () => void;
  unassignedCount?: number;
}

export const PreviewActionBar: React.FC<PreviewActionBarProps> = ({
  highlightEnabled,
  highlightPalette,
  flipStyle,
  onToggleHighlight,
  onSelectPalette,
  onSelectFlipStyle,
  onPlaceVideos,
  unassignedCount = 0,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState({ x: 24, y: 150 });
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const savedPosition = window.localStorage.getItem("contentforge.previewActionBar.position");
      const savedCollapsed = window.localStorage.getItem("contentforge.previewActionBar.collapsed");

      if (savedPosition) {
        const parsed = JSON.parse(savedPosition) as { x?: number; y?: number };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition({ x: parsed.x, y: parsed.y });
        }
      } else {
        const estimatedWidth = Math.min(560, Math.max(360, window.innerWidth - 48));
        setPosition({
          x: Math.max(16, window.innerWidth - estimatedWidth - 24),
          y: 138,
        });
      }

      if (savedCollapsed === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore storage issues and keep session defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("contentforge.previewActionBar.position", JSON.stringify(position));
      window.localStorage.setItem("contentforge.previewActionBar.collapsed", String(isCollapsed));
    } catch {
      // Ignore persistence issues for the floating toolbar.
    }
  }, [isCollapsed, position]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragOffset = dragOffsetRef.current;
      if (!dragOffset) return;

      const panelWidth = panelRef.current?.offsetWidth || 420;
      const panelHeight = panelRef.current?.offsetHeight || 70;
      const nextX = Math.min(
        Math.max(12, event.clientX - dragOffset.x),
        Math.max(12, window.innerWidth - panelWidth - 12)
      );
      const nextY = Math.min(
        Math.max(12, event.clientY - dragOffset.y),
        Math.max(12, window.innerHeight - panelHeight - 12)
      );

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[10003] max-w-[min(560px,calc(100vw-24px))] rounded-2xl border border-border bg-card/96 shadow-[0_20px_48px_rgba(15,23,42,0.18)] backdrop-blur-md"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex cursor-move items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-secondary/75 px-3 py-2 text-[11px] font-[800] uppercase tracking-[0.16em] text-muted-foreground"
        onPointerDown={handleDragStart}
        role="presentation"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4" />
          Floating Lesson Controls
        </div>
        <button
          onClick={() => setIsCollapsed((current) => !current)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-[800] uppercase tracking-[0.12em] text-foreground transition-all hover:bg-card"
          type="button"
        >
          {isCollapsed ? <PanelBottomOpen className="h-3.5 w-3.5" /> : <PanelBottomClose className="h-3.5 w-3.5" />}
          {isCollapsed ? "Open" : "Collapse"}
        </button>
      </div>

      {isCollapsed ? null : (
        <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-3">
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

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-secondary/70 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpenText className="h-4 w-4" />
            </div>
            {Object.entries(FLIP_STYLES).map(([key, style]) => {
              const isActive = flipStyle === key;
              return (
                <button
                  key={key}
                  onClick={() => onSelectFlipStyle(key as FlipStyle)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[12px] font-semibold transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                  type="button"
                >
                  <span className="hidden xl:inline">{style.label}</span>
                  <span className="xl:hidden">{style.shortLabel}</span>
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
      )}
    </div>
  );
};