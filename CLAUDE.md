# LEADstation – notes for Claude

- Repo: mafigotan/leadstation-nextjs. Next.js 15 App Router + Supabase + Vercel.
- **Deploy flow (see DEPLOY.md):** push every change to the `staging` branch first (deploys to https://staging.leadstation.kr).
  Only after the user confirms staging, fast-forward `main` to `staging` (`git merge --ff-only staging`) to release to production.
  Never push to `main` directly unless the user explicitly asks for a hotfix.
- DB changes are new files `supabase/migrations/00NN_*.sql`. The user runs them in the Supabase SQL Editor:
  staging project first, production right before merging to `main`. Also append new migrations to
  `supabase/staging_setup.sql` so a fresh staging DB can be rebuilt from one file.
- Talk to the user in Korean.
