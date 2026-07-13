/**
 * SCORM Asset Inliner - Handles embedding and referencing assets in SCORM packages
 * Supports both data-uri embedding and file-reference strategies
 */

import JSZip from "jszip";

export type EmbedStrategy = "data-uri" | "file-reference";

export interface AssetBundle {
  avatarImage?: {
    url: string;
    mimeType: string;
    strategy: EmbedStrategy;
  };
  narrationAudio?: {
    url: string;
    mimeType: string;
    strategy: EmbedStrategy;
  };
  visuals: Map<string, {
    imageUrl?: string;
    svgContent?: string;
    mimeType?: string;
    strategy: EmbedStrategy;
  }>;
}

export interface AssetMap {
  avatar?: string;
  narration?: string;
  visuals: Map<string, string>; // topicTitle -> URL or data URI
}

/**
 * Determines the best embed strategy based on asset size and type
 * - Small images (<100KB) → data-uri
 * - Large images/audio → file-reference
 * - SVG → inline always
 */
export async function determineOptimalStrategy(
  url: string,
  mimeType: string
): Promise<EmbedStrategy> {
  if (mimeType.startsWith("image/svg") || url.includes("<svg")) {
    return "data-uri"; // SVG always inline
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const sizeKb = blob.size / 1024;

    // Heuristic: embed small assets, reference larger ones
    // Audio files often exceed 100KB, so use file-reference by default
    if (mimeType.startsWith("audio/")) {
      return "file-reference";
    }

    return sizeKb < 100 ? "data-uri" : "file-reference";
  } catch {
    // On error, assume data-uri for safety
    return "data-uri";
  }
}

/**
 * Converts URLs to base64 data URIs
 * Handles both remote URLs and existing data URIs
 */
export async function urlToDataUri(url: string, mimeType: string): Promise<string> {
  if (!url) return "";

  // Already a data URI
  if (url.startsWith("data:")) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch URL: ${url} (${response.status})`);
      return "";
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = String.fromCharCode(...bytes);
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`Failed to convert URL to data URI: ${url}`, error);
    return "";
  }
}

/**
 * Adds asset to ZIP file with appropriate folder structure
 */
export async function addAssetToZip(
  zip: JSZip,
  assetType: "images" | "audio" | "videos",
  filename: string,
  url: string
): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch asset: ${url}`);
      return "";
    }

    const blob = await response.blob();
    const relativeUrl = `assets/${assetType}/${filename}`;
    zip.file(relativeUrl, blob);
    return relativeUrl;
  } catch (error) {
    console.warn(`Failed to add asset to ZIP: ${filename}`, error);
    return "";
  }
}

/**
 * Processes and bundles all assets for SCORM package
 * Returns a map of asset identifiers to their final URLs (data-uri or relative path)
 */
export async function bundleAssets(
  bundle: AssetBundle,
  zip?: JSZip
): Promise<AssetMap> {
  const assetMap: AssetMap = {
    visuals: new Map(),
  };

  // Process avatar
  if (bundle.avatarImage) {
    const { url, mimeType, strategy } = bundle.avatarImage;
    if (strategy === "data-uri") {
      assetMap.avatar = await urlToDataUri(url, mimeType);
    } else if (zip) {
      assetMap.avatar = await addAssetToZip(zip, "images", "avatar.jpg", url);
    }
  }

  // Process narration audio
  if (bundle.narrationAudio) {
    const { url, mimeType, strategy } = bundle.narrationAudio;
    if (strategy === "data-uri") {
      assetMap.narration = await urlToDataUri(url, mimeType);
    } else if (zip) {
      assetMap.narration = await addAssetToZip(zip, "audio", "narration.mp3", url);
    }
  }

  // Process visuals
  for (const [topicTitle, visual] of bundle.visuals) {
    const assetKey = topicTitle.toLowerCase().replace(/\s+/g, "-");

    // Process image
    if (visual.imageUrl) {
      if (visual.strategy === "data-uri") {
        const dataUri = await urlToDataUri(visual.imageUrl, visual.mimeType || "image/png");
        if (dataUri) {
          assetMap.visuals.set(topicTitle, dataUri);
        }
      } else if (zip) {
        const filename = `${assetKey}.png`;
        const relativePath = await addAssetToZip(zip, "images", filename, visual.imageUrl);
        if (relativePath) {
          assetMap.visuals.set(topicTitle, relativePath);
        }
      }
    }
    // Note: SVG content is inlined directly in HTML, not stored separately
  }

  console.log("[Asset Bundler] Asset bundling complete:", {
    hasAvatar: !!assetMap.avatar,
    hasNarration: !!assetMap.narration,
    visualCount: assetMap.visuals.size,
  });

  return assetMap;
}

/**
 * Inlines SVG assets directly into HTML markup
 * Sanitizes SVG to prevent XSS
 */
export function inlineSvgAsset(svg: string): string {
  if (!svg || !svg.includes("<svg")) {
    return "";
  }

  // Basic sanitization: remove script tags and event handlers
  let sanitized = svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");

  // Ensure viewBox is set for responsive scaling
  if (!sanitized.includes("viewBox")) {
    sanitized = sanitized.replace(
      /<svg([^>]*?)>/i,
      '<svg$1 viewBox="0 0 1200 800">'
    );
  }

  return sanitized;
}

/**
 * Rewrites asset URLs in HTML for offline SCORM
 * Converts data-uri and absolute paths to relative ZIP paths
 */
export function rewriteAssetsInHtml(html: string, assetMap: AssetMap): string {
  let rewritten = html;

  // Replace avatar references
  if (assetMap.avatar) {
    rewritten = rewritten.replace(
      /src=["'][^"']*avatar[^"']*["']/gi,
      `src="${assetMap.avatar}"`
    );
  }

  // Replace narration audio references
  if (assetMap.narration) {
    rewritten = rewritten.replace(
      /<source[^>]*src=["'][^"']*narration[^"']*["'][^>]*>/gi,
      `<source src="${assetMap.narration}" type="audio/mpeg">`
    );
  }

  // Replace visual asset references
  for (const [topicTitle, assetUrl] of assetMap.visuals) {
    const encodedTitle = topicTitle.replace(/['"]/g, '\\"');
    const regex = new RegExp(
      `src=["'](?:[^"']*?${encodedTitle}[^"']*?|[^"']*?)["']`,
      "gi"
    );
    rewritten = rewritten.replace(regex, `src="${assetUrl}"`);
  }

  return rewritten;
}

/**
 * Creates asset manifest for SCORM imsmanifest.xml
 * Lists all resources that are part of the package
 */
export function createAssetManifest(assetMap: AssetMap): Array<{
  id: string;
  href: string;
  type: string;
}> {
  const manifest: Array<{ id: string; href: string; type: string }> = [];

  if (assetMap.avatar) {
    manifest.push({
      id: "avatar-image",
      href: assetMap.avatar,
      type: "image/jpeg",
    });
  }

  if (assetMap.narration) {
    manifest.push({
      id: "narration-audio",
      href: assetMap.narration,
      type: "audio/mpeg",
    });
  }

  let visualIndex = 1;
  for (const [topicTitle, url] of assetMap.visuals) {
    manifest.push({
      id: `visual-${visualIndex}`,
      href: url,
      type: url.startsWith("data:") ? "image/png" : "image/png",
    });
    visualIndex++;
  }

  return manifest;
}
