import React, { useState, useRef, useEffect } from "react";
import { RotateCcw, Type } from "lucide-react";

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

export const RichTitleEditor: React.FC<RichTitleEditorProps> = ({ title, spans, onTitleChange, isOpen }) => {
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [showToolbar, setShowToolbar] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const getSpanAtRange = (): TitleSpan | null => {
    return spans.find((s) => s.start === selectionStart && s.end === selectionEnd) || null;
  };

  const applyFormatting = (property: keyof TitleSpan["style"], value: any) => {
    if (selectionStart === selectionEnd) return;

    let newSpans = spans.filter((s) => !(s.start === selectionStart && s.end === selectionEnd));
    const existingSpan = getSpanAtRange();

    const newStyle = {
      ...(existingSpan?.style || {}),
      [property]: value,
    };

    newSpans.push({
      start: selectionStart,
      end: selectionEnd,
      style: newStyle,
    });

    newSpans = newSpans.sort((a, b) => a.start - b.start);
    onTitleChange(title, newSpans);
  };

  const resetFormatting = () => {
    const newSpans = spans.filter((s) => !(s.start === selectionStart && s.end === selectionEnd));
    onTitleChange(title, newSpans);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode)) {
      setSelectionStart(selection.anchorOffset);
      setSelectionEnd(selection.focusOffset);
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  const getStyledSegments = () => {
    const segments: { text: string; style: TitleSpan["style"] }[] = [];
    let lastEnd = 0;

    spans.sort((a, b) => a.start - b.start).forEach((span) => {
      if (lastEnd < span.start) {
        segments.push({ text: title.slice(lastEnd, span.start), style: {} });
      }
      segments.push({ text: title.slice(span.start, span.end), style: span.style });
      lastEnd = span.end;
    });

    if (lastEnd < title.length) {
      segments.push({ text: title.slice(lastEnd), style: {} });
    }

    return segments.length === 0 ? [{ text: title, style: {} }] : segments;
  };

  const getStyleProps = (style: TitleSpan["style"]) => {
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

  const currentSpan = getSpanAtRange();

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
        {getStyledSegments().map((seg, idx) => (
          <span key={idx} style={getStyleProps(seg.style)}>
            {seg.text}
          </span>
        ))}
      </div>

      {showToolbar && selectionStart !== selectionEnd && (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">
            Selected: "{title.slice(Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd))}"
          </p>

          <div className="space-y-2">
            {/* Font Size */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Font Size</label>
              <div className="flex gap-1 flex-wrap">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => applyFormatting("fontSize", size.value as any)}
                    type="button"
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                      currentSpan?.style.fontSize === size.value
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
                    onClick={() => applyFormatting("fontFamily", font.value as any)}
                    type="button"
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                      currentSpan?.style.fontFamily === font.value
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
                      borderColor: currentSpan?.style.color === color.value ? "#000" : "#ddd",
                    }}
                    title={color.label}
                  />
                ))}
                <input
                  type="color"
                  value={currentSpan?.style.color || "#000000"}
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
                  onClick={() => applyFormatting("bold", !currentSpan?.style.bold)}
                  type="button"
                  className={`text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    currentSpan?.style.bold ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => applyFormatting("italic", !currentSpan?.style.italic)}
                  type="button"
                  className={`text-[12px] italic px-3 py-1.5 rounded-lg transition-all ${
                    currentSpan?.style.italic ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  I
                </button>
                <button
                  onClick={() => applyFormatting("underline", !currentSpan?.style.underline)}
                  type="button"
                  className={`text-[12px] underline px-3 py-1.5 rounded-lg transition-all ${
                    currentSpan?.style.underline ? "bg-blue-600 text-white" : "bg-white border border-border hover:border-primary text-foreground"
                  }`}
                >
                  U
                </button>
                {currentSpan && (
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
