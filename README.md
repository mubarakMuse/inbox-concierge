# Inbox Concierge

Gmail inbox organized into buckets (Important, Can wait, Auto-archive, Newsletter, Other) using OpenAI classification. Connect Gmail, fetch recent threads, view by bucket, add custom buckets, and recategorize.

**Stack:** React (Vite), Node/Express, Google OAuth (Gmail + email), OpenAI, Supabase (Postgres).

---

## Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/inbox-concierge.git
cd inbox-concierge
```

Then follow **How to run** below.

---

### 1. Install dependencies

From the repo root:

```bash
cd client && npm install && cd ..
cd server && npm install
```

### 2. Configure environment

- Copy `server/.env.example` to `server/.env`.
- Fill in (see **Environment variables** below):
  - Google OAuth (Gmail API, OAuth 2.0 Web application)
  - OpenAI API key
  - Supabase URL and service role key
  - `COOKIE_SECRET` for production

### 3. Start the app

**Terminal 1 – backend:**

```bash
cd server && npm run dev
```

Backend runs at **http://localhost:5001**.

**Terminal 2 – frontend:**

```bash
cd client && npm run dev
```

Frontend runs at **http://localhost:5173**. Open that URL in the browser.

---

## How to test

**Server (API + classification):**

```bash
cd server && npm test
```

**Client (React components):**

```bash
cd client && npm test
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From [Google Cloud Console](https://console.cloud.google.com/): create a project, enable Gmail API, create OAuth 2.0 credentials (Web application). Set redirect URI to `http://localhost:5001/api/auth/callback`. If the app is in Testing, add test users in OAuth consent screen. |
| `OPENAI_API_KEY` | From [OpenAI](https://platform.openai.com/api-keys). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | From your [Supabase](https://supabase.com) project. Run `server/db/schema.sql` in the Supabase SQL Editor to create tables. |
| `COOKIE_SECRET` | Random string for signing cookies; required in production. |
| `NODE_ENV` | `development` (default) or `production`. |

---

## Pushing to GitHub

The repo is ready to push. Secrets are ignored via `.gitignore` (`.env`, `server/.env`, etc.). Do **not** commit `.env` files.

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/inbox-concierge.git
git branch -M main
git push -u origin main
```

---

## Project layout

| Path | Description |
|------|-------------|
| `client/` | React (Vite) frontend |
| `server/` | Express API: auth, Gmail, classification, buckets |
| `server/db/schema.sql` | Supabase/Postgres table definitions |
| `server/db/cleanup.sql` | Script to reset data (run in Supabase SQL Editor) |
| `DEPLOY.md` | Deploy steps (e.g. Railway + Netlify) and production env vars |

**Storage:** All data lives in Supabase; no local DB. Users are identified by Google email; a signed cookie authenticates API requests.

**Reset data:** Run `server/db/cleanup.sql` in the Supabase SQL Editor, then use Disconnect in the app and sign in again.
