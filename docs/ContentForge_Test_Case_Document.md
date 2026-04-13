# ContentForge Test Case Document

## 1. Document Information
- Product: ContentForge
- Version: Current workspace build
- Date: 2026-04-12
- Prepared by: QA Support
- Purpose: Define manual and automation-ready test cases for core ContentForge workflows.

## 2. Scope
This document covers:
- Opening and navigation flows
- Course setup and validation behavior
- Multi-agent generation pipeline behavior
- Learner preview behavior, including sticky trainer panel
- Video workflow integration behavior
- SCORM packaging and output quality
- Error handling, resilience, and basic non-functional checks

Out of scope for this document:
- Third-party platform internal correctness (Supabase, YouTube, ElevenLabs internals)
- Deep load testing at enterprise scale
- Penetration testing and full security audit

## 3. Test Levels and Approach
- Smoke tests: Critical path sanity checks per deployment
- Functional tests: Feature-by-feature behavior validation
- Integration tests: UI to serverless function and data flow checks
- Regression tests: Stable replay suite for previously fixed issues
- UAT tests: Business acceptance and training-readiness checks

## 4. Environments
- Local: Vite dev server on localhost
- Browser targets: Chrome latest, Edge latest, Firefox latest
- Responsive targets:
  - Desktop: 1920x1080, 1366x768
  - Tablet: 1024x768
  - Mobile: 390x844
- Network profiles: Normal, Slow 3G simulation, Offline simulation

## 5. Entry and Exit Criteria
Entry criteria:
- App builds successfully
- Environment variables configured for required integrations
- Supabase functions reachable

Exit criteria:
- 100 percent pass for critical and high-priority tests
- No open Sev-1 or Sev-2 defects
- Known medium defects documented with workaround and approval

## 6. Defect Severity Guide
- Sev-1: System unusable, data loss, or blocking critical path
- Sev-2: Major feature broken, no acceptable workaround
- Sev-3: Feature works with limitations or UI/UX inconsistency
- Sev-4: Minor cosmetic issue

## 7. Functional Test Cases

### 7.1 Opening Page and Navigation

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-ONB-001 | Opening page loads successfully | App running | Open root route | Welcome page renders without crash | High |
| CF-ONB-002 | Start Creating navigation | On opening page | Click Start Creating | Navigate to studio route | High |
| CF-ONB-003 | How It Works navigation | On opening page | Click How It Works | Navigate to help route | Medium |
| CF-ONB-004 | Opening animations complete | On opening page | Wait for intro completion | Intro transitions to interactive hero state | Medium |
| CF-ONB-005 | Bottom offering strip visible | On opening page | Observe bottom area | UniTol offering text and logo visible at bottom | High |

### 7.2 Course Parameters and Validation

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-PRM-001 | Course setup dialog opens | In studio page | Click generate/start action that opens setup | Setup dialog is displayed | High |
| CF-PRM-002 | Default values are populated | Setup dialog open | Inspect controls | Reasonable defaults are selected | Medium |
| CF-PRM-003 | Duration mismatch warning appears | Estimated content differs by more than 20 percent | Select mismatched duration and confirm | Mismatch warning modal appears | High |
| CF-PRM-004 | Mismatch text is readable | Mismatch warning shown | Read warning and button labels | No garbled or foreign characters | High |
| CF-PRM-005 | Proceed with suggested duration path | Mismatch warning shown | Click suggested duration option | Duration adjusted near estimate and generation starts | High |
| CF-PRM-006 | Keep selected duration path | Mismatch warning shown | Click keep selected duration | Selected duration retained and generation starts | High |
| CF-PRM-007 | Trainer auto-select by language | Setup dialog open | Change narrator language to Indian language with auto mode on | Trainer auto-switches to India trainer | Medium |
| CF-PRM-008 | Trainer manual override persists | Setup dialog open | Disable auto mode and choose trainer | Selected trainer persists after language changes | Medium |
| CF-PRM-009 | Slide readability controls accepted | Setup dialog open | Set max lines, min font size, spacing and confirm | Parameters passed without validation errors | Medium |

### 7.3 Agent Pipeline

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-AGT-001 | Pipeline starts with selected toggles | Valid setup parameters | Start generation | Agent statuses move from idle to running/queued | High |
| CF-AGT-002 | Stop pipeline action works | Pipeline running | Click stop | Running process halts and UI reflects stop | High |
| CF-AGT-003 | Agent logs are displayed | Pipeline running or complete | Open orchestrator/log area | Logs stream and remain readable | Medium |
| CF-AGT-004 | Partial output handling | One downstream agent fails | Run pipeline under controlled failure | Prior successful outputs remain visible | High |
| CF-AGT-005 | Duration-guided structure quality | Duration set to short and long values | Run two generations with same topic | Output module/topic density scales with duration | Medium |

### 7.4 Learner Preview Core

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-LRN-001 | Learner preview opens from output | Pipeline produced output | Click Preview as Learner | Full-screen learner preview opens | High |
| CF-LRN-002 | Slide navigation forward/back works | Learner preview open | Use next/previous controls | Correct slide transitions occur | High |
| CF-LRN-003 | Module progress indicators update | Learner preview open | Navigate through module slides | Progress metrics update correctly | Medium |
| CF-LRN-004 | Sticky trainer panel on desktop | Learner preview open at desktop width | Scroll long content slide | Trainer panel stays fixed on side | High |
| CF-LRN-005 | Trainer panel not overlapping content | Learner preview open | Scroll through multiple templates | Content remains readable, no overlap artifacts | High |
| CF-LRN-006 | Trainer media is reasonably large | Learner preview open | Inspect trainer card/video area | Trainer appears prominent, not tiny avatar blob | High |
| CF-LRN-007 | Trainer caption overlay renders | Trainer media visible | Trigger narration streaming | Caption-style text overlay appears and updates | Medium |
| CF-LRN-008 | Trainer controls work in video mode | Avatar video available | Toggle play and mute | Media responds correctly | Medium |
| CF-LRN-009 | Fallback image mode works | Avatar video unavailable | Open trainer panel | Trainer image card displays with status badge | Medium |
| CF-LRN-010 | Assessment screen behavior | Course includes quiz | Reach assessment slide and answer | Correct/incorrect feedback and completion logic works | High |

### 7.5 Video Workflow and Placement

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-VID-001 | Video workflow opens after YouTube output | YouTube agent output available | Complete pipeline | Video clip workflow appears | High |
| CF-VID-002 | Clip selection and insertion | Video workflow open | Pick clips and placement then complete | Clips inserted at selected module positions | High |
| CF-VID-003 | Skip workflow path | Video workflow open | Choose skip | Workflow closes without blocking preview | Medium |
| CF-VID-004 | Video metadata display | Clips loaded | Inspect card details | Title, channel, duration, thumbnail are shown | Medium |

### 7.6 SCORM Export

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-SCM-001 | SCORM export generated | Complete course output available | Trigger SCORM export | Downloadable SCORM package created | High |
| CF-SCM-002 | Package structure sanity | SCORM exported | Unzip artifact | Required HTML/manifest assets exist | High |
| CF-SCM-003 | Export content formatting | SCORM exported | Open module HTML | Narrator, topic pills, markdown and takeaways render correctly | Medium |
| CF-SCM-004 | Mobile style checks in export | SCORM module open in narrow viewport | Resize browser | Responsive behavior remains usable | Medium |

### 7.7 Error Handling and Resilience

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-ERR-001 | Supabase function timeout | Simulate delayed response | Start pipeline | User sees clear error state and no app crash | High |
| CF-ERR-002 | Network disconnect mid-generation | Pipeline running | Disable network | Failure is surfaced and controls recover | High |
| CF-ERR-003 | Invalid JSON from agent | Mock malformed function output | Run affected step | Parser fallback or error messaging shown gracefully | High |
| CF-ERR-004 | Missing media asset fallback | Missing trainer image/video URL | Open learner preview | Fallback UI appears without broken layout | Medium |
| CF-ERR-005 | Unknown route handling | App running | Open invalid route | Not Found page shown | Low |

### 7.8 Accessibility and Usability

| Test ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| CF-ACC-001 | Keyboard-only navigation | App running | Navigate core flow via keyboard | Focus order is logical and actionable controls reachable | High |
| CF-ACC-002 | Dialog focus trap | Setup or mismatch dialog open | Tab through controls | Focus remains in dialog until closed | High |
| CF-ACC-003 | Color contrast basic check | App running | Inspect key text on backgrounds | Text contrast is readable in key screens | Medium |
| CF-ACC-004 | Screen reader label sanity | App running with screen reader tooling | Inspect major controls | Buttons and media controls have meaningful labels | Medium |

## 8. Non-Functional Test Cases

| Test ID | Category | Scenario | Expected Result | Priority |
|---|---|---|---|---|
| CF-NFR-001 | Performance | Initial page load on normal network | First usable render within acceptable team SLA | Medium |
| CF-NFR-002 | Performance | Learner preview slide transition smoothness | No severe frame drops in standard desktop hardware | Medium |
| CF-NFR-003 | Reliability | Repeated pipeline runs | No memory leak symptoms or progressive UI degradation | Medium |
| CF-NFR-004 | Compatibility | Browser compatibility | Critical flows pass on Chrome, Edge, Firefox | High |
| CF-NFR-005 | Security | Secrets handling in UI | No secret keys rendered in client logs or visible panels | High |

## 9. Regression Suite Recommendation
Run this minimum suite before each release:
- CF-ONB-001, CF-ONB-002, CF-ONB-005
- CF-PRM-003, CF-PRM-004, CF-PRM-005, CF-PRM-006
- CF-AGT-001, CF-AGT-002
- CF-LRN-001, CF-LRN-004, CF-LRN-006, CF-LRN-010
- CF-VID-001, CF-VID-002
- CF-SCM-001, CF-SCM-002
- CF-ERR-001, CF-ERR-002

## 10. Automation Mapping
Suggested split:
- Unit tests with Vitest:
  - Parsing utilities, duration planning logic, SCORM formatting utilities
- Component tests with Testing Library:
  - Course parameter dialog behavior
  - Mismatch warning actions
  - Avatar narrator fallback and controls
- End-to-end with Playwright:
  - Opening page to studio navigation
  - Setup to generation happy path
  - Learner preview sticky trainer behavior
  - SCORM export smoke

## 11. Test Data Matrix
Use at least these datasets:
- Data Set A: Short plain-text notes for 3-5 minute target
- Data Set B: Medium structured notes for 10-15 minute target
- Data Set C: Long enterprise policy content for 30-45 minute target
- Data Set D: Multilingual input with Indian language narrator selection
- Data Set E: Content with special characters and markdown formatting

## 12. Traceability Matrix

| Feature Area | Related Test IDs |
|---|---|
| Opening and routing | CF-ONB-001 to CF-ONB-005 |
| Course setup and validation | CF-PRM-001 to CF-PRM-009 |
| Agent pipeline | CF-AGT-001 to CF-AGT-005 |
| Learner preview and trainer panel | CF-LRN-001 to CF-LRN-010 |
| Video workflow | CF-VID-001 to CF-VID-004 |
| SCORM export | CF-SCM-001 to CF-SCM-004 |
| Error handling | CF-ERR-001 to CF-ERR-005 |
| Accessibility and usability | CF-ACC-001 to CF-ACC-004 |
| Non-functional quality | CF-NFR-001 to CF-NFR-005 |

## 13. Execution Template
For each executed test, capture:
- Test ID
- Build/version
- Tester
- Date/time
- Result: Pass/Fail/Blocked
- Defect ID if failed
- Evidence link (screenshot/video/log)

## 14. Sign-Off
Release sign-off requires:
- QA lead approval
- Product owner approval
- Engineering approval for open known issues
