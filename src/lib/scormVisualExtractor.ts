/**
 * SCORM Visual Extractor - Parses and validates visual data from raw agent outputs
 * Handles multiple visual formats and field name variations
 */

import { tryParseJSON } from "@/lib/slideBuilder";

export interface VisualAsset {
  topicTitle: string;
  imageDataUrl?: string;
  imageSvg?: string;
  imagePrompt?: string;
  imageApproved?: boolean;
  altText?: string;
  placement?: "hero" | "side-panel" | "inline-card";
  screenTemplate?: "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel";
}

export interface ModuleVisuals {
  moduleTitle: string;
  infographicDescription?: string;
  infographicSvg?: string;
  visuals: VisualAsset[];
}

export interface ExtractedVisuals {
  modules: ModuleVisuals[];
  allVisuals: Map<string, VisualAsset>;
}

/**
 * Extracts visual asset data from raw visual agent output
 * Handles multiple possible JSON structures and field name variations
 */
export function extractVisualsFromRawOutput(rawVisualOutput: string | undefined): ExtractedVisuals {
  const allVisuals = new Map<string, VisualAsset>();
  const modules: ModuleVisuals[] = [];

  if (!rawVisualOutput) {
    console.warn("[Visual Extractor] No visual output provided");
    return { modules, allVisuals };
  }

  const visualData = tryParseJSON(rawVisualOutput);
  if (!visualData) {
    console.warn("[Visual Extractor] Failed to parse visual data as JSON");
    return { modules, allVisuals };
  }

  // Try multiple possible root structures
  const moduleArrays = [
    visualData.modules,
    visualData.course_visual_plan?.modules,
    visualData.module_visuals,
  ].filter(Array.isArray);

  if (moduleArrays.length === 0) {
    console.warn("[Visual Extractor] No modules array found in visual data");
    return { modules, allVisuals };
  }

  const moduleData = moduleArrays[0] || [];

  moduleData.forEach((mod: any, modIndex: number) => {
    const moduleTitle = mod?.module_title || mod?.title || mod?.name || `Module ${modIndex + 1}`;

    // Extract module-level infographic
    const infographicDescription =
      mod?.infographic_description ||
      mod?.infographic ||
      mod?.visual_aid ||
      mod?.diagram_description ||
      mod?.slide_layout;

    const infographicSvg =
      mod?.infographic_svg ||
      mod?.generated_infographic_svg ||
      mod?.infographic;

    // Extract topic visuals
    const topicVisualArrays = [
      mod?.topic_visuals,
      mod?.topics,
      mod?.visuals,
    ].filter(Array.isArray);

    const topicVisuals = topicVisualArrays[0] || [];

    const visuals: VisualAsset[] = topicVisuals.map((visual: any, topicIndex: number) => {
      const topicTitle =
        visual?.topic_title ||
        visual?.title ||
        visual?.name ||
        visual?.topic_name ||
        `Topic ${topicIndex + 1}`;

      // Image data - try multiple field names
      const imageDataUrl =
        visual?.generated_image_data_url ||
        visual?.imageDataUrl ||
        visual?.image_data_url ||
        visual?.image_url ||
        visual?.dataUrl ||
        visual?.data_url;

      // SVG data - try multiple field names
      const imageSvg =
        visual?.generated_scene_svg ||
        visual?.sceneSvg ||
        visual?.scene_svg ||
        visual?.svg ||
        visual?.generated_svg;

      const asset: VisualAsset = {
        topicTitle,
        imageDataUrl: validateDataUrl(imageDataUrl),
        imageSvg: validateSvg(imageSvg),
        imagePrompt: visual?.image_prompt || visual?.prompt,
        imageApproved: Boolean(visual?.image_approved || visual?.approved),
        altText: visual?.alt_text || visual?.altText || visual?.alt,
        placement: validatePlacement(visual?.placement),
        screenTemplate: validateScreenTemplate(visual?.screen_template || visual?.screenTemplate),
      };

      // Add to global map for quick lookup by topic title
      allVisuals.set(topicTitle.toLowerCase(), asset);

      return asset;
    });

    modules.push({
      moduleTitle,
      infographicDescription,
      infographicSvg: validateSvg(infographicSvg),
      visuals,
    });
  });

  console.log("[Visual Extractor] Extracted visuals:", {
    moduleCount: modules.length,
    totalAssets: allVisuals.size,
    modules: modules.map((m) => ({
      title: m.moduleTitle,
      visualCount: m.visuals.length,
      hasInfographic: !!m.infographicSvg,
    })),
  });

  return { modules, allVisuals };
}

/**
 * Validates and normalizes data URL strings
 */
function validateDataUrl(url: any): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();

  // Check if it's a valid data URL
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  // Check if it's a base64 string (no data: prefix yet)
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    // Likely base64, prepend data: prefix
    return `data:image/png;base64,${trimmed}`;
  }

  // Check if it's a regular URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  console.warn("[Visual Extractor] Invalid image URL format:", trimmed.substring(0, 50));
  return undefined;
}

/**
 * Validates SVG content
 */
function validateSvg(svg: any): string | undefined {
  if (!svg || typeof svg !== "string") return undefined;
  const trimmed = svg.trim();

  if (!trimmed.toLowerCase().startsWith("<svg")) {
    console.warn("[Visual Extractor] Invalid SVG: missing <svg tag");
    return undefined;
  }

  if (!trimmed.toLowerCase().includes("</svg>")) {
    console.warn("[Visual Extractor] Invalid SVG: missing closing </svg> tag");
    return undefined;
  }

  return trimmed;
}

/**
 * Validates placement value
 */
function validatePlacement(
  placement: any
): "hero" | "side-panel" | "inline-card" | undefined {
  if (!placement || typeof placement !== "string") return undefined;
  const valid = ["hero", "side-panel", "inline-card"];
  return valid.includes(placement) ? (placement as any) : undefined;
}

/**
 * Validates screen template value
 */
function validateScreenTemplate(
  template: any
): "dashboard" | "guided-notes" | "scenario" | "media-quiz" | "summary-panel" | undefined {
  if (!template || typeof template !== "string") return undefined;
  const valid = ["dashboard", "guided-notes", "scenario", "media-quiz", "summary-panel"];
  return valid.includes(template) ? (template as any) : undefined;
}

/**
 * Finds a visual asset by topic title with fuzzy matching
 */
export function findVisualByTopic(
  visuals: ExtractedVisuals,
  topicTitle: string
): VisualAsset | undefined {
  // Exact lowercase match
  const normalized = topicTitle.toLowerCase();
  if (visuals.allVisuals.has(normalized)) {
    return visuals.allVisuals.get(normalized);
  }

  // Fuzzy match - contains
  for (const [key, asset] of visuals.allVisuals) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return asset;
    }
  }

  // Return first visual as fallback
  if (visuals.modules.length > 0 && visuals.modules[0].visuals.length > 0) {
    return visuals.modules[0].visuals[0];
  }

  return undefined;
}

/**
 * Counts total visual assets available
 */
export function countVisualAssets(visuals: ExtractedVisuals): {
  totalImages: number;
  totalSvgs: number;
  totalAssets: number;
} {
  let totalImages = 0;
  let totalSvgs = 0;

  for (const asset of visuals.allVisuals.values()) {
    if (asset.imageDataUrl) totalImages++;
    if (asset.imageSvg) totalSvgs++;
  }

  return {
    totalImages,
    totalSvgs,
    totalAssets: visuals.allVisuals.size,
  };
}

/**
 * Generates a summary report of visual assets
 */
export function generateVisualReport(visuals: ExtractedVisuals): string {
  const counts = countVisualAssets(visuals);
  const moduleReports = visuals.modules.map((mod) => {
    const withImages = mod.visuals.filter((v) => v.imageDataUrl).length;
    const withSvgs = mod.visuals.filter((v) => v.imageSvg).length;
    return `  ${mod.moduleTitle}: ${mod.visuals.length} visuals (${withImages} images, ${withSvgs} SVGs)`;
  });

  return `Visual Assets Report:
Modules: ${visuals.modules.length}
Total Assets: ${counts.totalAssets}
Images: ${counts.totalImages}
SVGs: ${counts.totalSvgs}

Breakdown:
${moduleReports.join("\n")}`;
}
