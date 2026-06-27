/**
 * Asset Matching Algorithm
 * Matches course content to user assets based on tags
 */

import type { Database } from '@/integrations/supabase/types';

type UserAsset = Database['public']['Tables']['user_assets']['Row'];

export interface AssetMatch {
  assetId: string;
  filename: string;
  tags: string[];
  confidence: number;
  slideNumbers: number[];
  slideCount: number;
  selected: boolean;
  storageUrl: string;
  thumbnailUrl?: string;
}

export interface MatchingResult {
  matched: AssetMatch[];
  unmatched: string[];
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string): Set<string> {
  // Split into words and normalize
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  // Remove common words
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
  ]);

  const keywords = new Set<string>();
  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9-]/g, '');
    if (cleaned.length > 2 && !stopwords.has(cleaned)) {
      keywords.add(cleaned);
    }
  }

  return keywords;
}

/**
 * Calculate confidence score for a tag match
 */
function calculateConfidence(
  tag: string,
  contentKeywords: Set<string>,
  context: string
): number {
  // Exact match
  if (contentKeywords.has(tag)) {
    return 95;
  }

  // Substring match
  for (const keyword of contentKeywords) {
    if (keyword.includes(tag) || tag.includes(keyword)) {
      return 80;
    }
  }

  // Context match (word appears in surrounding context)
  if (context.toLowerCase().includes(tag)) {
    return 70;
  }

  return 0;
}

/**
 * Find which slides mention a specific tag
 */
export function findSlidesThatMention(
  tag: string,
  slides: Array<{ slideNumber: number; content: string; title: string }>
): number[] {
  const slideNumbers: number[] = [];
  const tagLower = tag.toLowerCase();

  for (const slide of slides) {
    const content = `${slide.title} ${slide.content}`.toLowerCase();
    if (content.includes(tagLower)) {
      slideNumbers.push(slide.slideNumber);
    }
  }

  return slideNumbers;
}

/**
 * Match assets to course content
 */
export function matchAssetsToContent(
  courseContent: string,
  slides: Array<{ slideNumber: number; content: string; title: string }>,
  userAssets: UserAsset[]
): MatchingResult {
  const contentKeywords = extractKeywords(courseContent);
  const matched: AssetMatch[] = [];
  const matchedAssetIds = new Set<string>();
  const unmatched: string[] = [];

  // Find matches for each asset
  for (const asset of userAssets) {
    let bestConfidence = 0;
    let assetSlideNumbers: number[] = [];

    // Check each tag
    for (const tag of asset.tags) {
      const confidence = calculateConfidence(tag, contentKeywords, courseContent);

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        assetSlideNumbers = findSlidesThatMention(tag, slides);
      }
    }

    // Add to matched if found
    if (bestConfidence > 0 && assetSlideNumbers.length > 0) {
      matched.push({
        assetId: asset.id,
        filename: asset.filename,
        tags: asset.tags,
        confidence: bestConfidence,
        slideNumbers: assetSlideNumbers,
        slideCount: assetSlideNumbers.length,
        selected: true, // Pre-select matched assets
        storageUrl: asset.storage_url,
      });
      matchedAssetIds.add(asset.id);
    }
  }

  // Find unmatched common terms
  const commonTerms = [
    'reactor', 'vessel', 'equipment', 'distillation', 'column', 'valve',
    'control', 'panel', 'safety', 'procedure', 'instrument', 'pump',
    'compressor', 'gauge', 'facility', 'lab', 'pipe'
  ];

  for (const term of commonTerms) {
    if (contentKeywords.has(term) && !matchedAssetIds.has(term)) {
      // Check if any asset should have covered this
      const hasMatchingAsset = userAssets.some((asset) =>
        asset.tags.some((tag) => tag.toLowerCase().includes(term))
      );
      if (!hasMatchingAsset) {
        unmatched.push(term);
      }
    }
  }

  // Sort matched by confidence (highest first)
  matched.sort((a, b) => b.confidence - a.confidence);

  return {
    matched,
    unmatched: [...new Set(unmatched)], // Remove duplicates
  };
}

/**
 * Find matching asset in selected assets during generation
 */
export function findMatchingAsset(
  slideContent: string,
  slideTitle: string,
  selectedAssets: Array<{
    id: string;
    tags: string[];
    storageUrl: string;
  }>
): { id: string; storageUrl: string } | null {
  const slideKeywords = extractKeywords(`${slideTitle} ${slideContent}`);

  for (const asset of selectedAssets) {
    for (const tag of asset.tags) {
      if (slideKeywords.has(tag) || slideKeywords.has(tag.toLowerCase())) {
        return {
          id: asset.id,
          storageUrl: asset.storageUrl,
        };
      }

      // Check substring match
      for (const keyword of slideKeywords) {
        if (keyword.includes(tag.toLowerCase()) || tag.toLowerCase().includes(keyword)) {
          return {
            id: asset.id,
            storageUrl: asset.storageUrl,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Calculate similarity score between two sets of keywords
 */
export function calculateSimilarity(
  keywords1: string[],
  keywords2: string[]
): number {
  if (keywords1.length === 0 || keywords2.length === 0) {
    return 0;
  }

  const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
  const set2 = new Set(keywords2.map((k) => k.toLowerCase()));

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate SHA256 hash of content for similarity matching
 */
export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
