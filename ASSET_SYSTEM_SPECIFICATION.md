# Asset System - Complete Flow Specification

## Overview
Complete end-to-end specification for custom asset management with two distinct subsystems:

### Architecture Overview
```
Asset Library (Dashboard Sidebar)
├─ Objects (THIS SPECIFICATION - Phase 1)
│  ├─ Custom images/photos
│  ├─ Equipment visuals
│  ├─ Procedure diagrams
│  └─ Tag-based matching to course content
│
└─ Trainers (Phase 2 - Future)
   ├─ Avatar selection
   ├─ Narrator personas
   ├─ Voice characteristics
   └─ (Separate flow - to be designed)
```

**This document covers: Objects subsystem only**
- Custom image upload, management, and integration
- Tag-based matching to course content
- Slide-level asset mapping
- Integration into course generation pipeline

---

## 1. ASSET UPLOAD & MANAGEMENT

### 1.1 Objects Asset Upload Interface
**Location:** Studio Page → Settings Tab → Asset Library → Objects

```
Asset Library Section (Two Tabs)
├─ Objects (THIS SPEC)
│  ├─ Upload Area
│  │  ├─ Drag-drop zone
│  │  ├─ File picker (JPG, PNG, WebP)
│  │  └─ Max size: 10MB per image
│  │
│  ├─ Asset List
│  │  ├─ Thumbnail preview (150x150px)
│  │  ├─ Filename
│  │  ├─ Upload date
│  │  ├─ Edit/Delete buttons
│  │  └─ View full preview button
│  │
│  └─ Asset Editor (on click)
│     ├─ Full image preview (modal)
│     ├─ Filename input
│     ├─ Tag input (multi-select)
│     │  └─ Suggested tags: reactor, equipment, distillation, 
│     │     valve, control-panel, safety, procedure, etc.
│     ├─ Description textarea
│     └─ [Save] [Delete]
│
└─ Trainers (Phase 2 - Separate spec)
   ├─ Avatar profiles
   ├─ Voice options
   ├─ Narrator personas
   └─ (Future feature)
```

### 1.2 Upload Flow (WITH SERVER-SIDE PROCESSING)
```
User clicks "Upload Asset"
    ↓
User selects image file (JPG/PNG/WebP)
    ↓
Client-side validation:
    ✓ File size check (<10MB)
    ✓ MIME type check
    ↓
Upload to Supabase Storage (temporary):
    Path: storage/users/{user_id}/uploads/{temp_uuid}/{filename}
    ↓
Trigger: Server-side Edge Function "process-asset-upload"
    ├─ Compress original image
    ├─ Generate thumbnail (150x150)
    ├─ Generate preview (500x500)
    ├─ Extract image metadata (width, height, EXIF)
    ├─ Move to final location:
    │  └─ storage/users/{user_id}/assets/{asset_id}/original.jpg
    │  └─ storage/users/{user_id}/assets/{asset_id}/thumbnail.jpg
    │  └─ storage/users/{user_id}/assets/{asset_id}/preview.jpg
    └─ Create asset record in database
    ↓
Modal appears to add tags & description
    ↓
User enters:
    - Tags: ["reactor", "equipment", "industrial"]
    - Description: "Reactor exterior with cleaning interface"
    ↓
[Save Asset]
    ↓
Asset metadata updated with tags
Asset available in Asset Library
```

**Why server-side processing:**
- ❌ Client-side compression blocks UI on slow mobile
- ❌ Uploads take 30+ seconds if full-size image transmitted
- ✅ Edge Function processes in parallel (doesn't block user)
- ✅ Thumbnails ready instantly for modal
- ✅ Storage optimized (compressed originals, small thumbnails)

---

## 2. DATABASE SCHEMA

### 2.1 User Assets Table
```sql
CREATE TABLE user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX idx_user_assets_tags ON user_assets USING GIN(tags);
```

### 2.2 Asset Selection Preferences Table (WITH CONTEXTUAL MATCHING)
```sql
CREATE TABLE asset_selection_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES course_drafts(id) ON DELETE CASCADE,
  selected_asset_ids UUID[] DEFAULT '{}',
  
  -- CONTEXT: To avoid suggesting irrelevant preferences
  course_type TEXT, -- "reactor", "distillation", "safety", "compliance", etc.
  topic_keywords TEXT[], -- ["reactor", "vessel", "cleaning"] extracted from content
  content_hash TEXT, -- Hash of course content (to detect similar courses)
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pref_user_id ON asset_selection_preferences(user_id);
CREATE INDEX idx_pref_course_type ON asset_selection_preferences(user_id, course_type);
CREATE INDEX idx_pref_course_id ON asset_selection_preferences(course_id);
```

**Why context matters:**
- PROBLEM: User creates Distillation SOP, uses "distillation-column" asset
- PROBLEM: Next user creates Safety Induction, system suggests "distillation-column" (irrelevant!)
- SOLUTION: Store `course_type` + `topic_keywords`
- RESULT: Suggest assets only from similar courses

### 2.3 Asset Usage Log Table (REQUIRED - Critical for Analytics & Premium Justification)
```sql
CREATE TABLE asset_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  asset_id UUID NOT NULL REFERENCES user_assets(id),
  course_id UUID NOT NULL REFERENCES course_drafts(id),
  slide_number INT NOT NULL,
  slide_title TEXT,
  used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_log_asset_id ON asset_usage_log(asset_id);
CREATE INDEX idx_usage_log_user_id ON asset_usage_log(user_id);
CREATE INDEX idx_usage_log_used_at ON asset_usage_log(used_at);
```

**Why this is REQUIRED (not optional):**
- Shows users: "This reactor image appeared in 3 of your last 5 courses"
- Analytics: Track asset reuse across courses
- Premium justification: "Save time with your 12 most-used assets"
- Retention feature: "Your top-used images" dashboard
- ROI messaging: "Your assets saved X credits across Y courses"

---

## 3. ASSET MATCHING ALGORITHM

### 3.1 Tag Matching Logic
```
FUNCTION: matchAssetsToContent(courseContent, userAssets)

INPUT:
- courseContent: string (uploaded SOP/content)
- userAssets: Array<{id, tags, filename}>

PROCESS:

1. EXTRACT KEYWORDS FROM CONTENT:
   - Split content into sentences
   - Extract nouns and key terms
   - Normalize: lowercase, remove special chars
   - Common terms: reactor, distillation, column, valve,
     equipment, procedure, safety, control, panel, etc.

2. FIND MATCHING ASSETS:
   FOR EACH asset in userAssets:
     FOR EACH tag in asset.tags:
       IF tag is found in courseContent:
         matches.push({
           assetId: asset.id,
           tag: tag,
           confidence: calculateConfidence(tag, context),
           slideNumbers: findSlideMentions(tag, slides)
         })

3. CALCULATE CONFIDENCE:
   - Exact match: 95%
   - Partial match (substring): 80%
   - Context match (sentence contains related terms): 70%

4. FIND SLIDE-LEVEL MATCHES:
   FOR EACH match:
     slideMatches = findSlidesThatMention(tag, slides)
     // Find which specific slides mention this asset

5. RETURN:
   {
     matched: [
       {
         assetId: "uuid-123",
         filename: "reactor.jpg",
         tags: ["reactor", "equipment"],
         confidence: 95,
         slideNumbers: [2, 5, 9],
         slideCount: 3
       }
     ],
     unmatched: [
       {
         query: "distillation column",
         reason: "no asset with 'distillation' tag"
       }
     ]
   }
```

### 3.2 Slide-Level Matching
```
FUNCTION: findSlidesThatMention(tag, slides)

INPUT:
- tag: string ("reactor")
- slides: Array<{slideNumber, content}>

PROCESS:
FOR EACH slide in slides:
  IF slide.content CONTAINS tag (case-insensitive):
    slideMatches.push({
      slideNumber: slide.slideNumber,
      context: extractContext(tag, slide.content)
      // e.g., "Reactor vessel introduction"
    })

RETURN: slideMatches
```

---

## 4. ASSET MATCHING MODAL

### 4.1 Modal Trigger
```
User in Studio clicks [Proceed to Generation]
    ↓
(Before starting pipeline)
Show Asset Matching Modal
```

### 4.2 Modal UI Structure
```
┌────────────────────────────────────────────────┐
│  Asset Matching                                 │
│  "Checking your assets against course content" │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ MATCHED ASSETS (95% Confidence)                │
├────────────────────────────────────────────────┤
│                                                │
│ ☑ Reactor                                      │
│   Appears in: Slide 2, Slide 5, Slide 9       │
│   (3 slides total)                            │
│                                                │
│   [Thumbnail]  [Full Preview]                 │
│   150x150px    (Opens lightbox)               │
│                                                │
├────────────────────────────────────────────────┤
│ ☐ Distillation Column                         │
│   Appears in: Slide 4, Slide 7                │
│   (2 slides total)                            │
│                                                │
│   [Thumbnail]  [Full Preview]                 │
│                                                │
├────────────────────────────────────────────────┤
│ NO MATCHES FOUND (Will Generate with Flux)   │
├────────────────────────────────────────────────┤
│                                                │
│ • Safety Equipment                            │
│ • Control Panel                               │
│ • Valve Assembly                              │
│ (These will be generated with Flux AI)        │
│                                                │
├────────────────────────────────────────────────┤
│ PREFERENCE SUGGESTION:                        │
│ "Last time you created a course, you used:   │
│  ✓ Reactor, ✗ Distillation Column"           │
│  [Apply Same Selection] [Manual Select]       │
│                                                │
└────────────────────────────────────────────────┘

[Generate with Selected] [Skip Assets & Generate]
```

### 4.3 Modal State Management
```typescript
type AssetMatchResult = {
  assetId: string;
  filename: string;
  tags: string[];
  confidence: number;
  slideNumbers: number[];
  slideCount: number;
  selected: boolean; // User's selection
  storageUrl: string;
  thumbnailUrl: string;
};

type MatchingModalState = {
  isOpen: boolean;
  loading: boolean;
  matched: AssetMatchResult[];
  unmatched: string[]; // Items not found
  selectedAssets: string[]; // User's checkbox selections
  lastPreferences: string[] | null; // From previous course
  showPreferenceSuggestion: boolean;
};
```

### 4.4 User Interactions
```
SCENARIO 1: User wants all matched assets
├─ All checkboxes pre-checked
├─ User just clicks [Generate with Selected]
└─ All assets wired in

SCENARIO 2: User wants to skip some
├─ Uncheck "Distillation Column"
├─ Check remains on "Reactor"
├─ Click [Generate with Selected]
└─ Only Reactor wired in

SCENARIO 3: No matches found
├─ "No matches found" message shown
├─ All assets listed (user can manually select any)
├─ User can check any asset manually
├─ Or click [Skip Assets & Generate]
└─ Course generates normally

SCENARIO 4: Apply previous selections
├─ Modal suggests: "Last time use Reactor?"
├─ User clicks [Apply Same Selection]
├─ Previous selections automatically checked
├─ User clicks [Generate]
└─ Same preferences applied
```

---

## 5. PREFERENCE PERSISTENCE

### 5.1 Save Selection (WITH CONTEXT)
```
User clicks [Generate with Selected Assets]
    ↓
BEFORE generation starts:
- Extract course metadata:
  ├─ course_type: "reactor", "distillation", "safety", etc.
  ├─ topic_keywords: Extract from content
  │  ["reactor", "vessel", "cleaning", "procedure"]
  └─ content_hash: SHA256(courseContent) for similarity matching

- Save to asset_selection_preferences:
  {
    user_id: "xyz",
    course_id: "abc",
    selected_asset_ids: ["asset-1", "asset-3"],
    course_type: "reactor",
    topic_keywords: ["reactor", "vessel", "cleaning"],
    content_hash: "abc123def456"
  }
    ↓
Start generation pipeline
```

### 5.2 Retrieve Contextual Preferences (SMART MATCHING)
```
FUNCTION: getSimilarAssetPreferences(userId, currentCourseType, currentTopics)

QUERY (IMPROVED):
SELECT 
  selected_asset_ids,
  course_type,
  topic_keywords,
  similarity_score
FROM asset_selection_preferences
WHERE user_id = {userId}
  AND course_type = {currentCourseType}  -- Only similar courses!
ORDER BY similarity_score DESC, created_at DESC
LIMIT 1

RETURN: 
{
  selectedAssets: uuid[],
  courseType: string,
  similarity: "High" | "Medium" | "Low"
}

FALLBACK LOGIC:
IF exact course_type match found:
  ✓ Suggest those preferences (95% relevant)
ELSE IF topic_keywords overlap >70%:
  ✓ Suggest those preferences (80% relevant)
  ⚠ Show: "Similar to your X course?"
ELSE:
  ✗ Don't suggest (irrelevant)
  Show: "Choose assets for this course"
```

**Example:**
```
User 1: Creates "Reactor Cleaning" (uses Reactor asset)
  course_type: "reactor"
  topic_keywords: ["reactor", "vessel", "cleaning"]

User 1: Creates "Reactor Safety" (similar!)
  course_type: "reactor"
  topic_keywords: ["reactor", "safety", "hazard"]
  System: "Use same assets as Reactor Cleaning?" ✓ Relevant!

User 1: Creates "Safety Induction" (different!)
  course_type: "safety"
  topic_keywords: ["safety", "compliance", "training"]
  System: (doesn't suggest Reactor Cleaning assets) ✓ Correct!
```

### 5.3 Smart Suggestion (CONTEXT-AWARE)
```
When modal loads:
contextualPref = getSimilarAssetPreferences(
  userId, 
  currentCourseType,  // "reactor", "distillation", etc.
  currentTopics       // ["reactor", "vessel", "cleaning"]
)

IF contextualPref.similarity === "High":
  Show: "Last time you created a reactor course, you used:"
  ✓ Reactor (checked)
  ✗ Distillation (unchecked)
  [Apply Same] button
  
ELSE IF contextualPref.similarity === "Medium":
  Show: "Similar to your other courses, you might want:"
  ⚠ (Checkboxes pre-unchecked, just suggestions)
  
ELSE:
  Don't show suggestion
  Message: "No similar courses found. Choose your assets:"
```

**Example Scenarios:**

Scenario 1: High Similarity ✓
```
Last course: "Reactor Cleaning SOP"
  Used: [Reactor, Safety-Valve]
  Type: "reactor"
  Topics: ["reactor", "vessel", "cleaning"]

New course: "Reactor Maintenance"
  Type: "reactor"
  Topics: ["reactor", "maintenance", "procedure"]
  
Suggestion: "Similar! Use Reactor & Safety-Valve?" ✓
```

Scenario 2: Low Similarity ✗
```
Last course: "Reactor Cleaning SOP"
  Used: [Reactor, Safety-Valve]
  Type: "reactor"
  
New course: "Safety Induction"
  Type: "safety"
  Topics: ["safety", "compliance", "training"]
  
Suggestion: (none shown)
Message: "Choose assets for your safety course"
```

---

## 6. GENERATION PIPELINE INTEGRATION

### 6.1 Data Flow
```
Asset Matching Modal
    ↓
User selects assets
    ↓
Selected assets passed to pipeline
    ↓
useAgentPipeline receives:
    courseContent: string
    courseParams: CourseParams
    selectedAssets: Array<{
      id: string,
      storageUrl: string,
      tags: string[],
      description: string
    }>
    ↓
Pipeline processes course
```

### 6.2 Modified useAgentPipeline Hook
```typescript
type PipelineOptions = {
  content: string;
  courseParams: CourseParams;
  selectedAssets?: Array<{  // NEW
    id: string;
    storageUrl: string;
    tags: string[];
    description: string;
  }>;
};

async function runAIPipeline(options: PipelineOptions) {
  // Existing pipeline code
  // PLUS new asset integration
}
```

---

## 7. IMAGE GENERATION WITH ASSETS

### 7.1 Current Flow (Flux only)
```
Architecture Agent creates slide structure
    ↓
Writing Agent writes content
    ↓
Visuals Agent determines what images needed
    ↓
FOR EACH slide needing image:
  CALL: supabase.functions.invoke("generate-slide-image", {
    prompt: image_prompt,
    style: style,
    ...
  })
    ↓
    Returns Flux-generated image
    ↓
Assembly Agent combines everything
```

### 7.2 New Flow (Assets + Flux)
```
Visuals Agent determines what images needed
    ↓
FOR EACH slide needing image:
  
  1. CHECK FOR ASSET MATCH:
     matchedAsset = findMatchingAsset(
       slideContent,
       slideTitle,
       selectedAssets
     )
     
  2. IF ASSET MATCHED:
     ├─ Log: "Using asset {assetId} for slide {n}"
     ├─ Fetch asset from Supabase Storage
     ├─ Convert to data URL
     ├─ Insert into slide
     └─ No Flux call, no credits spent
     
  3. IF NO ASSET MATCHED:
     ├─ Log: "Generating image with Flux for slide {n}"
     ├─ CALL: generate-slide-image (existing)
     ├─ Get Flux result
     └─ Insert into slide (credits spent)
     
  4. CONTINUE to next slide
    ↓
Assembly Agent combines everything
```

### 7.3 Asset Matching in Pipeline
```typescript
FUNCTION: findMatchingAsset(
  slideContent: string,
  slideTitle: string,
  selectedAssets: Array
): Asset | null {
  
  // Extract keywords from slide
  keywords = extractKeywords(slideContent + slideTitle);
  
  FOR EACH asset in selectedAssets:
    FOR EACH tag in asset.tags:
      IF tag matches any keyword:
        RETURN asset; // Use this asset
  
  RETURN null; // No match, use Flux
}
```

### 7.4 Implementation Location (WITH USAGE LOGGING)
```
File: src/hooks/useAgentPipeline.ts
Around line 1372 (current generate-slide-image call)

BEFORE:
const { data: imageData } = await supabase.functions.invoke(
  "generate-slide-image", { ... }
);

AFTER:
// Check for matching asset first
const matchedAsset = findMatchingAsset(
  topicVisual.image_prompt,
  topicTitle,
  options.selectedAssets
);

if (matchedAsset) {
  // Use custom asset
  const customImage = await fetchAssetImage(matchedAsset.storageUrl);
  topicVisual.generated_image_data_url = customImage.dataUrl;
  topicVisual.generated_image_mime_type = customImage.mimeType;
  topicVisual.asset_used = matchedAsset.id;
  
  // LOG ASSET USAGE (REQUIRED for analytics)
  await supabase
    .from('asset_usage_log')
    .insert({
      user_id: userId,
      asset_id: matchedAsset.id,
      course_id: courseId,
      slide_number: slideIndex,
      slide_title: topicTitle,
      used_at: new Date()
    });
  
  addLog(`✓ Using custom asset for "${topicTitle}"`);
} else {
  // Generate with Flux
  const { data: imageData } = await supabase.functions.invoke(
    "generate-slide-image", { ... }
  );
  topicVisual.generated_image_data_url = imageData.imageDataUrl;
}
```

---

## 8. IMPLEMENTATION TIMELINE

### Phase 1: Foundation (4-5 hours)
```
✓ Database schema
✓ Asset upload interface (Studio Settings)
✓ Supabase Storage integration
✓ Asset tagging system
✓ Asset CRUD operations
```

### Phase 2: Matching & Modal (3-4 hours)
```
✓ Asset matching algorithm
✓ Slide-level mapping detection
✓ Asset Matching Modal UI
✓ Modal state management
✓ Preference persistence
```

### Phase 3: Pipeline Integration (2-3 hours)
```
✓ Pass selectedAssets to pipeline
✓ Asset lookup in image generation
✓ Fetch and insert custom images
✓ Skip Flux when asset matched
✓ Logging & error handling
```

### Phase 4: Testing & Refinement (2 hours)
```
✓ Test asset upload/storage
✓ Test matching algorithm
✓ Test modal flow
✓ Test pipeline integration
✓ Test preference saving/loading
```

**Total: 11-14 hours of implementation**

---

## 9. KEY FILES AFFECTED

```
New Files:
├─ src/components/AssetLibraryPanel.tsx
├─ src/components/AssetMatchingModal.tsx
├─ src/utils/assetMatching.ts
├─ src/lib/assetStorage.ts
├─ supabase/functions/process-asset-upload/index.ts (EDGE FUNCTION - Server-side processing)
└─ supabase/migrations/create_user_assets_table.sql

Modified Files:
├─ src/pages/Studio.tsx (add Asset Library tab)
├─ src/hooks/useAgentPipeline.ts (add asset checking)
├─ src/integrations/supabase/types.ts (add types)
└─ src/lib/supabase.ts (add storage functions)
```

### Edge Function: `process-asset-upload/index.ts` (NEW)
**Purpose:** Server-side image processing (compression, thumbnails, metadata)

```typescript
// supabase/functions/process-asset-upload/index.ts

/*
INPUT:
{
  uploadPath: "users/{userId}/uploads/{tempId}/filename.jpg",
  assetId: "uuid-123",
  userId: "user-uuid"
}

PROCESS:
1. Fetch uploaded image from temporary storage
2. Compress with ImageMagick:
   - Original: compress to 85% quality JPEG
   - Thumbnail: 150x150, optimized
   - Preview: 500x500, optimized
3. Extract metadata: width, height, size, EXIF
4. Save to final location:
   - /users/{userId}/assets/{assetId}/original.jpg
   - /users/{userId}/assets/{assetId}/thumbnail.jpg
   - /users/{userId}/assets/{assetId}/preview.jpg
5. Delete temporary upload
6. Update database with asset metadata
7. Return: {success: true, metadata: {...}}

RUNS: Automatically on upload via Supabase Storage trigger
DOESN'T BLOCK: User can add tags while processing
*/
```

---

## 10. ERROR HANDLING

### 10.1 Asset Upload Errors
```
❌ File too large (>10MB)
  → Show: "Maximum file size is 10MB"
  
❌ Invalid format (not JPG/PNG/WebP)
  → Show: "Only JPG, PNG, and WebP formats supported"
  
❌ Storage upload fails
  → Show: "Failed to upload asset. Try again."
  
❌ Invalid tags
  → Show: "Please add at least one tag"
```

### 10.2 Matching Errors
```
❌ No content to match
  → Show: "No course content to match"
  
❌ Asset fetch fails
  → Fallback to Flux generation
  → Log error for debugging
```

### 10.3 Pipeline Errors
```
❌ Custom asset URL invalid
  → Fallback to Flux
  → Log error
  
❌ Asset conversion fails
  → Fallback to Flux
  → Log error
```

---

## 11. MULTI-TENANCY & ACCESS CONTROL (CRITICAL)

### 11.0 User Isolation - Complete Enforcement
**Requirement:** Objects (assets) of one user must NEVER be visible to other users.

#### Level 1: Database Schema Isolation
```sql
CREATE TABLE user_assets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),  ← MANDATORY FK
  filename TEXT,
  ...
);

-- ENFORCE: Every asset tied to exactly one user
-- RESULT: User A's reactor.jpg has user_id=123
--         User B cannot access this row (no FK to their user)
```

#### Level 2: Storage Path Isolation
```
user_assets table:
  storage_path: "users/{user_id}/assets/{asset_id}/original.jpg"
                           ↑
                     USER ISOLATION IN PATH

Example:
  User A (id: abc-123): users/abc-123/assets/reactor-001/original.jpg
  User B (id: def-456): users/def-456/assets/reactor-001/original.jpg
  
Same filename but different paths = complete isolation
```

#### Level 3: Query-Level Filters (RLS Policies)
```sql
-- Supabase RLS Policy: Users can only read own assets
CREATE POLICY "users_can_read_own_assets"
ON user_assets
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only update own assets
CREATE POLICY "users_can_update_own_assets"
ON user_assets
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete own assets
CREATE POLICY "users_can_delete_own_assets"
ON user_assets
FOR DELETE
USING (auth.uid() = user_id);
```

#### Level 4: Application-Level Checks
```typescript
// Every query includes user isolation check
async function getUserAssets(userId: string) {
  const { data } = await supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', userId)  ← ENFORCED AT QUERY LEVEL
    .order('created_at', { ascending: false });
  
  return data;
}

// Asset matching only searches user's assets
async function matchUserAssets(userId: string, courseContent: string) {
  // Only query THIS user's assets
  const userAssets = await supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', userId);  ← USER SCOPED
    
  // Match against course content
  return matchAssets(userAssets, courseContent);
}
```

#### Level 5: Storage Access Control
```sql
-- Users can only read files in their user_id path
CREATE POLICY "users_can_read_own_assets"
ON storage.objects
FOR SELECT
USING (
  auth.uid()::text = (string_to_array(name, '/'))[2]
);
```

### 11.0.1 Test Cases
```
TEST: User A tries to view User B's assets
  ❌ RLS Policy blocks: auth.uid() ≠ user_id → Access Denied

TEST: User A tries to download User B's image
  ❌ Storage Policy: user_id in path ≠ auth.uid() → 403 Forbidden

TEST: User A tries to use User B's asset in course
  ❌ Asset matching queries User A's assets only → Asset not found

TEST: User A uploads, views, uses own asset
  ✅ All operations succeed → Asset wired into course
```

---

## 12. SECURITY CONSIDERATIONS

### 12.1 Access Control
```
- Users can only see their own assets
- Assets deleted when user account deleted (CASCADE)
- Storage paths include user_id (privacy)
- SIGNED URLs for preview access (not public!)
- Public URLs ONLY for final generated courses
```

### 12.2 URL Security (CRITICAL FIX)
**PROBLEM:** Current spec says "public read access" = security gap
- URLs can be guessed or leaked
- Anyone with URL can download any asset

**SOLUTION:** Use Signed URLs with Short TTLs

```
TWO-TIER URL STRATEGY:

1. MODAL PREVIEW (Signed URL, 1-hour TTL):
   User opens Asset Matching Modal
   ├─ System generates signed URL
   ├─ Valid for 1 hour only
   ├─ User-specific (user_id embedded)
   ├─ Single-use token
   └─ Example: https://cdn.supabase.io/assets/...?token=xyz&expires=3600
   
2. FINAL COURSE OUTPUT (Public URL):
   After course generation complete
   ├─ Public read access enabled
   ├─ User explicitly chose to include this asset
   ├─ Part of deliverable course
   └─ Example: https://cdn.supabase.io/courses/xyz/reactor.jpg

IMPLEMENTATION:
```typescript
// For modal preview (SIGNED)
const signedUrl = await supabase.storage
  .from('user-assets')
  .createSignedUrl(`users/${userId}/assets/${assetId}/thumbnail.jpg`, 3600); // 1 hour

// For final course (PUBLIC)
const publicUrl = supabase.storage
  .from('user-assets')
  .getPublicUrl(`users/${userId}/assets/${assetId}/original.jpg`);
```

**Bucket Policy:**
```sql
-- Private by default, with authenticated read
CREATE POLICY "Users can read own assets via signed URL"
ON storage.objects
FOR SELECT
USING (
  auth.uid()::text = (string_to_array(name, '/'))[2] -- Extract user_id from path
);
```

### 12.3 File Validation
```
✓ Check file size (<10MB)
✓ Verify MIME type (JPG/PNG/WebP only)
✓ Validate image dimensions (min 100x100, max 10000x10000)
✓ Re-encode on upload (strips potential malware in EXIF)
✓ Scan filename for path traversal
✓ Rate limit: Max 50 assets per user
```

### 12.4 Storage Security
```
✓ Use Supabase Storage (managed security)
✓ Encryption at rest (default)
✓ Signed URLs for sensitive access
✓ Public URLs only for deliverables
✓ Access logs for audit
✓ Asset deletion when user deleted (CASCADE)
✓ No direct object list access (prevent enumeration)
```

---

## 13. PERFORMANCE CONSIDERATIONS

### 13.1 Optimization
```
✓ Cache asset list in client state
✓ Lazy load asset previews
✓ Batch asset matching (parallel processing)
✓ Asset thumbnails generated on upload
✓ Storage URLs cached
```

### 13.2 Database
```
✓ Index on user_id for fast queries
✓ Index on tags for matching searches
✓ Pagination for asset list (if >50 assets)
```

### 13.3 Storage (Server-Side Processing)
```
✓ Edge Function: process-asset-upload handles all:
  ├─ Compress original (85% quality JPEG)
  ├─ Generate thumbnail (150x150)
  ├─ Generate preview (500x500)
  └─ Extract metadata
  
✓ Client doesn't wait for processing (async)
✓ Lazy load full previews (on-demand signed URLs)
✓ Thumbnails cached in browser
```

---

## 14. FUTURE ENHANCEMENTS

```
Phase 2 (Optional):
├─ Asset categories (Equipment, Procedure, Safety, etc.)
├─ Asset search functionality
├─ Bulk upload
├─ Asset versioning
├─ Shared asset library (team/organization)
├─ Asset usage analytics
├─ Image editing tools (crop, resize, annotate)
└─ AI-powered asset tagging

Phase 3:
├─ Trainer/Avatar selection system (SEPARATE)
├─ Custom brand elements (logo, colors)
└─ Style templates
```

---

## 15. TESTING CHECKLIST

```
Asset Upload:
□ Upload JPG/PNG/WebP
□ File size validation
□ Tag addition/editing
□ Asset deletion
□ Storage verification

Asset Matching:
□ Content scanning works
□ Tag matching accurate
□ Slide-level detection correct
□ Confidence scoring reasonable
□ No matches scenario

Modal:
□ Modal opens correctly
□ Matches display properly
□ Thumbnails load
□ Full preview works
□ Checkboxes selectable
□ Previous preferences suggested

Pipeline:
□ Assets passed to pipeline
□ Asset lookup works
□ Custom images inserted
□ Flux skipped when asset used
□ Credits not spent on custom images

Preferences:
□ Selection saved
□ Previous preferences retrieved
□ Suggestions shown correctly
□ User can override
```

---

## 16. DATABASE MIGRATION

```sql
-- Run after approval
BEGIN;

-- Main assets table
CREATE TABLE user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Context-aware preferences with course type matching
CREATE TABLE asset_selection_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES course_drafts(id) ON DELETE CASCADE,
  selected_asset_ids UUID[] DEFAULT '{}',
  course_type TEXT, -- "reactor", "distillation", "safety", etc.
  topic_keywords TEXT[], -- ["reactor", "vessel", "cleaning"]
  content_hash TEXT, -- SHA256 hash for similarity matching
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- REQUIRED: Asset usage tracking for analytics
CREATE TABLE asset_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  asset_id UUID NOT NULL REFERENCES user_assets(id),
  course_id UUID NOT NULL REFERENCES course_drafts(id),
  slide_number INT NOT NULL,
  slide_title TEXT,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX idx_user_assets_tags ON user_assets USING GIN(tags);
CREATE INDEX idx_pref_user_id ON asset_selection_preferences(user_id);
CREATE INDEX idx_pref_course_type ON asset_selection_preferences(user_id, course_type);
CREATE INDEX idx_pref_created_at ON asset_selection_preferences(user_id, created_at DESC);
CREATE INDEX idx_usage_log_asset_id ON asset_usage_log(asset_id);
CREATE INDEX idx_usage_log_user_id ON asset_usage_log(user_id);
CREATE INDEX idx_usage_log_used_at ON asset_usage_log(used_at DESC);

COMMIT;
```

---

## 17. CONFIGURATION

```typescript
// src/config/assets.ts

export const ASSET_CONFIG = {
  // Upload validation
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_ASSETS_PER_USER: 50,
  
  // Image processing (Edge Function)
  COMPRESS_QUALITY: 85, // JPEG quality %
  THUMBNAIL_SIZE: 150, // pixels
  PREVIEW_SIZE: 500, // pixels
  
  // Signed URLs
  SIGNED_URL_TTL: 3600, // 1 hour for modal preview
  
  // Image dimensions
  MIN_IMAGE_WIDTH: 100,
  MIN_IMAGE_HEIGHT: 100,
  MAX_IMAGE_WIDTH: 10000,
  MAX_IMAGE_HEIGHT: 10000,
  
  // Tags (common categories)
  ALLOWED_TAGS: [
    'reactor', 'equipment', 'distillation', 'valve',
    'control-panel', 'safety', 'procedure', 'industrial',
    'instrument', 'vessel', 'pipe', 'pump', 'compressor',
    'gauge', 'control-room', 'lab', 'facility'
  ],
  
  // Storage
  STORAGE_BUCKET: 'user-assets',
  STORAGE_UPLOAD_PATH: 'uploads', // Temporary
  STORAGE_ASSET_PATH: 'assets', // Final location
  
  // Analytics
  TRACK_ASSET_USAGE: true, // Log every use
  SIMILARITY_THRESHOLD: 0.70, // 70% topic overlap for contextual suggestions
};
```

---

## 18. API ENDPOINTS (Supabase Functions)

### 18.1 Asset Management
```
POST /api/assets/upload
  Input: {file, tags, description}
  Output: {assetId, storageUrl, ...}

GET /api/assets/list
  Output: Array<AssetInfo>

PUT /api/assets/{id}
  Input: {tags, description}
  Output: {updated asset}

DELETE /api/assets/{id}
  Output: {success: true}
```

### 18.2 Asset Matching
```
POST /api/assets/match
  Input: {courseContent, slides}
  Output: {matched, unmatched, confidence scores}

GET /api/assets/preferences/last
  Output: {lastSelectedAssets}
```

---

## SUMMARY - KEY IMPROVEMENTS APPLIED

**Critical Fixes Implemented:**

1. ✅ **asset_usage_log is NOW REQUIRED** (not optional)
   - Tracks every asset use across all courses
   - Enables: "Reactor image used in 3 of your last 5 courses"
   - Justifies premium tier pricing
   - Provides retention analytics

2. ✅ **Image processing moved to Edge Function (Server-Side)**
   - Compression (85% JPEG quality)
   - Thumbnail generation (150x150)
   - Preview generation (500x500)
   - Metadata extraction
   - Doesn't block UI on slow mobile uploads

3. ✅ **Asset preferences are now CONTEXT-AWARE**
   - Stores: course_type, topic_keywords, content_hash
   - Suggests only relevant preferences
   - Reactor course suggestions don't pollute Safety course
   - Smart matching: High/Medium/Low similarity scoring

4. ✅ **Storage security with Signed URLs**
   - Modal preview: Signed URLs (1-hour TTL, user-specific)
   - Final course: Public URLs (user chose to include)
   - Prevents URL guessing/leakage
   - Database enforces user_id access control

**Asset System provides:**
- ✅ Upload & manage custom images (server-side processed)
- ✅ Tag-based matching to course content
- ✅ Slide-level visualization with specific matches
- ✅ User-controlled selection
- ✅ Smart preference remembering (context-aware)
- ✅ Seamless pipeline integration
- ✅ Asset usage analytics (required for premium justification)
- ✅ Credit savings (no Flux for custom images)
- ✅ Security hardened (signed URLs, access control)

**User Experience:**
1. Upload reactor photo with tags
2. Create course
3. Modal shows "Found Reactor in slides 2, 5, 9"
4. User confirms selection
5. Generation uses custom reactor image
6. Other images generated with Flux
7. Next course: "Use same assets?" → Auto-apply

---

