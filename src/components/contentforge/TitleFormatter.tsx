import React, { useState } from "react";
import { Bold, Italic, Underline, Palette } from "lucide-react";

interface TitleStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  font: string;
}

interface TitleFormatterProps {
  title: string;
  setTitle: (title: string) => void;
  isOpen: boolean;
}

const FONT_OPTIONS = [
  { value: "sans-serif", label: "Sans Serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
];

const COLOR_OPTIONS = [
  "#000000", // Black
  "#1e40af", // Blue
  "#dc2626", // Red
  "#16a34a", // Green
  "#9333ea", // Purple
  "#ea580c", // Orange
];

export const TitleFormatter: React.FC<TitleFormatterProps> = ({
  title,
  setTitle,
  isOpen,
}) => {
  const [style, setStyle] = useState<TitleStyle>({
    bold: false,
    italic: false,
    underline: false,
    color: "#000000",
    font: "sans-serif",
  });

  const toggleBold = () => setStyle({ ...style, bold: !style.bold });
  const toggleItalic = () => setStyle({ ...style, italic: !style.italic });
  const toggleUnderline = () => setStyle({ ...style, underline: !style.underline });
  const setColor = (color: string) => setStyle({ ...style, color });
  const setFont = (font: string) => setStyle({ ...style, font });

  const getTitleStyle = () => ({
    fontWeight: style.bold ? "bold" : "normal",
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    color: style.color,
    fontFamily: style.font,
  });

  // Store formatting info as data attribute for later use
  const getFormattedTitle = () => {
    return JSON.stringify({ text: title, style });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
      {/* Preview */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <p className="text-[11px] font-semibold text-gray-600 mb-2">Preview</p>
        <p style={getTitleStyle()} className="text-lg min-h-8 break-words">
          {title || "Your title here..."}
        </p>
      </div>

      {/* Formatting Toolbar */}
      <div className="space-y-3">
        {/* Text Style Buttons */}
        <div className="flex gap-2">
          <button
            onClick={toggleBold}
            className={`p-2 rounded-lg transition-colors ${
              style.bold
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={toggleItalic}
            className={`p-2 rounded-lg transition-colors ${
              style.italic
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={toggleUnderline}
            className={`p-2 rounded-lg transition-colors ${
              style.underline
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* Font Family Selector */}
        <div>
          <label className="text-[11px] font-semibold text-gray-700 block mb-2">
            Font Family
          </label>
          <select
            value={style.font}
            onChange={(e) => setFont(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-blue-400"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-[11px] font-semibold text-gray-700 block mb-2 flex items-center gap-1">
            <Palette className="w-3 h-3" />
            Text Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => setColor(color)}
                className={`w-8 h-8 rounded-lg transition-all ${
                  style.color === color ? "ring-2 ring-offset-2 ring-blue-400" : ""
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={style.color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
              title="Custom color"
            />
          </div>
        </div>

        {/* Info Text */}
        <p className="text-[11px] text-gray-600 bg-white/50 p-2 rounded border border-gray-100">
          💡 Formatting will be applied to the title in all outputs (flipbook, PDF, preview)
        </p>
      </div>
    </div>
  );
};

// Helper function to apply stored formatting to an element
export function applyTitleFormatting(
  element: HTMLElement,
  formattedData: string
): void {
  try {
    const data = JSON.parse(formattedData);
    if (data.style) {
      const style = data.style as TitleStyle;
      element.style.fontWeight = style.bold ? "bold" : "normal";
      element.style.fontStyle = style.italic ? "italic" : "normal";
      element.style.textDecoration = style.underline ? "underline" : "none";
      element.style.color = style.color;
      element.style.fontFamily = style.font;
    }
  } catch (err) {
    console.warn("Could not apply title formatting:", err);
  }
}

// Helper to extract raw title text from formatted data
export function extractTitleText(formattedData: string): string {
  try {
    const data = JSON.parse(formattedData);
    return data.text || formattedData;
  } catch {
    return formattedData;
  }
}

// Helper to get title style object
export function getTitleStyleObject(formattedData: string): React.CSSProperties {
  try {
    const data = JSON.parse(formattedData);
    const style = data.style as TitleStyle;
    return {
      fontWeight: style.bold ? "bold" : "normal",
      fontStyle: style.italic ? "italic" : "normal",
      textDecoration: style.underline ? "underline" : "none",
      color: style.color,
      fontFamily: style.font,
    };
  } catch {
    return {};
  }
}
