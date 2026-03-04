# Inbox Concierge

Gmail inbox in buckets (Important, Can wait, Auto-archive, Newsletter, Other) via OpenAI classification. Connect Gmail, fetch last 200 threads, view by bucket, add custom buckets, recategorize.

**Stack:** React (Vite), Node/Express, Google OAuth (Gmail + email), OpenAI, Supabase (Postgres).

## Setup

1. `npm install` in repo root, then in `client/` and `server/`.
2. Copy `server/.env.example` → `server/.env`. Set:
   - Google OAuth: create [Cloud project](https://console.cloud.google.com/), enable Gmail API, OAuth 2.0 Web app, redirect `http://localhost:5001/api/auth/callback`. If app is in Testing, add test user under OAuth consent screen.
   - OpenAI API key.
   - Supabase: create project, run `server/db/schema.sql` in SQL Editor, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run: `cd server && npm run dev`; in another terminal `cd client && npm run dev`. Frontend :5173, backend :5001.

**Tests:** `cd server && npm test` (unit + API); `cd client && npm test` (React components).

**Storage:** All data in Supabase; no local files. User = email from Google; signed cookie keys requests. Set `COOKIE_SECRET` in production.

**Reset data:** Run `server/db/cleanup.sql` in Supabase SQL Editor, then Disconnect and reconnect in the app.

**Layout:** `client/` = React app; `server/` = Express (auth, gmail, classification, buckets); `server/db/schema.sql` = tables.

**Deploy:** Backend on [Railway](https://railway.app), frontend on [Netlify](https://netlify.com). See [DEPLOY.md](DEPLOY.md) for step-by-step and env vars.
