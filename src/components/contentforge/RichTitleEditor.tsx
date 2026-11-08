import React, { useState, useRef } from "react";
import { RotateCcw, Type } from "lucide-react";
import { keepTitleFocus } from "./TitleFormatter";

export interface TitleSpan {
  start: number;
  end: number;
  style: {
    fontSize?: "small" | "medium" | "large" | "xl";
    fontFamily?: "sans" | "serif" | "mono";
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

export interface RichTitleData {
  text: string;
  spans: TitleSpan[];
}

interface RichTitleEditorProps {
  title: string;
  spans: TitleSpan[];
  onTitleChange: (text: string, spans: TitleSpan[]) => void;
  isOpen: boolean;
}

type TitleStyle = TitleSpan["style"];

interface StyleRun {
  start: number;
  end: number;
  style: TitleStyle;
}

const FONT_SIZES = [
  { value: "small", label: "Small (14px)", px: 14 },
  { value: "medium", label: "Medium (18px)", px: 18 },
  { value: "large", label: "Large (24px)", px: 24 },
  { value: "xl", label: "XL (32px)", px: 32 },
] as const;

const FONT_FAMILIES = [
  { value: "sans", label: "Sans Serif", family: "system-ui, -apple-system, sans-serif" },
  { value: "serif", label: "Serif", family: "Georgia, serif" },
  { value: "mono", label: "Monospace", family: "Courier, monospace" },
] as const;

const COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#2563eb", label: "Blue" },
  { value: "#dc2626", label: "Red" },
  { value: "#16a34a", label: "Green" },
  { value: "#7c3aed", label: "Purple" },
  { value: "#ea580c", label: "Orange" },
];

/** Drop unset values so that equal styles compare equal. */
const cleanStyle = (style: TitleStyle): TitleStyle => {
  const cleaned: Record<string, unknown> = {};
  (Object.keys(style) as (keyof TitleStyle)[]).forEach((key) => {
    const value = style[key];
    if (value !== undefined && value !== false && value !== "") cleaned[key] = value;
  });
  return cleaned as TitleStyle;
};

const styleKey = (style: TitleStyle): string =>
  JSON.stringify(Object.entries(style).sort(([a], [b]) => a.localeCompare(b)));

/** Resolve the style of every character. Overlapping spans are merged in order. */
const buildCharStyles = (length: number, spans: TitleSpan[]): TitleStyle[] => {
  const chars: TitleStyle[] = Array.from({ length }, () => ({}));
  spans.forEach((span) => {
    for (let i = Math.max(0, span.start); i < Math.min(length, span.end); i++) {
      chars[i] = { ...chars[i], ...span.style };
    }
  });
  return chars.map(cleanStyle);
};

/** Group consecutive characters that share a style into runs. */
const groupRuns = (chars: TitleStyle[]): StyleRun[] => {
  const runs: StyleRun[] = [];
  chars.forEach((style, i) => {
    const last = runs[runs.length - 1];
    if (last && last.end === i && styleKey(last.style) === styleKey(style)) {
      last.end = i + 1;
    } else {
      runs.push({ start: i, end: i + 1, style });
    }
  });
  return runs;
};

const charsToSpans = (chars: TitleStyle[]): TitleSpan[] =>
  groupRuns(chars)
    .filter((run) => Object.keys(run.style).length > 0)
    .map(({ start, end, style }) => ({ start, end, style }));

/** Character offset of a DOM point, measured from the start of the editor text. */
const getTextOffset = (root: HTMLElement, node: Node, offset: number): number => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
};

export const RichTitleEditor: React.FC<RichTitleEditorProps> = ({ title, spans, onTitleChange, isOpen }) => {
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [showToolbar, setShowToolbar] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const charStyles = buildCharStyles(title.length, spans);
  const rangeStart = Math.min(selectionStart, selectionEnd);
  const rangeEnd = Math.max(selectionStart, selectionEnd);
  const hasSelection = rangeEnd > rangeStart;
  const currentStyle: TitleStyle = hasSelection ? charStyles[rangeStart] ?? {} : {};
  const hasStyleAtSelection = Object.keys(currentStyle).length > 0;

  const applyStyleToSelection = (update: (prev: TitleStyle) => TitleStyle) => {
    if (!hasSelection) return;
    const next = [...charStyles];
    for (let i = rangeStart; i < rangeEnd; i++) {
      next[i] = cleanStyle(update(next[i]));
    }
    onTitleChange(title, charsToSpans(next));
  };

  const applyFormatting = (property: keyof TitleStyle, value: string | boolean) => {
    applyStyleToSelection((prev) => ({ ...prev, [property]: value } as TitleStyle));
  };

  const resetFormatting = () => {
    applyStyleToSelection(() => ({}));
  };

  // DOM offsets are relative to the span's own text node, so measure from the start of the editor to get a position in the title.
  const getTitleOffset = (root: HTMLElement, node: Node, offset: number) => {
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(node, offset);
    return range.toString().length;
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const root = editorRef.current;
    if (selection && root && selection.toString().length > 0 && selection.anchorNode && root.contains(selection.anchorNode)) {
      const anchor = getTitleOffset(root, selection.anchorNode, selection.anchorOffset);
      const focus = getTitleOffset(root, selection.focusNode!, selection.focusOffset);
      setSelectionStart(Math.min(anchor, focus));
      setSelectionEnd(Math.max(anchor, focus));
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  const getStyleProps = (style: TitleStyle) => {
    const fontSizeObj = FONT_SIZES.find((f) => f.value === style.fontSize);
    const fontFamilyObj = FONT_FAMILIES.find((f) => f.value === style.fontFamily);

    return {
      fontSize: fontSizeObj?.px || 18,
      fontFamily: fontFamilyObj?.family || "system-ui",
      fontWeight: style.bold ? 700 : 400,
      fontStyle: style.italic ? "italic" : "normal",
      textDecoration: style.underline ? "underline" : "none",
      color: style.color || "#000000",
    };
  };

  if (!isOpen) return null;

  const runs = groupRuns(charStyles);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <Type className="w-4 h-4" /> Rich Text Formatting
        </label>
        <button
          onClick={() => setShowToolbar(false)}
          type="button"
          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Done
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground mb-3">Select text to format it</p>

      <div
        ref={editorRef}
        onMouseUp={handleMouseUp}
        className="border-[1.5px] border-border rounded-lg p-4 bg-white mb-4 text-center cursor-text select-text focus:outline-none focus:border-primary min-h-16 flex items-center justify-center"
      >
        {runs.map((run) => (
          <span key={run.start} style={getStyleProps(run.style)}>
            {title.slice(run.start, run.end)}
          </span>
        ))}
      </div>

      {showToolbar && (
        <div className="border-t border-blue-200 pt-3" onMouseDown={keepTitleFocus}>
          {selectionStart !== selectionEnd && (
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">
              Selected: "{title.slice(rangeStart, rangeEnd)}"
            </p>
          )}
          {!hasSelection && (
            <p className="text-[11px] text-muted-foreground mb-2 italic">👆 Select text to apply formatting</p>
          )}

          <div className="space-y-2">
            {/* Font Size */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Font Size</label>
              <div className="flex gap-1 flex-wrap">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => applyFormatting("fontSize", size.value)}
                    type="button"
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                      currentStyle.fontSize === size.value
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-border hover:border-primary text-foreground"
                    }`}
                  >
                    {size.label.split("(")[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Font Type</label>
              <div className="flex gap-1 flex-wrap">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => applyFormatting("fontFamily", font.value)}
                    type="button"
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                      currentStyle.fontFamily === font.value
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-border hover:border-primary text-foreground"
                    }`}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => applyFormatting("color", color.value)}
                    type="button"
                    className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: color.value,
                      borderColor: currentStyle.color === color.value ? "#000" : "#ddd",
                    }}
                    title={color.label}
                  />
                ))}
                <input
                  type="color"
                  value={currentStyle.color || "#000000"}
                  onChange={(e) => applyFormatting("color", e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-border"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Text Style (Bold, Italic, Underline) */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Style</label>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => applyFormatting("bold", !currentStyle.bold)}
                  type="button"
                  className={`text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    currentStyle.bold ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => applyFormatting("italic", !currentStyle.italic)}
                  type="button"
                  className={`text-[12px] italic px-3 py-1.5 rounded-lg transition-all ${
                    currentStyle.italic ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  I
                </button>
                <button
                  onClick={() => applyFormatting("underline", !currentStyle.underline)}
                  type="button"
                  className={`text-[12px] underline px-3 py-1.5 rounded-lg transition-all ${
                    currentStyle.underline ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  U
                </button>
                {hasStyleAtSelection && (
                  <button
                    onClick={resetFormatting}
                    type="button"
                    className="text-[12px] font-semibold px-2 py-1.5 rounded-lg bg-white border border-border hover:border-destructive text-destructive transition-all flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
