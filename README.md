# ContentForge

## Deploy To Vercel

1. Push this repository to GitHub.
2. In Vercel, click Add New Project and import the GitHub repository.
3. Set Root Directory to content-forge-47.
4. Vercel will detect Vite automatically.
5. Add Environment Variables in Vercel Project Settings:
	- VITE_SUPABASE_URL
	- VITE_SUPABASE_PUBLISHABLE_KEY
	- Optional avatar media variables from .env.example
6. Click Deploy.

The project includes a vercel.json file for SPA routing and build output.

## Continuous Updates (Push And Deploy)

Yes, updated versions can be pushed continuously.

- Production: push to the main branch, Vercel deploys production automatically.
- Preview: push to feature branches or open PRs, Vercel creates preview URLs automatically.

Recommended branch flow:

1. Create a feature branch.
2. Commit and push changes.
3. Verify on Vercel preview URL.
4. Merge to main when approved.
5. Vercel publishes the new production version.

## Local Commands

- Start dev server: npm run dev
- Build production bundle: npm run build
- Preview build locally: npm run preview
