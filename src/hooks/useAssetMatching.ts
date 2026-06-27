/**
 * useAssetMatching Hook
 * Manages asset selection modal and preference tracking
 */

import { useState, useCallback } from 'react';
import { hashContent, calculateSimilarity } from '@/utils/assetMatching';
import { saveAssetSelectionPreference } from '@/lib/assetStorage';

interface SlideData {
  slideNumber: number;
  title: string;
  content: string;
}

interface SelectedAsset {
  id: string;
  tags: string[];
  storageUrl: string;
}

export function useAssetMatching() {
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  /**
   * Handle asset selection from modal
   */
  const handleAssetsSelected = useCallback(
    async (selectedAssetIds: string[], assets: any[], courseId: string, userId: string, courseContent: string, courseType?: string) => {
      try {
        // Filter selected assets
        const selected = assets.filter((asset) =>
          selectedAssetIds.includes(asset.id)
        );

        setSelectedAssets(selected);
        setIsModalOpen(false);

        // Save preference for future courses
        if (courseId && userId) {
          const contentHash = await hashContent(courseContent);
          const topicKeywords = extractTopicKeywords(courseContent);

          await saveAssetSelectionPreference(
            userId,
            courseId,
            selectedAssetIds,
            courseType || 'general',
            topicKeywords,
            contentHash
          );
        }

        return selected;
      } catch (error) {
        console.error('Failed to process asset selection:', error);
        return [];
      }
    },
    []
  );

  /**
   * Extract topic keywords from course content
   */
  const extractTopicKeywords = (content: string): string[] => {
    const commonTopics = [
      'reactor', 'vessel', 'equipment', 'distillation', 'column', 'valve',
      'control', 'panel', 'safety', 'procedure', 'instrument', 'pump',
      'compressor', 'gauge', 'facility', 'lab', 'pipe', 'process',
      'system', 'maintenance', 'operation', 'cleaning', 'inspection'
    ];

    const keywords = new Set<string>();
    const contentLower = content.toLowerCase();

    for (const topic of commonTopics) {
      if (contentLower.includes(topic)) {
        keywords.add(topic);
      }
    }

    return Array.from(keywords);
  };

  return {
    selectedAssets,
    isModalOpen,
    openModal,
    closeModal,
    handleAssetsSelected,
  };
}
