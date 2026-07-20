# Bug Report: Inaccurate Duration Estimation for PDF and Large Documents

## Issue
When uploading a 100-page PDF, the system estimates the e-learning duration as ~1 minute, which is grossly inaccurate. A 100-page PDF should realistically require 15-30+ minutes of e-learning content.

## Root Causes

### Primary Issue: PDF Text Extraction
The Gemini-based PDF text extraction (in `supabase/functions/extract-document/index.ts`) may be:
1. Not properly extracting all text from PDFs
2. Truncating large PDFs
3. Losing structure and formatting

### Secondary Issue: Inconsistent Word-Count Assumptions
Two different word-per-minute rates are used:
- **creditEstimator.ts**: Uses 130 WPM (line 59)
- **Sidebar.tsx**: Uses 150 WPM (line 13)

This inconsistency causes mismatch between credit estimation and actual duration display.

### Tertiary Issue: Minimum Word Count Floor
- creditEstimator.ts minimum: 100 words (line 31) → ~0.77 min, rounds to 1 min
- This causes any extracted text <100 words to appear as "~1 min"

## Impact
- Users upload large PDFs expecting 15+ minute courses
- System estimates ~1 minute
- Mismatch warning appears suggesting duration is too long
- User confusion and loss of trust

## Fix Strategy
1. Normalize word-per-minute rate to 130 across all files
2. Improve PDF extraction with better error handling
3. Remove artificial minimums that mask extraction failures
4. Add diagnostic logging for debugging extraction issues
