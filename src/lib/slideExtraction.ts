/**
 * Slide Extraction Utilities
 * Extract slide data for asset matching
 */

interface ExtractedSlide {
  slideNumber: number;
  title: string;
  content: string;
}

/**
 * Extract slides from course output data
 * Handles various course formats and structures
 */
export function extractSlidesFromCourseData(courseData: any): ExtractedSlide[] {
  const slides: ExtractedSlide[] = [];

  try {
    // Handle structured slide data
    if (courseData.slides && Array.isArray(courseData.slides)) {
      return courseData.slides.map((slide: any, index: number) => ({
        slideNumber: index + 1,
        title: slide.title || slide.heading || `Slide ${index + 1}`,
        content: slide.content || slide.body || slide.description || '',
      }));
    }

    // Handle modules with topics
    if (courseData.modules && Array.isArray(courseData.modules)) {
      let slideNum = 1;
      for (const module of courseData.modules) {
        // Module title slide
        if (module.title) {
          slides.push({
            slideNumber: slideNum++,
            title: module.title,
            content: module.description || module.overview || '',
          });
        }

        // Topic slides
        if (module.topics && Array.isArray(module.topics)) {
          for (const topic of module.topics) {
            slides.push({
              slideNumber: slideNum++,
              title: topic.title || topic.name || 'Topic',
              content: topic.content || topic.description || topic.narrative || '',
            });
          }
        }

        // Module content
        if (module.content && Array.isArray(module.content)) {
          for (const item of module.content) {
            slides.push({
              slideNumber: slideNum++,
              title: item.title || item.heading || 'Content',
              content: item.body || item.text || '',
            });
          }
        }
      }
      return slides;
    }

    // Handle narrative structure (storyboard)
    if (courseData.storyboard && Array.isArray(courseData.storyboard)) {
      return courseData.storyboard.map((item: any, index: number) => ({
        slideNumber: index + 1,
        title: item.title || item.heading || `Slide ${index + 1}`,
        content: item.narrative || item.description || item.content || '',
      }));
    }

    // Handle scenes (visual narrative)
    if (courseData.scenes && Array.isArray(courseData.scenes)) {
      return courseData.scenes.map((scene: any, index: number) => ({
        slideNumber: index + 1,
        title: scene.title || scene.description || `Scene ${index + 1}`,
        content: scene.narrative || scene.prompt || '',
      }));
    }

    // Fallback: treat entire content as one slide
    if (typeof courseData === 'string') {
      return [
        {
          slideNumber: 1,
          title: 'Course Content',
          content: courseData,
        },
      ];
    }

    // Last resort: JSON stringify and use that
    return [
      {
        slideNumber: 1,
        title: 'Course Content',
        content: JSON.stringify(courseData),
      },
    ];
  } catch (error) {
    console.error('Failed to extract slides:', error);
    return [
      {
        slideNumber: 1,
        title: 'Course Content',
        content: JSON.stringify(courseData || ''),
      },
    ];
  }
}

/**
 * Extract course content as plain text for matching
 */
export function extractCourseText(courseData: any): string {
  try {
    const slides = extractSlidesFromCourseData(courseData);
    return slides
      .map((slide) => `${slide.title} ${slide.content}`)
      .join('\n\n');
  } catch (error) {
    console.error('Failed to extract course text:', error);
    return JSON.stringify(courseData || '');
  }
}

/**
 * Detect course type from content
 */
export function detectCourseType(courseContent: string): string {
  const contentLower = courseContent.toLowerCase();

  // Check for specific keywords to detect course type
  const typePatterns: Record<string, string[]> = {
    reactor: ['reactor', 'vessel', 'distillation', 'column'],
    safety: ['safety', 'hazard', 'risk', 'precaution', 'ppe'],
    maintenance: ['maintenance', 'repair', 'service', 'upkeep'],
    compliance: ['compliance', 'regulation', 'standard', 'requirement'],
    procedure: ['procedure', 'process', 'step', 'instruction'],
    equipment: ['equipment', 'machinery', 'tool', 'apparatus'],
  };

  let maxMatches = 0;
  let detectedType = 'general';

  for (const [type, patterns] of Object.entries(typePatterns)) {
    const matches = patterns.filter((pattern) =>
      contentLower.includes(pattern)
    ).length;

    if (matches > maxMatches) {
      maxMatches = matches;
      detectedType = type;
    }
  }

  return detectedType;
}
