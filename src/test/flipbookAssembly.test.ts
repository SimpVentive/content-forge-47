import { describe, expect, it } from 'vitest';
import { generateFlipbookHTML } from '@/lib/flipbookGenerator';
import { prependTitleSlideToNarratives, type TopicNarrative } from '@/lib/visualNarrativeService';

const course: TopicNarrative[] = [{
  topicTitle: 'Camera selection', topicObjective: 'Choose the appropriate camera', sceneCount: 2,
  totalNarrativeText: 'First lesson. Second lesson.',
  scenes: [1, 2].map(number => ({ sceneNumber: number, title: `Lesson ${number}`, caption: `Complete lesson ${number}.`, narration: `Explain lesson ${number}.`, imagePrompt: 'Camera', imageDataUrl: `data:image/png;base64,scene${number}` })),
}];

describe('image-course assembly', () => {
  it('merges the synthetic title into the cover without dropping either teaching scene or image', () => {
    const html = generateFlipbookHTML(prependTitleSlideToNarratives(course, 'CCTV Sales'), 'CCTV Sales', 'smooth-slide', true);
    const document = new DOMParser().parseFromString(html, 'text/html');
    const pages = Array.from(document.querySelectorAll('.page'));
    expect(pages).toHaveLength(4);
    expect(pages.map(p => p.querySelector('.page-title')?.textContent)).toEqual(['CCTV Sales', 'Course Overview', 'Lesson 1', 'Lesson 2']);
    expect(pages[2].querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,scene1');
    expect(pages[3].textContent).toContain('Complete lesson 2.');
    expect(pages[0].querySelector('.narration-text')?.textContent).toContain('Welcome to CCTV Sales');
  });
  it('does not play a legacy difficulty label as cover narration', () => {
    const html = generateFlipbookHTML(prependTitleSlideToNarratives(course, 'CCTV Sales', 'intermediate'), 'CCTV Sales', 'smooth-slide', true);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('.narration-text')?.textContent).toBe('Welcome to CCTV Sales.');
  });
});