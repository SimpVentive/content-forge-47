/**
 * SCORM Asset Orchestrator - Coordinates asset extraction and bundling
 * Brings together visuals, avatars, audio, and video into a unified asset bundle
 * for SCORM package creation
 */

import JSZip from "jszip";
import type { RawAgentOutputs } from "@/types/agents";
import {
  extractVisualsFromRawOutput,
  countVisualAssets,
  generateVisualReport,
  type ExtractedVisuals,
} from "@/lib/scormVisualExtractor";
import {
  extractAvatarMedia,
  validateAvatarMedia,
  extractNarrationConfig,
  type AvatarMedia,
  type NarrationConfig,
} from "@/lib/scormAvatarExtractor";
import {
  bundleAssets,
  determineOptimalStrategy,
  rewriteAssetsInHtml,
  createAssetManifest,
  type AssetBundle,
  type AssetMap,
  type EmbedStrategy,
} from "@/lib/scormAssetInliner";

export interface AssetOrchestrationConfig {
  trainerId?: string;
  embedStrategy?: EmbedStrategy;
  enableVoiceNarration?: boolean;
  maxAssetSize?: number; // Max size in MB to embed
}

export interface OrchestrationResult {
  success: boolean;
  visuals: ExtractedVisuals;
  avatar: AvatarMedia;
  narration: NarrationConfig;
  assetMap: AssetMap;
  manifest: Array<{ id: string; href: string; type: string }>;
  warnings: string[];
  report: string;
}

/**
 * Main orchestration function - coordinates all asset extraction and bundling
 */
export async function orchestrateAssets(
  rawOutputs: RawAgentOutputs,
  config: AssetOrchestrationConfig = {},
  zip?: JSZip
): Promise<OrchestrationResult> {
  const warnings: string[] = [];
  const {
    trainerId,
    embedStrategy = "data-uri",
    enableVoiceNarration = true,
    maxAssetSize = 5000, // 5GB default
  } = config;

  console.log("[Asset Orchestrator] Starting asset orchestration", {
    trainerId,
    embedStrategy,
    enableVoiceNarration,
  });

  // Step 1: Extract visual assets from agent outputs
  const visuals = extractVisualsFromRawOutput(rawOutputs.visual);
  const visualCounts = countVisualAssets(visuals);

  if (visualCounts.totalAssets === 0) {
    warnings.push("No visual assets found in agent output");
  } else {
    console.log("[Asset Orchestrator] Visual assets extracted:", visualCounts);
  }

  // Step 2: Extract avatar trainer media
  const avatar = extractAvatarMedia(trainerId);
  const avatarValidation = validateAvatarMedia(trainerId);

  if (!avatarValidation.isValid) {
    warnings.push(...avatarValidation.warnings);
  }

  // Step 3: Extract narration configuration
  const narration = extractNarrationConfig(trainerId);

  if (enableVoiceNarration && !narration.enabled) {
    warnings.push("Voice narration requested but no voice configuration available");
  }

  // Step 4: Prepare asset bundle for inlining
  const assetBundle: AssetBundle = {
    visuals: new Map(),
  };

  // Add avatar if available
  if (avatar.imageUrl) {
    assetBundle.avatarImage = {
      url: avatar.imageUrl,
      mimeType: "image/jpeg",
      strategy: embedStrategy,
    };
  }

  // Add visuals
  for (const visual of visuals.allVisuals.values()) {
    if (visual.imageDataUrl) {
      assetBundle.visuals.set(visual.topicTitle, {
        imageUrl: visual.imageDataUrl,
        svgContent: visual.imageSvg,
        mimeType: "image/png",
        strategy: embedStrategy,
      });
    } else if (visual.imageSvg) {
      // SVG-only visual
      assetBundle.visuals.set(visual.topicTitle, {
        svgContent: visual.imageSvg,
        strategy: "data-uri", // SVG always inline
      });
    }
  }

  // Note: Voice narration audio handling deferred to phase that generates TTS
  // For now, narration config is extracted but audio processing happens separately

  // Step 5: Bundle assets according to strategy
  let assetMap: AssetMap;
  try {
    assetMap = await bundleAssets(assetBundle, zip);
  } catch (error) {
    console.error("[Asset Orchestrator] Error bundling assets:", error);
    warnings.push(`Asset bundling failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    assetMap = { visuals: new Map() };
  }

  // Step 6: Generate asset manifest for imsmanifest.xml
  const manifest = createAssetManifest(assetMap);

  // Step 7: Generate comprehensive report
  const report = generateAssetReport({
    visuals,
    avatar,
    narration,
    assetMap,
    manifest,
    warnings,
  });

  console.log("[Asset Orchestrator] Orchestration complete", {
    visualsExtracted: visuals.allVisuals.size,
    assetsInMap: assetMap.visuals.size,
    manifestItems: manifest.length,
    warningCount: warnings.length,
  });

  return {
    success: warnings.length === 0,
    visuals,
    avatar,
    narration,
    assetMap,
    manifest,
    warnings,
    report,
  };
}

/**
 * Applies orchestrated assets to rendered HTML
 * Rewrites URLs to use final asset locations
 */
export function applyAssetsToHtml(html: string, result: OrchestrationResult): string {
  return rewriteAssetsInHtml(html, result.assetMap);
}

/**
 * Generates comprehensive asset report
 */
function generateAssetReport(data: {
  visuals: ExtractedVisuals;
  avatar: AvatarMedia;
  narration: NarrationConfig;
  assetMap: AssetMap;
  manifest: Array<{ id: string; href: string; type: string }>;
  warnings: string[];
}): string {
  const lines: string[] = [];

  lines.push("=== SCORM Asset Orchestration Report ===\n");

  // Visual assets
  lines.push(generateVisualReport(data.visuals));
  lines.push("");

  // Avatar
  lines.push("Avatar Configuration:");
  lines.push(`  Trainer: ${data.avatar.trainerName}`);
  if (data.avatar.imageUrl) {
    lines.push(`  Image: ${data.avatar.imageUrl.substring(0, 50)}...`);
  }
  if (data.avatar.voiceName) {
    lines.push(`  Voice: ${data.avatar.voiceName}`);
  }
  lines.push("");

  // Narration
  lines.push("Narration Configuration:");
  lines.push(`  Enabled: ${data.narration.enabled}`);
  if (data.narration.voiceName) {
    lines.push(`  Voice: ${data.narration.voiceName}`);
  }
  lines.push("");

  // Asset Map Summary
  lines.push("Asset Map Summary:");
  lines.push(`  Avatar: ${data.assetMap.avatar ? "✓" : "✗"}`);
  lines.push(`  Narration: ${data.assetMap.narration ? "✓" : "✗"}`);
  lines.push(`  Visuals: ${data.assetMap.visuals.size}/${data.visuals.allVisuals.size}`);
  lines.push("");

  // Manifest
  lines.push(`Manifest Items: ${data.manifest.length}`);
  data.manifest.slice(0, 10).forEach((item) => {
    lines.push(`  - ${item.id}: ${item.type}`);
  });
  if (data.manifest.length > 10) {
    lines.push(`  ... and ${data.manifest.length - 10} more`);
  }
  lines.push("");

  // Warnings
  if (data.warnings.length > 0) {
    lines.push("Warnings:");
    data.warnings.forEach((warning) => {
      lines.push(`  ⚠ ${warning}`);
    });
  } else {
    lines.push("✓ No warnings");
  }

  return lines.join("\n");
}

/**
 * Extracts specific asset by type and identifier
 */
export function getAssetUrl(result: OrchestrationResult, type: "avatar" | "narration" | "visual", id?: string): string | undefined {
  switch (type) {
    case "avatar":
      return result.assetMap.avatar;
    case "narration":
      return result.assetMap.narration;
    case "visual":
      return id ? result.assetMap.visuals.get(id) : undefined;
    default:
      return undefined;
  }
}

/**
 * Validates orchestration result for SCORM compliance
 */
export function validateOrchestrationResult(result: OrchestrationResult): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [...result.warnings];

  // Check for critical issues
  if (result.visuals.allVisuals.size === 0) {
    warnings.push("No visual assets extracted - course will have minimal visual context");
  }

  if (!result.assetMap.avatar) {
    warnings.push("No avatar image embedded - trainer view will be text-only");
  }

  if (!result.assetMap.narration && result.narration.enabled) {
    warnings.push("Voice narration enabled but no audio asset embedded");
  }

  if (result.manifest.length === 0) {
    errors.push("No assets in manifest - SCORM package may not work");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
