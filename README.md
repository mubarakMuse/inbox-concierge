# Inbox Concierge

Gmail inbox sorted into clear buckets with OpenAI — so you open email knowing what needs you first.

**Live demo:** https://d3gzmqrj5f4ege.cloudfront.net  
**API health:** https://mqijrgviks.us-east-1.awsapprunner.com/api/health  
**Repo:** https://github.com/mubarakMuse/inbox-concierge

Connect Gmail → classify ~200 recent threads → browse **Important / Can wait / Auto-archive / Newsletter / Other** (plus custom buckets). Correct a mis-sort with one click, or open the thread in Gmail.

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React (Vite) on **S3 + CloudFront** |
| API | Express on **AWS App Runner** |
| Jobs | **SQS + Lambda** (classify / recategorize) |
| Database | **RDS Postgres** |
| Auth | Google OAuth (`gmail.readonly`) + signed cookie |
| AI | OpenAI (`gpt-4o-mini` by default) |
| Infra | Terraform (`infra/terraform`) |

Locally, jobs run in-process (`QUEUE_DRIVER=local`) and Postgres runs via Docker Compose.

---

## Quick start (local)

**Requirements:** Node 20+, Docker, Google OAuth web client, OpenAI API key.

```bash
# 1. Database (host port 5434 → container 5432)
docker compose up -d

# 2. API env
cp server/.env.example server/.env
# Fill: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY
# Defaults already point at local Postgres on 5434

# 3. API
cd server && npm install && npm run dev
# → http://localhost:5001

# 4. Client (new terminal)
cd client && npm install && npm run dev
# → http://localhost:5173
```

Google OAuth (local):

- Redirect URI: `http://localhost:5001/api/auth/callback`
- JS origin: `http://localhost:5173`

---

## Test

```bash
cd server && npm test && npm run lint
cd client && npm test && npm run lint
```

---

## What to try in the product

1. **Connect Gmail** on the live site or locally  
2. **Fetch & classify** — watch job progress (async worker)  
3. Land on **Important** with a summary line  
4. Use **Wrong bucket?** chips (includes custom buckets)  
5. **Open in Gmail** on a thread  
6. **Refresh / Buckets / Account** in the header  

---

## Deploy (AWS)

See [DEPLOY-AWS.md](./DEPLOY-AWS.md) for Terraform, ECR images, App Runner, Lambda, and CloudFront.

---

## Architecture notes

See [ARCHITECTURE.md](./ARCHITECTURE.md) for auth, job queue, classification, and storage details.

**High level:** the API stays thin; Gmail fetch + OpenAI run as jobs (local or SQS/Lambda). Progress is polled via `GET /api/inbox/jobs/:id`. OAuth tokens live in Postgres (optional encryption with `TOKEN_ENCRYPTION_KEY`).
