# Video Generation Enhancement - Visual Overlay Integration

**Status:** ✅ IMPLEMENTED  
**Date:** September 16, 2026  
**Impact:** Integrates visual diagrams into avatar videos for enhanced learning

---

## Problem Statement

When using **video-based learning mode**, videos were generated with only a talking head avatar delivering monologue. There were no supporting visuals, diagrams, graphics, or visual aids to accompany the narration.

**Expected:** Avatar + narration + visual overlays (diagrams, infographics)  
**Actual:** Only avatar + narration (static, no visuals)

---

## Solution Overview

Implemented visual overlay integration that:
1. **Extracts SVG diagrams** from the Visual Design Agent output
2. **Maps visuals to modules** for relevant content synchronization
3. **Calculates timing** based on script duration
4. **Passes to HeyGen** as whiteboard overlays during video generation

---

## Implementation Details

### 1. Helper Function: `extractVisualAssetsForModule`

**Location:** `src/hooks/useAgentPipeline.ts` (lines 773-825)

**Purpose:** Extract and format SVG diagrams for video whiteboard overlays

**Features:**
- Extracts module-level infographics
- Extracts topic-level scene SVGs
- Distributes visuals throughout video with proper timing
- Handles missing visuals gracefully

**Input:**
- `visualOutput`: Raw Visual Design Agent output (JSON string)
- `moduleTitle`: Current module being processed
- `totalDurationSeconds`: Script duration in seconds

**Output:**
```typescript
Array<{
  svgContent: string;        // SVG markup
  startSeconds: number;      // When to show overlay
  durationSeconds: number;   // How long to show
}>
```

### 2. Video Generation Integration

**Location:** `src/hooks/useAgentPipeline.ts` (lines 1875-1900)

**Changes Made:**
```typescript
// Before: Only script and avatar parameters
const pending = await generateHeyGenVideo({
  avatarId,
  script: cleanScript,
  voiceId,
  backgroundStyle,
  quality,
  videoTitle: moduleTitle,
});

// After: Includes visual overlays
const visualAssets = extractVisualAssetsForModule(
  visualResult, 
  moduleTitle, 
  scriptDurationSeconds
);

const pending = await generateHeyGenVideo({
  avatarId,
  script: cleanScript,
  voiceId,
  backgroundStyle,
  quality,
  videoTitle: moduleTitle,
  whiteboard: visualAssets.length > 0 ? {
    enabled: true,
    diagrams: visualAssets,
  } : undefined,
});
```

### 3. Enhanced Logging

Added visual feedback during video generation:
```
HeyGen Video Agent: ✓ Adding 2 visual overlay(s) to "Module Title"
```

---

## Visual Asset Types Supported

### 1. Module-Level Infographic
- **Source:** Module infographic from Visual Design Agent
- **Placement:** Appears in first 1/3 of video
- **Duration:** 1/3 of total video length
- **Purpose:** Sets visual context for entire module

### 2. Topic-Level Scene SVGs
- **Source:** Topic-specific scene SVGs from Visual Design Agent
- **Placement:** Distributed evenly throughout video
- **Duration:** Variable based on topic count
- **Purpose:** Illustrates specific topic concepts

---

## Video Generation Flow

```
Video Generation Request
    ↓
Extract Script from Voice Agent
    ↓
Calculate Script Duration (seconds)
    ↓
Extract Visual Assets from Visual Agent
    ├─ Module infographic SVG
    └─ Topic scene SVGs with timing
    ↓
Pass to HeyGen with Whiteboard Overlays
    ↓
HeyGen generates video with:
    • Avatar narrating
    • SVG diagrams displayed as overlays
    • Synchronized timing
    ↓
Video Ready (avatar + narration + visuals)
```

---

## Integration with Existing Features

### Visual Design Agent (Agent 4)
✅ Already generates:
- Module infographics (infographic_svg)
- Topic visuals (generated_scene_svg)
- Placement guidance

✅ This feature leverages those outputs

### Image Generation (Recent Fix)
✅ Complements image-based learning mode
✅ Video mode now has equivalent visual support
✅ Both modes provide consistent visual presentation

### HeyGen Service
✅ Already supports whiteboard overlays
✅ Feature: whiteboard.diagrams array
✅ No changes needed to HeyGen service

---

## Technical Specifications

### SVG Overlay Timing

**Module-Level Infographic:**
```
Start:    totalDuration / 6    (starts at 16.67%)
Duration: totalDuration / 3    (shows for 33.33%)
Purpose:  Set context early in video
```

**Topic-Level Visuals (distributed):**
```
For N topics:
  Start:    totalDuration * (index + 1) / (N + 1)
  Duration: totalDuration / (N * 2)
Purpose:    Illustrate each topic's concepts
```

### Timing Calculation

```typescript
scriptDurationSeconds = Math.ceil(
  (cleanScript.split(/\s+/).length / 150) * 60
)
// Assumes ~150 words per minute average speech
```

---

## Benefits

✅ **Enhanced Learning:** Visuals reinforce narration
✅ **Professional Presentation:** Diagrams add credibility
✅ **Consistency:** Same visuals as image-based learning mode
✅ **Automatic Synchronization:** Timing calculated from script
✅ **Graceful Degradation:** Works with or without visuals
✅ **No Performance Impact:** Minimal computational overhead

---

## Testing Checklist

- [x] TypeScript compilation passes
- [x] No runtime errors in extraction logic
- [x] Graceful handling of missing visual data
- [x] Proper timing calculations
- [x] Integration with HeyGen service

**To Test End-to-End:**
1. Create course with video-based learning mode
2. Ensure Visual Design Agent generates SVG diagrams
3. Generate video
4. Verify:
   - Avatar present ✓
   - Narration audible ✓
   - SVG overlays appear on-screen ✓
   - Timing synchronized with script ✓

---

## Configuration

No additional configuration required. The feature works automatically when:
1. Video-based learning mode is selected
2. Visual Design Agent generates SVG diagrams
3. Video generation is requested

To disable (optional), set:
```typescript
whiteboard: undefined
```

---

## Future Enhancements

Possible improvements for consideration:
1. **Image Overlays:** Support raster images (PNG/JPEG) from image generation
2. **Text Overlays:** Add script key points as text callouts
3. **Transitions:** Fade/slide effects between visual elements
4. **Custom Timing:** Allow manual timing adjustment per diagram
5. **Animation:** Support animated SVG elements

---

## Files Modified

1. **src/hooks/useAgentPipeline.ts**
   - Added: `extractVisualAssetsForModule` function
   - Modified: Video generation call with whiteboard integration
   - Added: Enhanced logging for visual overlays

---

## Deployment Notes

✅ **No Breaking Changes**
- Existing video generation works unchanged
- Whiteboard parameter is optional
- Videos generate with or without visuals

✅ **Backward Compatible**
- Old courses regenerate successfully
- Visual assets added only when available
- Falls back gracefully when SVGs unavailable

---

## Related Documentation

- [Image Generation Fix](IMAGE_GENERATION_DECISION.md) - Visual asset generation
- [HeyGen Service](src/lib/heygenService.ts) - Video generation API
- [Visual Design Agent](src/hooks/useAgentPipeline.ts:1310) - SVG generation

---

**Implementation Complete: Video generation now includes visual overlays for enhanced learning experience.**
