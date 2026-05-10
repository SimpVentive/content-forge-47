# TODO — Remaining Work Items

## High Priority

### Admin Dashboard
- [ ] **Agent Health Telemetry** — Wire real latency + error rate data from agent runs
  - Location: `src/pages/admin/Dashboard.tsx` (line 217)
  - Need: Log agent execution metrics to database
  
- [ ] **API Cost Tracking** — Track and display cost per provider call
  - Location: `src/pages/admin/Dashboard.tsx` (line 224)
  - Need: Log token usage from each provider, calculate cost

### Email Notifications
- [ ] **Low Credits Alert** — Send email when balance < 10% of plan
  - Need: Create scheduled job (Supabase cron) to check profiles daily
  - Template exists in `supabase/functions/send-email/index.ts`
  
- [ ] **Invoice Email** — Auto-send GST invoice 24h after payment
  - Location: `supabase/functions/razorpay-verify/index.ts`
  - Need: Hook to invoice generation service (currently manual)

## Medium Priority

### UI/UX
- [ ] **Mobile Responsiveness** — Test /forge page on mobile, fix layout
  - Index.tsx header + panels may not resize well on small screens
  
- [ ] **Loading States** — Add skeleton screens for Dashboard, Billing pages
  - Async data loads feel slow without visual feedback
  
- [ ] **Error Recovery** — Better error messages when edge functions fail
  - E.g., "Credits spend failed due to DB lock" vs generic "Failed"

### Credit System
- [ ] **Credit Refunds** — Support issuing refunds when generation fails
  - Need: Reverse spend_credits RPC on generation timeout/error
  
- [ ] **Credit Packages** — Allow admins to grant bulk credits to users
  - UI in admin Users page
  - New edge function: `grant-credits` (admin-only)

### Analytics
- [ ] **Course Generation Metrics** — Track success rate, avg cost, avg time
  - Courses per user, completion rate, etc.
  
- [ ] **User Cohorts** — Analyze by signup date, plan tier, usage pattern

## Low Priority

### Feature Extensions
- [ ] **Sandbox Environments** — Let users preview with limited credits
  
- [ ] **Bulk Uploads** — CSV upload to generate courses in batch
  
- [ ] **Webhooks** — Send transaction/generation events to user's API endpoint
  
- [ ] **API Keys** — Let users generate personal API keys for programmatic course generation
  
- [ ] **SSO** — Google/GitHub login via Supabase Auth

### Performance
- [ ] **Code Splitting** — Break up Index.tsx (481 KB) into smaller chunks
  - Use React.lazy() for Video Workflow, Course Parameters, Learner Preview
  
- [ ] **Caching** — Cache agent outputs in Supabase (reduce re-computation)
  
- [ ] **CDN for Assets** — Move avatar videos + images to Cloudfront

### Operations
- [ ] **Monitoring** — Set up Sentry for error tracking across functions
  
- [ ] **Rate Limiting** — Add per-user request limits to edge functions
  
- [ ] **Audit Logs** — Log admin actions (provider config changes, user credit grants)

## Known Issues

- **Chunk Size Warning** — Production build has chunks > 500 KB
  - Not breaking, but should split Index.tsx for faster load times
  
- **LearnerPreview Dynamic Import** — Output panel also imports it statically
  - Vite warning (non-blocking); consider consolidating import

## Data Currently Mocked in Admin

- Dashboard agent health + API cost telemetry
- Agent cost calculations (visible as "—" / "Not tracked yet")
- User support ticket severity/priority (all showing in Conversations)

## Database Migrations Pending

- None — schema is current as of 2026-05-10
- Contact Supabase support if you need backups before major changes

---

**Priority Tiers:**
- **High** — Core functionality gaps (analytics, notifications)
- **Medium** — UX polish + feature completeness
- **Low** — Nice-to-haves + technical debt

Estimated effort: High (3-5 days), Medium (1-2 days), Low (varies).
