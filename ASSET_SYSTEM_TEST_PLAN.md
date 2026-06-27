# Asset System - Complete Test Plan

## Test Environment Setup

### Prerequisites
- Dev server running: `npm run dev`
- Database migrations applied
- Test user account with credits
- Sample images ready for upload

---

## PHASE 1: Asset Upload & Management Testing

### Test 1.1: Upload Asset
**Steps:**
1. Navigate to Studio → Settings Tab → Asset Library → Objects
2. Click upload area or drag-drop an image (JPG, PNG, WebP)
3. Wait for file to upload

**Expected Results:**
- ✅ File uploads successfully
- ✅ Preview shows in Asset List
- ✅ No errors in console
- ✅ File size displayed correctly

### Test 1.2: Add Tags to Asset
**Steps:**
1. After upload, click "Edit" on the asset card
2. Enter filename (or leave as is)
3. Add tags by clicking suggested tags or typing custom ones
4. Add description
5. Click "Save Asset"

**Expected Results:**
- ✅ Modal opens with asset details
- ✅ Suggested tags display
- ✅ Tags can be added/removed
- ✅ Asset saved with tags
- ✅ Asset appears in list with tags displayed

### Test 1.3: Asset Persistence
**Steps:**
1. Upload and tag multiple assets (3-5)
2. Refresh page
3. Check Asset Library again

**Expected Results:**
- ✅ All assets still appear
- ✅ Tags still visible
- ✅ File sizes correct
- ✅ Usage stats display

### Test 1.4: Asset Deletion
**Steps:**
1. Click delete button on an asset
2. Confirm deletion
3. Check asset list

**Expected Results:**
- ✅ Asset removed from list
- ✅ No errors in console
- ✅ Other assets unaffected

### Test 1.5: Asset Preview
**Steps:**
1. Click "View full preview" or thumbnail in edit modal
2. Large preview should appear

**Expected Results:**
- ✅ Full-size image displays
- ✅ Modal shows correct image
- ✅ Close button works

---

## PHASE 2: Asset Matching & Modal Testing

### Test 2.1: Asset Detection
**Steps:**
1. Create a course with content mentioning "reactor"
2. Have uploaded an asset tagged "reactor"
3. Click "Proceed to Generation"

**Expected Results:**
- ✅ AssetMatchingModal opens
- ✅ "Reactor" asset appears in matched section
- ✅ Confidence score shows (95%+)
- ✅ Slide numbers listed (e.g., "Appears in: Slide 2, Slide 5")

### Test 2.2: Multiple Asset Matching
**Steps:**
1. Upload 3 assets tagged: "reactor", "safety", "equipment"
2. Create course mentioning all three terms
3. Click "Proceed to Generation"

**Expected Results:**
- ✅ All 3 assets appear in matched section
- ✅ Each shows correct slide mapping
- ✅ All pre-selected by default
- ✅ Unmatched terms shown separately

### Test 2.3: No Matches Scenario
**Steps:**
1. Upload only "reactor" asset
2. Create course NOT mentioning reactor
3. Click "Proceed to Generation"

**Expected Results:**
- ✅ Modal shows "No matching assets found"
- ✅ Unmatched terms displayed
- ✅ "Will be generated with Flux AI" message shown
- ✅ Can still proceed without selecting assets

### Test 2.4: Asset Selection/Deselection
**Steps:**
1. Open matching modal with multiple assets
2. Uncheck some assets
3. Expand assets to see slide details
4. Re-check some assets

**Expected Results:**
- ✅ Checkboxes toggle properly
- ✅ Expandable sections work
- ✅ Thumbnail previews load
- ✅ Slide mapping details visible

### Test 2.5: Previous Preference Suggestion
**Steps:**
1. Create and generate Course A with reactor asset
2. Create Course B with similar content (mentions reactor)
3. Click "Proceed to Generation"

**Expected Results:**
- ✅ Modal shows preference suggestion
- ✅ "Last time you created..." message
- ✅ "Apply Same Preferences" button available
- ✅ Clicking applies previous selection

### Test 2.6: Asset Preview in Modal
**Steps:**
1. Open asset matching modal
2. Expand an asset by clicking it
3. View the preview section

**Expected Results:**
- ✅ Thumbnail preview displays
- ✅ Slide mapping details show
- ✅ Expand/collapse works smoothly
- ✅ Multiple assets can be expanded

---

## PHASE 3: Pipeline Integration Testing

### Test 3.1: Generation with Asset (Happy Path)
**Steps:**
1. Upload "reactor" asset
2. Create course mentioning reactor
3. Click "Proceed to Generation"
4. Modal shows match, keep selected
5. Click "Generate with Selected"
6. Wait for generation to complete
7. Check LearnerPreview

**Expected Results:**
- ✅ Modal closes
- ✅ Generation starts
- ✅ Logs show "✓ Using custom asset for..."
- ✅ Reactor slides show custom image
- ✅ No Flux calls for reactor slides
- ✅ Other slides use Flux normally
- ✅ Generation completes successfully

### Test 3.2: Generation without Assets
**Steps:**
1. Delete all assets (or no assets uploaded)
2. Create course
3. Click "Proceed to Generation"
4. Click "Skip Assets & Generate"

**Expected Results:**
- ✅ Modal shows "No assets found"
- ✅ Can proceed without assets
- ✅ All images generated with Flux
- ✅ Generation completes normally

### Test 3.3: Mixed Asset/Flux Generation
**Steps:**
1. Upload only "reactor" asset
2. Create course mentioning reactor, safety, equipment
3. Proceed with generation
4. Keep reactor selected, unselect others (if they exist)

**Expected Results:**
- ✅ Reactor slides use custom asset
- ✅ Safety/equipment slides use Flux
- ✅ Mixed approach works seamlessly
- ✅ Course generated with both asset + AI images

### Test 3.4: Asset Usage Logging
**Steps:**
1. Complete generation with selected assets
2. Open database or check asset_usage_log directly

**Expected Results:**
- ✅ Asset usage recorded in DB
- ✅ Correct courseId, userId, assetId
- ✅ Correct slide_number and slide_title
- ✅ Timestamp recorded

### Test 3.5: Asset Usage Stats
**Steps:**
1. Use same asset in 2-3 different courses
2. Check asset edit modal

**Expected Results:**
- ✅ Asset shows "Used in 2 courses"
- ✅ Usage count accumulates correctly
- ✅ Stats visible in asset list

---

## PHASE 4: UI/UX & Edge Cases

### Test 4.1: File Upload Validation
**Steps:**
1. Try uploading file >10MB
2. Try uploading non-image file (.txt, .pdf)
3. Try uploading 1000x1000 JPG (valid)

**Expected Results:**
- ✅ >10MB file rejected with message
- ✅ Non-image rejected with message
- ✅ Valid file accepted
- ✅ Clear error messages

### Test 4.2: Modal Responsiveness
**Steps:**
1. Open asset modal on mobile (375px) and desktop (1920px)
2. Expand assets, scroll, interact

**Expected Results:**
- ✅ Modal responsive on all sizes
- ✅ Text readable
- ✅ Buttons clickable
- ✅ No overflow issues

### Test 4.3: Network Failure Handling
**Steps:**
1. Disable network
2. Try to open AssetMatchingModal (should fail gracefully)
3. Re-enable network

**Expected Results:**
- ✅ Graceful error message
- ✅ No hard crashes
- ✅ Can retry after network restored
- ✅ Generation fallback to Flux works

### Test 4.4: Concurrent Asset Uploads
**Steps:**
1. Start uploading multiple assets (3+) simultaneously
2. Wait for all to complete

**Expected Results:**
- ✅ All uploads succeed
- ✅ Each tagged separately
- ✅ No conflicts or overwriting
- ✅ All appear in asset list

### Test 4.5: Database Constraints
**Steps:**
1. Try uploading 51st asset (limit is 50)
2. Check error handling

**Expected Results:**
- ✅ 51st asset rejected
- ✅ Clear message about limit
- ✅ Suggestion to manage/delete assets

---

## PHASE 5: Security & Multi-Tenancy

### Test 5.1: User Isolation
**Steps:**
1. Create two test user accounts
2. User A uploads "reactor" asset
3. User B tries to see User A's assets (via direct DB query)
4. User B tries to use User A's asset in course

**Expected Results:**
- ✅ User B cannot see User A's assets in modal
- ✅ Direct DB query respects RLS policies
- ✅ User A's assets not available to User B
- ✅ Storage path isolation enforced

### Test 5.2: Signed URL Security
**Steps:**
1. Get signed URL from modal preview
2. Copy URL
3. Wait 1+ hour (TTL is 3600 seconds)
4. Try to access URL

**Expected Results:**
- ✅ Fresh preview loads with signed URL
- ✅ Expired URL (after 1+ hour) fails
- ✅ Error message or 403 Forbidden

### Test 5.3: Asset Deletion Cascade
**Steps:**
1. Use asset in course (generate)
2. Delete asset
3. Check if asset usage logs still exist

**Expected Results:**
- ✅ Asset soft-deleted (deleted_at set)
- ✅ Usage logs preserved
- ✅ Asset no longer appears in library
- ✅ Generated course unaffected

---

## PHASE 6: Performance & Analytics

### Test 6.1: Large Asset Library
**Steps:**
1. Upload 30-50 assets
2. Search/filter (future feature)
3. Generate course with many assets

**Expected Results:**
- ✅ Modal loads in <2 seconds
- ✅ Asset matching completes quickly
- ✅ No UI lag or freezing
- ✅ Generation not significantly slower

### Test 6.2: Asset Reusability
**Steps:**
1. Use asset1 in 5 different courses
2. Check asset_usage_log for all 5 uses
3. Check "Used in X courses" count

**Expected Results:**
- ✅ Asset can be reused indefinitely
- ✅ Usage properly logged each time
- ✅ Stats accumulate correctly
- ✅ No performance degradation

---

## Test Coverage Checklist

- [ ] Phase 1: Upload & Management (5 tests)
- [ ] Phase 2: Matching & Modal (6 tests)
- [ ] Phase 3: Pipeline Integration (5 tests)
- [ ] Phase 4: UI/UX & Edge Cases (5 tests)
- [ ] Phase 5: Security & Multi-Tenancy (3 tests)
- [ ] Phase 6: Performance & Analytics (2 tests)

**Total: 26 tests**

---

## Test Data Setup

### Sample Assets to Create
```
1. reactor.jpg (tagged: "reactor", "equipment", "industrial")
2. safety-gear.jpg (tagged: "safety", "equipment", "ppe")
3. control-panel.jpg (tagged: "control-panel", "instrument", "equipment")
4. facility.jpg (tagged: "facility", "industrial", "warehouse")
5. procedure.jpg (tagged: "procedure", "process", "step-by-step")
```

### Sample Course Content
```
Course A: "Reactor Safety Training"
- Mentions: reactor, safety, equipment, facility
- Expected matches: 1, 2, 4

Course B: "Control Room Operations"
- Mentions: control-panel, procedure, equipment
- Expected matches: 3, 5

Course C: "Generic Training"
- No specific mentions
- Expected matches: none
```

---

## Known Limitations & Future Work

- [ ] Asset search/filtering
- [ ] Asset categories
- [ ] Bulk upload
- [ ] Asset versioning
- [ ] AI-powered auto-tagging
- [ ] Shared asset library (team/org level)
- [ ] Asset usage analytics dashboard
