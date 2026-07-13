/**
 * Unit Tests for Phase 3: Asset Handling
 * Tests visual extraction, avatar extraction, asset inlining, orchestration
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractVisualsFromRawOutput,
  findVisualByTopic,
  countVisualAssets,
} from '@/lib/scormVisualExtractor';
import {
  extractAvatarMedia,
  validateAvatarMedia,
} from '@/lib/scormAvatarExtractor';
import {
  rewriteAssetsInHtml,
  createAssetManifest,
} from '@/lib/scormAssetInliner';

describe('Phase 3: Asset Handling Tests', () => {
  describe('scormVisualExtractor', () => {
    describe('extractVisualsFromRawOutput', () => {
      it('should parse standard visual output format', () => {
        const output = JSON.stringify({
          modules: [
            {
              module_title: 'Module 1',
              topic_visuals: [
                {
                  topic_title: 'Topic 1',
                  generated_image_data_url: 'data:image/png;base64,...',
                  generated_scene_svg: '<svg></svg>',
                },
              ],
            },
          ],
        });

        const result = extractVisualsFromRawOutput(output);
        expect(result.modules.length).toBe(1);
        expect(result.allVisuals.size).toBe(1);
      });

      it('should handle alternative JSON structures', () => {
        // Test course_visual_plan format
        const output1 = JSON.stringify({
          course_visual_plan: {
            modules: [
              {
                module_title: 'Module 1',
                topic_visuals: [
                  { topic_title: 'Topic 1', generated_image_data_url: 'img.jpg' },
                ],
              },
            ],
          },
        });

        const result1 = extractVisualsFromRawOutput(output1);
        expect(result1.modules.length).toBe(1);

        // Test module_visuals format
        const output2 = JSON.stringify({
          module_visuals: [
            {
              module_title: 'Module 1',
              topic_visuals: [
                { topic_title: 'Topic 1', generated_image_data_url: 'img.jpg' },
              ],
            },
          ],
        });

        const result2 = extractVisualsFromRawOutput(output2);
        expect(result2.modules.length).toBe(1);
      });

      it('should validate image URLs', () => {
        const output = JSON.stringify({
          modules: [
            {
              module_title: 'Module 1',
              topic_visuals: [
                {
                  topic_title: 'Topic 1',
                  generated_image_data_url: 'data:image/png;base64,iVBORw0KGgo',
                },
              ],
            },
          ],
        });

        const result = extractVisualsFromRawOutput(output);
        const visual = result.allVisuals.get('topic 1');
        expect(visual?.imageDataUrl).toContain('data:image');
      });

      it('should validate SVG content', () => {
        const output = JSON.stringify({
          modules: [
            {
              module_title: 'Module 1',
              topic_visuals: [
                {
                  topic_title: 'Topic 1',
                  generated_scene_svg: '<svg viewBox="0 0 100 100"></svg>',
                },
              ],
            },
          ],
        });

        const result = extractVisualsFromRawOutput(output);
        const visual = result.allVisuals.get('topic 1');
        expect(visual?.imageSvg).toContain('<svg');
      });

      it('should handle missing visual data gracefully', () => {
        const result = extractVisualsFromRawOutput('');
        expect(result.modules.length).toBe(0);
        expect(result.allVisuals.size).toBe(0);
      });

      it('should handle invalid JSON gracefully', () => {
        const result = extractVisualsFromRawOutput('not valid json {[]');
        expect(result.modules.length).toBe(0);
      });
    });

    describe('findVisualByTopic', () => {
      it('should find exact match', () => {
        const visuals = {
          allVisuals: new Map([
            ['product management', { topicTitle: 'Product Management', imageDataUrl: 'img.jpg' }],
          ]),
          modules: [],
        };

        const result = findVisualByTopic(visuals, 'product management');
        expect(result).toBeDefined();
        expect(result?.imageDataUrl).toBe('img.jpg');
      });

      it('should find fuzzy match', () => {
        const visuals = {
          allVisuals: new Map([
            ['product mgmt', { topicTitle: 'Product Mgmt', imageDataUrl: 'img.jpg' }],
          ]),
          modules: [],
        };

        const result = findVisualByTopic(visuals, 'product management');
        expect(result).toBeDefined();
      });

      it('should return first visual as fallback', () => {
        const visual1 = { topicTitle: 'Topic 1', imageDataUrl: 'img1.jpg' };
        const visuals = {
          allVisuals: new Map(),
          modules: [{ visuals: [visual1] }],
        };

        const result = findVisualByTopic(visuals, 'nonexistent topic');
        expect(result).toBe(visual1);
      });

      it('should return undefined if no match found', () => {
        const visuals = {
          allVisuals: new Map(),
          modules: [],
        };

        const result = findVisualByTopic(visuals, 'nonexistent');
        expect(result).toBeUndefined();
      });
    });

    describe('countVisualAssets', () => {
      it('should count images and SVGs correctly', () => {
        const visuals = {
          allVisuals: new Map([
            ['topic1', { imageDataUrl: 'img1.jpg' }],
            ['topic2', { imageDataUrl: 'img2.jpg', imageSvg: '<svg></svg>' }],
            ['topic3', { imageSvg: '<svg></svg>' }],
          ]),
          modules: [],
        };

        const counts = countVisualAssets(visuals);
        expect(counts.totalImages).toBe(2);
        expect(counts.totalSvgs).toBe(2);
        expect(counts.totalAssets).toBe(3);
      });
    });
  });

  describe('scormAvatarExtractor', () => {
    describe('extractAvatarMedia', () => {
      it('should return default avatar if no trainer', () => {
        const avatar = extractAvatarMedia();
        expect(avatar.trainerName).toBe('Trainer');
      });

      it('should handle trainer not found gracefully', () => {
        const avatar = extractAvatarMedia('nonexistent_trainer');
        expect(avatar.trainerName).toBeDefined();
      });
    });

    describe('validateAvatarMedia', () => {
      it('should return invalid if no trainer selected', () => {
        const validation = validateAvatarMedia();
        expect(validation.isValid).toBe(false);
        expect(validation.warnings.length).toBeGreaterThan(0);
      });

      it('should warn if trainer has no media', () => {
        const validation = validateAvatarMedia('invalid_id');
        expect(validation.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('scormAssetInliner', () => {
    describe('rewriteAssetsInHtml', () => {
      it('should replace avatar src attribute', () => {
        const html = '<img src="avatar.jpg" alt="trainer"/>';
        const assetMap = {
          avatar: 'data:image/jpeg;base64,/9j/4AAQSkZJRg',
          visuals: new Map(),
        };

        const result = rewriteAssetsInHtml(html, assetMap);
        expect(result).toContain('data:image/jpeg');
        expect(result).not.toContain('avatar.jpg');
      });

      it('should replace audio source URLs', () => {
        const html = '<source src="narration.mp3" type="audio/mpeg">';
        const assetMap = {
          narration: 'assets/audio/narration.mp3',
          visuals: new Map(),
        };

        const result = rewriteAssetsInHtml(html, assetMap);
        expect(result).toContain('assets/audio/narration.mp3');
        expect(result).not.toContain('narration.mp3');
      });

      it('should replace visual image URLs', () => {
        const html = '<img src="topic1_visual.png" />';
        const assetMap = {
          visuals: new Map([
            ['Topic 1', 'data:image/png;base64,iVBORw0KGgo'],
          ]),
        };

        const result = rewriteAssetsInHtml(html, assetMap);
        expect(result).toContain('data:image/png');
      });

      it('should not modify URLs that do not match assets', () => {
        const html = '<img src="external.jpg" />';
        const assetMap = {
          visuals: new Map(),
        };

        const result = rewriteAssetsInHtml(html, assetMap);
        expect(result).toContain('external.jpg');
      });
    });

    describe('createAssetManifest', () => {
      it('should create manifest for avatar asset', () => {
        const assetMap = {
          avatar: 'data:image/jpeg;base64,/9j/4AAQSkZJRg',
          visuals: new Map(),
        };

        const manifest = createAssetManifest(assetMap);
        const avatarItem = manifest.find((item) => item.id === 'avatar-image');
        expect(avatarItem).toBeDefined();
        expect(avatarItem?.type).toBe('image/jpeg');
      });

      it('should create manifest for narration audio', () => {
        const assetMap = {
          narration: 'assets/audio/narration.mp3',
          visuals: new Map(),
        };

        const manifest = createAssetManifest(assetMap);
        const audioItem = manifest.find((item) => item.id === 'narration-audio');
        expect(audioItem).toBeDefined();
        expect(audioItem?.type).toBe('audio/mpeg');
      });

      it('should create manifest entries for visual assets', () => {
        const assetMap = {
          visuals: new Map([
            ['Topic 1', 'data:image/png;base64,iVBORw0KGgo'],
            ['Topic 2', 'data:image/png;base64,iVBORw0KGgo'],
          ]),
        };

        const manifest = createAssetManifest(assetMap);
        const visualItems = manifest.filter((item) => item.id.startsWith('visual-'));
        expect(visualItems.length).toBe(2);
      });

      it('should return empty array for no assets', () => {
        const assetMap = {
          visuals: new Map(),
        };

        const manifest = createAssetManifest(assetMap);
        expect(manifest.length).toBe(0);
      });
    });
  });

  describe('scormAssetOrchestrator', () => {
    it('should coordinate asset extraction', async () => {
      const { orchestrateAssets } = require('@/lib/scormAssetOrchestrator');

      const rawOutputs = {
        visual: JSON.stringify({
          modules: [
            {
              module_title: 'Module 1',
              topic_visuals: [
                { topic_title: 'Topic 1', generated_image_data_url: 'img.jpg' },
              ],
            },
          ],
        }),
      };

      const result = await orchestrateAssets(rawOutputs);
      expect(result.visuals).toBeDefined();
      expect(result.assetMap).toBeDefined();
      expect(result.manifest).toBeDefined();
    });

    it('should handle missing data gracefully', async () => {
      const { orchestrateAssets } = require('@/lib/scormAssetOrchestrator');

      const result = await orchestrateAssets({});
      expect(result.success).toBe(true);
      expect(result.visuals.allVisuals.size).toBe(0);
    });
  });
});
