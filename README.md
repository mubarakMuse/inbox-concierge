# Inbox Concierge

Gmail inbox organized into buckets (Important, Can wait, Auto-archive, Newsletter, Other) using OpenAI classification. Connect Gmail, fetch recent threads, view by bucket, add custom buckets, and recategorize.

**Stack:** React (Vite), Node/Express, Google OAuth (Gmail + email), OpenAI, Postgres (`pg`; local Docker or AWS RDS).

**Production (lean AWS):** App Runner API + SQS/Lambda jobs + S3/CloudFront SPA + RDS Postgres — see [DEPLOY-AWS.md](./DEPLOY-AWS.md). Local/dev uses `QUEUE_DRIVER=local` (no AWS required).

**Repo:** https://github.com/mubarakMuse/inbox-concierge

---

## Clone the repo

```bash
git clone https://github.com/mubarakMuse/inbox-concierge.git
cd inbox-concierge
```

---

## How to run

### 1. Install dependencies

```bash
cd client && npm install && cd ..
cd server && npm install
```

### 2. Start local Postgres

```bash
docker compose up -d
```

This creates DB `inbox_concierge` and applies `server/db/schema.sql` on first boot.

### 3. Configure environment

Copy `server/.env.example` to `server/.env` and set:

- Google OAuth (Gmail API, OAuth 2.0 Web application)
- OpenAI API key
- `STORAGE_DRIVER=pg`, `DATABASE_URL`, `DATABASE_SSL=false` (defaults in `.env.example`)
- `COOKIE_SECRET` for production

See **Environment variables** below for details.

### 4. Start the app

**Terminal 1 – backend:**

```bash
cd server && npm run dev
```

Backend: **http://localhost:5001**

**Terminal 2 – frontend:**

```bash
cd client && npm run dev
```

Frontend: **http://localhost:5173**

---

## How to test

```bash
cd server && npm test
cd client && npm test
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://cloud.google.com/) — enable Gmail API, OAuth 2.0 Web app, redirect `http://localhost:5001/api/auth/callback` |
| `OPENAI_API_KEY` | [OpenAI API keys](https://platform.openai.com/api-keys) |
| `STORAGE_DRIVER` | `pg` (default) or `supabase` (legacy) |
| `DATABASE_URL` | Postgres URL (required for `pg`) |
| `DATABASE_SSL` | `false` for local Docker; `true` for RDS |
| `COOKIE_SECRET` | Random string for signing cookies (required in production) |
| `FRONTEND_URL` | Frontend origin for CORS and cookies (e.g. `http://localhost:5173`) |
| `OAUTH_REDIRECT_URI` | Backend callback URL |
| `QUEUE_DRIVER` | `local` (default) or `sqs` |
| `SQS_QUEUE_URL` | Required when `QUEUE_DRIVER=sqs` |
| `AWS_REGION` | AWS region for SQS client (default `us-east-1`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Only if `STORAGE_DRIVER=supabase` |

---

## Project layout

| Path | Description |
|------|-------------|
| `client/src/api/` | API client (auth, inbox, buckets) |
| `client/src/components/` | UI and inbox components |
| `client/src/hooks/` | `useInbox` — inbox state and actions |
| `client/src/pages/` | Login, Inbox |
| `server/routes/` | Express routes |
| `server/lib/` | Gmail, classification, storage, auth, queue, jobs |
| `server/db/schema.sql` | Postgres tables |
| `server/lambda/` | SQS Lambda worker entry |
| `docker-compose.yml` | Local Postgres 16 |
| `infra/terraform/` | Lean AWS stack (VPC, RDS, App Runner, SQS, Lambda, S3/CloudFront) |
| `ARCHITECTURE.md` | Design decisions and LLM prompt |
| `DEPLOY-AWS.md` | Lean AWS deploy |
| `DEPLOY.md` | Legacy Railway + Netlify deploy |

**Storage:** Default `STORAGE_DRIVER=pg` (RDS in prod, Docker locally). Optional `supabase` driver remains. User = Google email; signed cookie authenticates requests.

**Reset data:** Run `server/db/cleanup.sql` against Postgres, then Disconnect and reconnect in the app.
