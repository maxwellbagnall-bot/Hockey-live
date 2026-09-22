# Hockey Live

A first working MVP for a community-powered field-hockey live scoring platform.

## What this MVP includes

- Mobile-first live-score homepage
- Match centre with score, period and minute
- Community / Confirmed / Official trust levels
- Scorer mode for goals, short corners, cards, period changes and commentary
- Live match timeline
- A real 1080 × 1080 PNG social share graphic stamped **Powered by Hockey Live**
- Supabase client stub and starter SQL schema for clubs, teams, matches and events
- Demo mode that works before any backend is connected

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and anon key.
5. Replace the in-memory demo mutations in `components/HockeyLiveApp.tsx` with Supabase inserts/subscriptions.

## Suggested next build stage

1. Email / magic-link sign-in
2. Club and team directory
3. Create-match flow
4. Realtime Supabase subscriptions
5. Reporter verification / confirmation workflow
6. League tables and fixtures
7. Public share URLs and OpenGraph score cards
8. PWA installability and push alerts

## Deployment

This project is designed for Vercel. Import the GitHub repository into Vercel, add the Supabase environment variables, and deploy.
