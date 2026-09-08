# Image Generation Issue Analysis

## Problem Summary
**The image generation is failing inconsistently because the `OPENAI_API_KEY` is not configured in the `.env` file.**

The application is trying to generate images using OpenAI's `gpt-image-1` model, but the API key is missing, causing the Supabase edge function to fail silently.

## Root Cause

### Current Implementation (❌ BROKEN)
- **File:** `supabase/functions/generate-slide-image/index.ts`
- **Model:** OpenAI `gpt-image-1` 
- **Required Key:** `OPENAI_API_KEY` (NOT SET in `.env`)
- **Status:** Function fails because `OPENAI_API_KEY` is undefined

### What's in `.env` file:
```
VITE_RAZORPAY_KEY_ID="rzp_test_1Aa00000000000"
VITE_SUPABASE_PROJECT_ID="licezkkahseilnmswxbc"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."
VITE_SUPABASE_URL="https://licezkkahseilnmswxbc.supabase.co"
VITE_HEYGEN_API_KEY=sk_V2_hgu_kWLX0sPX3Ej_Fp4uWcMLeNw7lkmb2Oi96EhiG60z2qzR
BFL_API_KEY=bfl_mKC7JuwhTruOEp1Ag6N8FzAvBsVviTGd  ✅ (This is configured)
OPENAI_API_KEY=❌ MISSING! (This is required)
```

## Git History Analysis

**Commit 234e810** ("Configure Black Forest Labs Flux 2 API for image generation"):
- ✅ Used BFL Flux 2 with `BFL_API_KEY` (which is configured)
- ✅ Better alignment with available credentials

**Commits 87ca9a8 → 182f402** (Series of changes):
- Reverted back to OpenAI `gpt-image-1` model
- Changed quality settings multiple times
- Missing `OPENAI_API_KEY` requirement was not addressed

## Solutions

### Solution 1: Revert to BFL Flux 2 (RECOMMENDED) ✅
**Pros:**
- API key already configured in `.env` file
- No additional setup needed
- Flux 2 is a modern, capable model
- Likely better quality than deprecated OpenAI model

**Cons:**
- Need to revert 5 commits worth of changes

### Solution 2: Add Missing OpenAI API Key ⚠️
**Pros:**
- Minimal code changes
- Keeps current implementation

**Cons:**
- Requires setting up OpenAI account and API key
- `gpt-image-1` model may be deprecated or unreliable
- Adds another API vendor dependency

## Error Flow Diagram

```
useAgentPipeline.ts (Visual Design Agent)
    ↓
Calls: supabase.functions.invoke("generate-slide-image", {...})
    ↓
generate-slide-image/index.ts runs
    ↓
Tries to read: Deno.env.get("OPENAI_API_KEY")
    ↓
❌ Returns undefined/null
    ↓
Line 26: throw new Error("OPENAI_API_KEY is not set")
    ↓
Error caught in useAgentPipeline.ts (line 1392-1396)
    ↓
Logs: "Visual Design Agent: Image generation failed for scene X. Will use placeholder."
    ↓
No image generated - inconsistent content quality
```

## Affected Components

1. **Image-based Learning Mode**
   - File: `src/hooks/useAgentPipeline.ts` (lines 1324-1406)
   - Generates narrative scene images
   - Status: ❌ FAILING

2. **Topic Visual Generation**
   - File: `src/hooks/useAgentPipeline.ts` (lines 1438-1550)
   - Generates module infographics and topic visuals
   - Status: ❌ FAILING

3. **SVG Fallback**
   - File: `src/hooks/useAgentPipeline.ts` (lines 1408-1550)
   - Uses Claude to generate SVG graphics
   - Status: ✅ WORKING (when configured)

## Why Consistency is Low

1. **Silent Failures:** When image generation fails, no image is used
2. **No Retry Logic:** Failed requests are not retried
3. **Error Handling:** Errors are logged but the pipeline continues
4. **Fallback Missing:** No proper fallback to SVG or placeholder images
5. **Inconsistent Results:** Some topics get images, others don't

## Recommended Fix

### Option 1: Revert to Flux 2 (RECOMMENDED)
```bash
git revert 182f402 3098506 87ca9a8 342f265 90a8b1a 4577631 b43c0a4 aab2997
# Or directly edit supabase/functions/generate-slide-image/index.ts to use BFL API
```

### Option 2: Add OPENAI_API_KEY to .env
```bash
# 1. Get your OpenAI API key from https://platform.openai.com/api-keys
# 2. Add to .env:
OPENAI_API_KEY=sk-your-actual-api-key-here

# 3. Note: Also need to set this in Supabase Dashboard:
# → Project Settings → Edge Functions → Environment Variables
```

## Testing After Fix

```bash
# 1. Verify API key is set
echo $OPENAI_API_KEY  # or BFL_API_KEY if using Flux 2

# 2. Check edge function logs
supabase functions deploy generate-slide-image --local

# 3. Run a test course generation
# → Should see "Visual Design Agent: Converted PNG to JPEG for Scene X"
# → No errors in pipeline logs

# 4. Verify images appear in final output
# → Check SlidePreview component
# → Check Flipbook generation
# → Check PDF export
```

## Quick Checklist

- [ ] Confirm which model to use (BFL Flux 2 vs OpenAI)
- [ ] If BFL: Verify edge function is using correct code
- [ ] If OpenAI: Add `OPENAI_API_KEY` to `.env` AND Supabase environment variables
- [ ] Deploy edge function changes
- [ ] Test with sample course generation
- [ ] Monitor logs for "Image generation failed" errors
- [ ] Verify image quality and consistency
