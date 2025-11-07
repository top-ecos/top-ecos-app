# TopECOS Web App

Modern React + Vite app for ECOS training with simulated patient chat, evaluation, analytics, and a station library. Uses Supabase for auth, data (tables + views), RLS, and Edge Functions.

## Quick Start
- Requirements: Node 18+, npm
- Install dependencies: `npm install`
- Set env vars (see Environment): create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Dev server: `npm run dev` (default preview/serve runs on port 5000)
- Build: `npm run build`

## Environment
- Required
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Supabase Edge Functions used (must exist in your project):
  - `consume-token` (token debit before starting a station)
  - `chat-with-patient` (simulate the standardized patient)
  - `evaluate-performance` (PS/PSS station evaluation)
  - `evaluate-performance-seche` (Sèche/doc-based evaluation)
  - `create-checkout-session` (Stripe checkout)
  - Optional: `stripe-portal`, `stripe-webhook`, `save-results-mock`

## Key Features
- Auth with Supabase; protected routes
- Station library with filters (type, specialty, status) and per-user progress
- Simulation chat (PS/PSS) and documents mode (Sèche)
- Automated evaluation (clinical + communication) with replay and detailed scoring
- Dashboard (KPIs, daily progress, specialty performance) and history
- Premium gating and token system (free users get weekly token renewals)

## Architecture Overview
- Routing: `src/App.tsx` uses React Router with route-level code-splitting
- State/logic:
  - Hooks under `src/hooks` manage chat, evaluation, results, station progress, SDD fetching
  - Session state via `sessionStorage`; chat/timer via `localStorage`
- UI:
  - Components under `src/components` (chat, layout, UI primitives)
  - TailwindCSS with design tokens in `src/index.css`
- Supabase client: `src/integrations/supabase/client.ts`

## Database Schema (in use)
- Tables (public)
  - `sdds`: Source of truth for stations (status, type, specialty, patient sheet, premium, ranked)
  - `profiles`: Per-user profile (tokens, premium flag, pseudo, emoji, metadata)
  - `mock_results`: Saved evaluations with analytics (transcript, subscores, timings, difficulty)
  - `user_station_progress`: Per-user per-station progress (completed, attempts, timestamps)
- Views (public)
  - `user_daily_cumulative_progress`: per-user cumulative daily average score (for charts)
  - `user_dashboard_stats`: global/30d/7d averages + study hours + sessions
  - `user_ranking`: weekly leaderboard based on ranked stations
  - `user_specialty_performance`: per-user average score by specialty
  - `user_training_streaks`: current daily training streak

## SQL Functions & Triggers
- `public.get_user_station_rank(p_station_id text, p_user_id uuid) → text`
  - Returns a user’s percentile rank text (e.g., “Top 35% des étudiants”) for a station.
- `public.update_updated_at_column() → trigger`
  - BEFORE UPDATE helper; sets `NEW.updated_at = now()`.
- `public.set_premium_side_effects() → trigger`
  - On INSERT with `premium=true`: sets `tokens=1000`, `subscription_date=COALESCE(subscription_date, now())`.
  - On UPDATE flipping `premium` false→true: sets `tokens=1000`, `subscription_date=now()`.
  - On UPDATE flipping `premium` true→false: sets `tokens=5`, `subscription_date=now()`.
- `public.refresh_free_user_tokens() → integer`
  - Resets `tokens=5` for all free users (`premium=false`) whose `updated_at` is ≥ 7 days old. Returns rows updated.
  - Example pg_cron schedule (daily UTC):
    `SELECT cron.schedule('daily_free_tokens', '0 0 * * *', $$SELECT public.refresh_free_user_tokens();$$);`

## Notable Modules
- Station helpers: `src/lib/station.ts`
  - `getStationType(sdd)`: normalize PS/PSS/Sèche/Procédure
  - `deriveTypeLabel(sdd)`: UI label (maps Sèche to "Documents")
  - `isDocumentStation(sdd)`: predicate for document-based stations
- Simulation service: `src/lib/simulation.ts`
  - Encapsulates: token consumption → chat init (INIT) → full case fetch → session persistence
  - Returns `{ initialMessage, completeCase, tokensRemaining }`
  - Throws `SimulationError` with friendly messages and error `code`
- Results & analytics: `src/hooks/useResults.ts`
  - Fetches recent sessions (lite/full), computes aggregate stats in full mode.
- Station data: `src/hooks/useSDD.ts`
  - Fetches live stations from `sdds` (least-privilege columns, premium/ranked flags) with caching.
- Document extraction: `src/lib/documents.ts`
  - `extractDocuments(caseData)` consolidates links from individual fields and JSON aggregate, dedupes by URL

## Types
- Case data: `src/types/sdd.ts` (`CaseData`)
- Evaluation: `src/types/evaluation.ts` (`EvaluationResult`, `TranscriptMessage`)

## UI/UX Conventions
- Design tokens in `src/index.css` (CSS variables); prefer tokens over hard-coded hex
  - Examples: `--accent`, `--accent-hover`, `--surface-alt`, `--subtext`
- Primary actions use tokens, e.g.: `bg-[var(--accent)] hover:bg-[var(--accent-hover)]`
- Toasts: `import { toast } from '@/components/ui/sonner'`; use `toast.error/success` instead of `alert`
- Accessibility:
  - Chat messages `aria-live="polite"`, `role="list"/"listitem"`
  - Header controls include `aria-label`

## Data Flow (Simulation)
1) Start from Cases/Dashboard → `startSimulation(...)`
2) Edge: `consume-token` updates tokens server-side; local tokens updated
3) Edge: `chat-with-patient` returns initial message; stored as `initialPatientMessage`
4) `sdds` row fetched with least-privilege columns; merged into `selectedCase`
5) `Simulation` reads from session and renders `ChatInterface`
6) Chat sends/receives via Edge functions; evaluation persists to `mock_results`

## Row Level Security (RLS)
- `profiles`: users can select/update their own row; token changes protected by trigger; deletes disabled by default.
- `mock_results`: users can select/insert/update/delete their own rows (`user_id = auth.uid()`).
- `user_station_progress`: users can select/insert/update/delete their own rows.
- `sdds`: read-only to authenticated users; app fetches live stations; premium gating is enforced in app and can be enforced via RLS.

## Folder Structure (selected)
- `src/pages` — pages for routes (lazy loaded)
- `src/components` — UI and chat components
- `src/hooks` — domain hooks (chat, evaluation, progress, results, sdd)
- `src/lib` — shared helpers/services (station, simulation, documents)
- `src/types` — shared TypeScript types
- `src/integrations/supabase` — Supabase client and types

## Coding Guidelines
- Prefer centralized helpers (station/documents/simulation) over duplicating logic
- Keep UI feedback non-blocking (toasts)
- Strongly type shared shapes (`CaseData`, `EvaluationResult`)
- Use Tailwind + design tokens; avoid inline event-driven style manipulation
- Keep logs concise in production; use `console.debug` in dev where helpful

## Scripts
- `npm run dev` — start dev server
- `npm run build` — production build with code-splitting and chunking
- `npm run preview` — preview production build

## Troubleshooting
- Blank Simulation screen: verify `selectedCase` exists in sessionStorage and contains `sdd_id`
- Missing initial message: ensure `chat-with-patient` Edge function returns a `message` field
- Token errors: confirm `consume-token` is deployed and environment keys are correct
 - Leaderboard empty: ensure some stations are `ranked=true` and users have attempts recorded in `mock_results`
