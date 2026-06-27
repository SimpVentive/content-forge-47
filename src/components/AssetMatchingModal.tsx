import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { getUserAssets, getSimilarAssetPreferences, getSignedAssetUrl } from '@/lib/assetStorage';
import { matchAssetsToContent, findSlidesThatMention } from '@/utils/assetMatching';
import type { Database } from '@/integrations/supabase/types';

type UserAsset = Database['public']['Tables']['user_assets']['Row'];

interface SlideData {
  slideNumber: number;
  title: string;
  content: string;
}

interface AssetMatchResult {
  assetId: string;
  filename: string;
  tags: string[];
  confidence: number;
  slideNumbers: number[];
  slideCount: number;
  selected: boolean;
  storageUrl: string;
  signedUrl?: string;
}

interface AssetMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (selectedAssetIds: string[]) => void;
  courseContent: string;
  slides: SlideData[];
  userId: string;
  courseType?: string;
}

export const AssetMatchingModal: React.FC<AssetMatchingModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  courseContent,
  slides,
  userId,
  courseType,
}) => {
  const [loading, setLoading] = useState(true);
  const [matchedAssets, setMatchedAssets] = useState<AssetMatchResult[]>([]);
  const [unmatchedTerms, setUnmatchedTerms] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [hasPreference, setHasPreference] = useState(false);
  const [preferenceCourseType, setPreferenceCourseType] = useState<string>('');
  const [showPreferenceSuggestion, setShowPreferenceSuggestion] = useState(false);

  // Load and match assets when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAndMatchAssets();
    }
  }, [isOpen]);

  const loadAndMatchAssets = async () => {
    setLoading(true);
    try {
      // Get user's assets
      const userAssets = await getUserAssets(userId);

      if (userAssets.length === 0) {
        setMatchedAssets([]);
        setUnmatchedTerms([]);
        setShowPreferenceSuggestion(false);
        setLoading(false);
        return;
      }

      // Match assets to content
      const matchResults = matchAssetsToContent(
        courseContent,
        slides,
        userAssets
      );

      // Convert to display format with signed URLs
      const enhancedMatches: AssetMatchResult[] = await Promise.all(
        matchResults.matched.map(async (match) => {
          const asset = userAssets.find((a) => a.id === match.assetId);
          let signedUrl: string | undefined;

          if (asset) {
            signedUrl = await getSignedAssetUrl(asset.storage_url);
          }

          return {
            ...match,
            signedUrl: signedUrl || undefined,
          };
        })
      );

      setMatchedAssets(enhancedMatches);
      setUnmatchedTerms(matchResults.unmatched);

      // Pre-select all matched assets
      const matchedIds = new Set(enhancedMatches.map((m) => m.assetId));
      setSelectedAssets(matchedIds);

      // Check for previous preferences
      if (courseType) {
        const preference = await getSimilarAssetPreferences(userId, courseType);
        if (preference) {
          setHasPreference(true);
          setPreferenceCourseType(preference.courseType);
          setShowPreferenceSuggestion(true);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load assets:', error);
      toast.error('Failed to load assets');
      setLoading(false);
    }
  };

  const handleSelectAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const toggleExpandAsset = (assetId: string) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(assetId)) {
      newExpanded.delete(assetId);
    } else {
      newExpanded.add(assetId);
    }
    setExpandedAssets(newExpanded);
  };

  const applyPreviousPreference = async () => {
    if (courseType) {
      const preference = await getSimilarAssetPreferences(userId, courseType);
      if (preference) {
        setSelectedAssets(new Set(preference.selectedAssetIds));
        setShowPreferenceSuggestion(false);
        toast.success('Applied previous preferences');
      }
    }
  };

  const handleProceed = () => {
    onProceed(Array.from(selectedAssets));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Asset Matching</h2>
            <p className="text-sm text-slate-500 mt-1">
              Checking your assets against course content...
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="ml-3 text-slate-600">Scanning for matching assets...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preference Suggestion */}
              {showPreferenceSuggestion && hasPreference && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        Last time you created a {preferenceCourseType} course, you used these assets:
                      </p>
                      <button
                        onClick={applyPreviousPreference}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                      >
                        Apply same preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Matched Assets */}
              {matchedAssets.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
                    ✅ Matched Assets ({matchedAssets.length})
                  </h3>
                  <div className="space-y-2">
                    {matchedAssets.map((asset) => (
                      <div
                        key={asset.assetId}
                        className="rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-all"
                      >
                        {/* Asset Header */}
                        <div
                          className="p-4 flex items-start gap-3 cursor-pointer"
                          onClick={() => toggleExpandAsset(asset.assetId)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssets.has(asset.assetId)}
                            onChange={() => handleSelectAsset(asset.assetId)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-4 h-4 text-teal-600 rounded cursor-pointer"
                          />

                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 break-words">
                              {asset.filename}
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">
                              Appears in: {asset.slideNumbers.map((n) => `Slide ${n}`).join(', ')}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {asset.slideCount} slide{asset.slideCount !== 1 ? 's' : ''} •{' '}
                              {asset.confidence}% confidence
                            </p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {asset.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {expandedAssets.has(asset.assetId) ? (
                            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                          )}
                        </div>

                        {/* Expanded Preview */}
                        {expandedAssets.has(asset.assetId) && (
                          <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-3">
                            {/* Thumbnail Preview */}
                            {asset.signedUrl && (
                              <div>
                                <p className="text-xs font-medium text-slate-700 mb-2">Preview</p>
                                <img
                                  src={asset.signedUrl}
                                  alt={asset.filename}
                                  className="w-full h-40 object-cover rounded-lg border border-slate-200"
                                />
                              </div>
                            )}

                            {/* Slide Details */}
                            <div>
                              <p className="text-xs font-medium text-slate-700 mb-2">
                                Detailed slide mapping:
                              </p>
                              <div className="space-y-1">
                                {asset.slideNumbers.map((slideNum) => {
                                  const slide = slides.find((s) => s.slideNumber === slideNum);
                                  return (
                                    <div key={slideNum} className="text-xs text-slate-600 pl-3 py-1">
                                      <span className="font-medium text-slate-700">
                                        Slide {slideNum}:
                                      </span>{' '}
                                      {slide?.title || 'Untitled'}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched Terms */}
              {unmatchedTerms.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    No assets found for:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unmatchedTerms.map((term) => (
                      <span
                        key={term}
                        className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-2">
                    These will be generated with Flux AI during course creation.
                  </p>
                </div>
              )}

              {/* No Matches */}
              {matchedAssets.length === 0 && unmatchedTerms.length === 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">No matching assets found in your library.</p>
                  <p className="text-sm text-slate-500 mt-2">
                    All course images will be generated with Flux AI.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
          >
            Skip Assets & Generate
          </button>
          <button
            onClick={handleProceed}
            disabled={loading || selectedAssets.size === 0}
            className="flex-1 px-4 py-3 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Generate with Selected
          </button>
        </div>
      </div>
    </div>
  );
};
