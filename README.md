# ContentForge — AI-Powered Course Generation Platform

A full-stack platform for generating interactive e-learning courses using Claude AI agents, with integrated payment processing, credit system, and admin dashboard.

## Project Structure

```
content-forge-47/
├── src/
│   ├── pages/
│   │   ├── home/              # Public landing page
│   │   ├── admin/             # Admin dashboard (Dashboard, Users, Billing, Providers, Conversations)
│   │   ├── Index.tsx          # Main forge course generator (protected)
│   │   ├── Login.tsx, Signup.tsx, Welcome.tsx
│   ├── components/
│   │   ├── home/              # Landing page sections (Hero, Pricing, Features)
│   │   ├── contentforge/      # Course generation (AgentPipeline, OutputPanel, etc.)
│   │   ├── admin/             # Admin UI components
│   │   ├── auth/              # Auth guards (ProtectedRoute, AdminRoute)
│   │   ├── ui/                # shadcn UI components
│   │   └── InsufficientCreditsModal.tsx
│   ├── hooks/
│   │   ├── useAuth.tsx        # Auth context + profile management
│   │   └── useAgentPipeline.tsx
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client
│   │   ├── edgeFunctions.ts   # Edge function helpers (credits-spend, razorpay-*)
│   │   └── courseDrafts.ts    # Draft persistence
│   └── types/
│
├── supabase/
│   └── functions/             # Edge functions (TypeScript/Deno)
│       ├── provider-config-write/  # Encrypt + store API keys
│       ├── provider-test/          # Test provider connectivity
│       ├── credits-spend/          # Deduct credits atomically
│       ├── razorpay-create-order/  # Initiate Razorpay payment
│       ├── razorpay-verify/        # Verify + grant credits
│       ├── send-email/             # Send transactional emails (Resend)
│       ├── generate-invoice/       # Return signed invoice URL
│       └── _shared/                # Auth, encryption, CORS helpers
│
├── .env.example               # All env vars documented
├── vercel.json               # SPA routing + caching headers
└── package.json
```

## Route Map

### Public Routes
- `/` — Landing page (Hero, Features, Pricing, FAQ)
- `/login` — Sign in
- `/signup` — Create account
- `/help` — Help/support page
- `/welcome` — Post-signup onboarding

### Protected Routes (requires auth)
- `/forge` — Main course generator (credit check before pipeline)
- `/studio` — Alias for /forge

### Admin Routes (requires admin role)
- `/admin` — Dashboard (credit stats, top users)
- `/admin/users` — User management
- `/admin/billing` — Transaction history + revenue metrics
- `/admin/providers` — API key management (OpenAI, Anthropic, ElevenLabs, YouTube)
- `/admin/conversations` — Support conversations

## Features

### Course Generation
- Multi-agent pipeline (architect, infographic, avatar, video, etc.)
- Real-time orchestration logs
- Preview as learner
- Draft saving/loading

### Credits System
- **1 credit = 1 minute** of generated content
- Atomic credit deduction (RPC-based)
- Insufficient credits modal with pricing link
- Real-time balance display in forge navbar

### Payment (Razorpay)
- UPI + card payments
- 4 credit packs: 10, 50, 200, 500 credits
- Test mode (rzp_test_) and live mode (rzp_live_)
- Invoice PDFs auto-generated + sent via email
- Transaction history in admin billing page

### Admin Dashboard
- Platform metrics (users, revenue, credit utilization)
- Top users by credit usage
- Billing transaction list with filters (status, date, user)
- Provider health & API cost tracking (TODO)

### Admin Providers Page
- Manage API keys for external services (Anthropic, OpenAI, ElevenLabs, YouTube)
- AES-GCM encryption at rest
- Connectivity testing before deployment

## Local Setup

### Prerequisites
- Node.js 18+ with npm/bun
- Supabase CLI (for local edge functions)
- Git

### Installation

```bash
cd content-forge-47

# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env.local

# 3. Fill in required vars in .env.local:
#    - VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
#    - VITE_RAZORPAY_KEY_ID (use test key)
#    - RAZORPAY_KEY_SECRET (for edge functions)
#    - RESEND_API_KEY, EMAIL_FROM (for emails)
#    - ANTHROPIC_API_KEY (for course generation)
#    - Avatar asset URLs (optional)

# 4. Start dev server
npm run dev
```

Server runs on `http://localhost:8080`

### Supabase Local (optional)
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Run migrations + seed data
supabase db push

# Test edge functions locally
supabase functions serve
```

## Building & Deployment

### Build Locally
```bash
npm run build
npm run preview  # Test production build
```

### Deploy to Vercel

1. **Push to GitHub** (if not already)
   ```bash
   git remote add origin https://github.com/your-org/content-forge.git
   git push origin main
   ```

2. **Import in Vercel**
   - Go to vercel.com, click "Add New Project"
   - Import the GitHub repo
   - Set Root Directory to `content-forge-47`
   - Click Deploy

3. **Set Environment Variables** in Vercel Project Settings:
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_PUBLISHABLE_KEY
   VITE_RAZORPAY_KEY_ID
   (+ avatar URLs if using custom avatars)
   ```

   For edge functions (set in Supabase dashboard):
   ```
   RAZORPAY_KEY_SECRET
   RAZORPAY_WEBHOOK_SECRET
   RESEND_API_KEY
   EMAIL_FROM
   ANTHROPIC_API_KEY
   PROVIDER_KEY_ENCRYPTION_SECRET
   (+ other provider keys)
   ```

4. **Verify Deployment**
   - Vercel automatically deploys when you push to main
   - Preview URLs created for pull requests

### SPA Routing
`vercel.json` is pre-configured:
- All routes (/, /login, /forge/*, /admin/*, etc.) rewrite to index.html
- Assets cached indefinitely (cache-busting via hash)

## Environment Variables

See `.env.example` for full reference. Key ones:

**Frontend (VITE_*):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key for client-side auth
- `VITE_RAZORPAY_KEY_ID` — Razorpay public key (test or live)

**Edge Functions (set in Supabase Secrets):**
- `RAZORPAY_KEY_SECRET` — Razorpay secret key
- `RESEND_API_KEY` — Email service API key
- `ANTHROPIC_API_KEY` — Claude API key
- `PROVIDER_KEY_ENCRYPTION_SECRET` — Master key for encrypting stored API keys
- `ALLOWED_ORIGIN` — CORS origin

## Payment Testing

### Test Mode
- Use `rzp_test_*` keys in `.env`
- Test card: `4111 1111 1111 1111`, any future date, any CVV
- After payment, credits are instantly added
- Transactions visible in admin billing page

### Switching to Live
Replace `rzp_test_*` with `rzp_live_*` keys (from Razorpay dashboard).

## Database Schema (Key Tables)

- `profiles` — User accounts with credits_total, credits_used
- `billing_transactions` — Payment records (Razorpay orders)
- `provider_configs` — Encrypted API keys for external services
- `conversations` — Support ticket system
- (Course drafts stored in browser IndexedDB, synced to Supabase)

## API Documentation

### Edge Functions

**POST /credits-spend**
- Deduct credits from user's balance
- Returns: `{ remaining_credits }`
- Auth: User JWT

**POST /razorpay-create-order**
- Create Razorpay order + billing transaction
- Body: `{ credits_purchased, amount_inr_paise, receipt? }`
- Returns: `{ order_id, amount, currency, key_id }`
- Auth: User JWT

**POST /razorpay-verify**
- Verify payment signature + grant credits
- Body: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- Returns: `{ transaction_id, credits_granted }`
- Auth: User JWT

**POST /send-email**
- Send transactional email (welcome, receipt, low-credit alert)
- Auth: User JWT (admin) or service-role key (internal)

**POST /provider-config-write**
- Add/update encrypted API key for provider
- Auth: Admin JWT

**POST /provider-test**
- Test connectivity to provider API
- Returns: `{ ok, status_code, latency_ms, message }`
- Auth: Admin JWT

See `supabase/functions/*/index.ts` for full specs.

## Common Tasks

### Add a New Course Agent
1. Update `AGENTS` array in `src/types/agents.ts`
2. Create agent logic in `supabase/functions/claude/` or as a new function
3. Hook into `AgentPipeline` component
4. Update course parameters dialog if needed

### Add Admin Page
1. Create page in `src/pages/admin/YourPage.tsx`
2. Add route in `App.tsx` under `/admin` parent
3. Add link in admin nav (AdminShell)

### Email Templates
- Edit `renderTemplate()` in `send-email/index.ts`
- Add new case for template type
- Test with admin panel or send-email function direct call

### Update Avatar Assets
- Upload video + poster to CDN
- Update env vars: `VITE_AVATAR_VIDEO_URL`, `VITE_AVATAR_VIDEO_POSTER_URL`, etc.
- For trainer-specific overrides, use `_PRIYA`, `_ARJUN`, etc.

## Troubleshooting

**"You're running low on credits" email not sending?**
- Check `RESEND_API_KEY` in Supabase secrets
- Verify `EMAIL_FROM` is a verified sender in Resend dashboard

**Payment verification failed?**
- Ensure `RAZORPAY_KEY_SECRET` matches your Razorpay dashboard
- Check webhook secret if using Razorpay webhooks

**Course generation times out?**
- Increase Supabase function timeout (default 600s)
- Check Claude API rate limits (Anthropic dashboard)

**Admin pages show "Access Denied"?**
- Verify user `role = 'admin'` in `profiles` table
- Check JWT is being sent with Authorization header

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am "Add my feature"`
3. Push: `git push origin feature/my-feature`
4. Create PR in GitHub
5. Vercel creates preview URL automatically
6. Test, then merge to main when approved
7. Vercel deploys to production

## License

Proprietary — ContentForge Inc.

---

**Questions?** See `/help` page or contact support.
