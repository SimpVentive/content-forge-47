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

function normalizeSvg(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const hasPreserveAspectRatio = /preserveAspectRatio=/i.test(attrs);
    const cleanedAttrs = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");

    return `<svg${cleanedAttrs} width="100%" height="100%" style="display:block;width:100%;height:100%;"${hasPreserveAspectRatio ? "" : ' preserveAspectRatio="xMidYMid meet"'}>`;
  });
}

const INFOGRAPHIC_SYSTEM_PROMPT = "You are an elite SVG infographic designer for polished corporate eLearning. Generate a sophisticated, presentation-quality SVG infographic that uses the full canvas confidently, with strong visual hierarchy, large readable headings, 3-5 clearly separated content zones, connectors, icons built only from SVG primitives, and disciplined whitespace. Avoid giant empty margins, tiny text, clip-art aesthetics, or toy layouts. The SVG must be self-contained, 1200x800, with no external fonts or images. Use only these colors: #0f172a, #123d78, #355fa8, #4f46e5, #7c3aed, #10b981, #f59e0b, #e8eef9, #f8fafc, #ffffff. Make it feel like a premium consulting slide, not a simple classroom handout. Return only SVG markup.";

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
              systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT,
              userMessage: `Create an infographic for this module: ${modules[i].title}. Key topics: ${modules[i].topics.join(", ")}. Layout type: ${modules[i].layoutType}. Fill the canvas with a confident, information-dense layout, keep labels readable, show a clear learning flow, and make the output feel like a polished modern eLearning visual aid rather than a simplistic poster.`,
            },
          });

          if (error || data?.error) {
            setInfographics((prev) => prev.map((inf, j) =>
              j === i ? { ...inf, loading: false, error: true } : inf
            ));
          } else {
            const svg = normalizeSvg(extractSVG(data.text || ""));
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

      <div className="grid gap-4 xl:grid-cols-2">
        {infographics.map((inf, i) => (
          <div key={i} className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-[900] tracking-tight text-slate-900">{inf.moduleTitle}</p>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4b6592]">{inf.layoutType}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#e8eef9] px-2.5 py-1 text-[10px] font-[900] uppercase tracking-[0.14em] text-[#355fa8]">
                  Infographic
                </span>
              </div>
            </div>
            <div className="relative bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(232,238,249,0.9))] p-4">
              {inf.loading ? (
                <div className="flex aspect-[3/2] w-full items-center justify-center rounded-[18px] border border-slate-200 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : inf.svg ? (
                <>
                  <div
                    className="aspect-[3/2] w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.08)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: inf.svg }}
                  />
                  <button
                    onClick={() => downloadSVG(inf.svg, inf.moduleTitle)}
                    className="absolute right-7 top-7 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 shadow-sm transition-all hover:bg-white"
                    title="Download SVG"
                  >
                    <Download className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </>
              ) : inf.error ? (
                <div className="flex aspect-[3/2] w-full items-center justify-center rounded-[18px] border border-red-200 bg-red-50">
                  <p className="text-[12px] text-red-500">Failed to generate</p>
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-[12px] leading-relaxed text-slate-600">
                Previewing the generated module visual at readable scale. Download keeps the full SVG for reuse.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
