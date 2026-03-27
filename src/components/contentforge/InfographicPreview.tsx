import React, { useState, useEffect, useCallback } from "react";
import { Download, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InfographicPreviewProps {
  archRaw: string;
  visualRaw: string;
}

function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { return null; } }
    return null;
  }
}

function extractSVG(text: string): string {
  // Try to extract SVG from the response
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) return svgMatch[0];
  // Try markdown code block
  const codeMatch = text.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
  if (codeMatch) {
    const inner = codeMatch[1].trim();
    const innerSvg = inner.match(/<svg[\s\S]*?<\/svg>/i);
    if (innerSvg) return innerSvg[0];
  }
  return "";
}

interface InfographicData {
  moduleTitle: string;
  layoutType: string;
  topics: string[];
  svg: string;
  loading: boolean;
  error: boolean;
}

export const InfographicPreview: React.FC<InfographicPreviewProps> = ({ archRaw, visualRaw }) => {
  const [infographics, setInfographics] = useState<InfographicData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const arch = tryParseJSON(archRaw);
  const visual = tryParseJSON(visualRaw);

  const getModules = useCallback(() => {
    let modules: any[] = [];
    if (arch?.modules) modules = arch.modules;
    else if (arch?.course_structure?.modules) modules = arch.course_structure.modules;
    else if (Array.isArray(arch)) modules = arch;

    const visualModules = visual?.modules || [];

    return modules.map((mod: any, i: number) => {
      const title = mod.module_title || mod.title || mod.name || `Module ${i + 1}`;
      const topics = (mod.topics || mod.sections || mod.key_topics || [])
        .map((t: any) => (typeof t === "string" ? t : t.title || t.topic || t.name || ""));
      const vm = visualModules[i];
      const layoutType = vm?.slide_layout || vm?.infographic_description || "Standard Layout";
      return { title, topics, layoutType };
    });
  }, [archRaw, visualRaw]);

  useEffect(() => {
    const modules = getModules();
    if (modules.length === 0 || infographics.length > 0) return;

    setGenerating(true);
    setProgress({ current: 0, total: modules.length });

    const initial = modules.map((m) => ({
      moduleTitle: m.title,
      layoutType: m.layoutType,
      topics: m.topics,
      svg: "",
      loading: true,
      error: false,
    }));
    setInfographics(initial);

    // Generate sequentially
    const generateAll = async () => {
      for (let i = 0; i < modules.length; i++) {
        setProgress({ current: i + 1, total: modules.length });
        try {
          const { data, error } = await supabase.functions.invoke("claude", {
            body: {
              systemPrompt: "You are an SVG infographic designer. Generate a clean, professional SVG infographic for a training module. Use only these colors: #4f46e5 (indigo), #7c3aed (violet), #10b981 (emerald), #f59e0b (amber), #f8fafc (background), #0f172a (text). The SVG must be 600x400px, self-contained, with no external fonts or images. Use geometric shapes, icons made from basic SVG paths, and bold readable text. Make it visually striking and professional — suitable for a corporate training course.",
              userMessage: `Create an infographic for this module: ${modules[i].title}. Key topics: ${modules[i].topics.join(", ")}. Layout type: ${modules[i].layoutType}. Include the module title prominently, visualize the key topics using icons or diagrams, and add a small 'ContentForge' label in the bottom right corner.`,
            },
          });

          if (error || data?.error) {
            setInfographics((prev) => prev.map((inf, j) =>
              j === i ? { ...inf, loading: false, error: true } : inf
            ));
          } else {
            const svg = extractSVG(data.text || "");
            setInfographics((prev) => prev.map((inf, j) =>
              j === i ? { ...inf, loading: false, svg } : inf
            ));
          }
        } catch {
          setInfographics((prev) => prev.map((inf, j) =>
            j === i ? { ...inf, loading: false, error: true } : inf
          ));
        }
      }
      setGenerating(false);
    };

    generateAll();
  }, [archRaw, visualRaw]);

  const downloadSVG = (svg: string, title: string) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}_infographic.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = infographics.filter((i) => i.svg).length;

  if (infographics.length === 0) return null;

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          AI-Generated Infographics
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {completedCount} assets
          </span>
        </h3>
        {generating && (
          <span className="text-[12px] font-semibold text-primary flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating infographic {progress.current} of {progress.total}...
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {infographics.map((inf, i) => (
          <div key={i} className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="relative" style={{ height: 220 }}>
              {inf.loading ? (
                <div className="w-full h-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : inf.svg ? (
                <>
                  <div
                    className="w-full h-full flex items-center justify-center overflow-hidden p-2"
                    dangerouslySetInnerHTML={{ __html: inf.svg }}
                  />
                  <button
                    onClick={() => downloadSVG(inf.svg, inf.moduleTitle)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/90 border border-border shadow-sm flex items-center justify-center hover:bg-white transition-all"
                    title="Download SVG"
                  >
                    <Download className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </>
              ) : inf.error ? (
                <div className="w-full h-full bg-red-50 flex items-center justify-center">
                  <p className="text-[12px] text-red-500">Failed to generate</p>
                </div>
              ) : null}
            </div>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[13px] font-semibold text-foreground truncate">{inf.moduleTitle}</p>
              <p className="text-[11px] text-muted-foreground truncate">{inf.layoutType}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
