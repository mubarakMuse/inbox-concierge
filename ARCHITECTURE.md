# Inbox Concierge – Architecture

How the code is structured and why certain choices were made (LLM prompt, auth, storage, rate limits, jobs).

---

## 1. Repo layout

| Layer | Path | Role |
|-------|------|------|
| **Frontend** | `client/` | React (Vite). All HTTP calls go through `client/src/api/`. |
| **Backend** | `server/` | Express app. Routes under `/api/auth`, `/api/buckets`, `/api/inbox`; shared middleware and libs. |
| **Storage** | `server/lib/storage.js` | Facade re-exporting `storage-pg.js` (Postgres only). |
| **DB** | `server/db/` | `schema.sql` (tables), `cleanup.sql` (reset). Local: `docker compose up -d`. Prod: RDS. |
| **Infra** | `infra/terraform/` | VPC, RDS, App Runner, SQS, Lambda, S3/CloudFront. |

---

## 2. LLM prompt and classification

**Where:** `server/lib/classification.js` – `buildPrompt()`, `parseResponse()`, `classifyAll()`.

**Design choices:**

- **Single prompt per batch:** The model sees bucket names (including custom), short rules for defaults, and threads (id, subject, snippet). Returns `{ "items": [ { thread_id, bucket, reason } ] }`.
- **Bucket list is dynamic:** Built from `getBuckets(userId)`; custom buckets are included by name.
- **Structured output:** OpenAI `response_format: { type: 'json_object' }`. Unknown bucket names map to **Other**; `reason` capped at 120 chars.
- **Parse failure:** Batch retried once, then those threads assigned **Other**.
- **Model:** `OPENAI_MODEL` (default `gpt-4o-mini`), `temperature: 0.2`.
- **Batching:** Batches of **12**, 600 ms delay between batches; API 429/5xx up to **3** retries with backoff.

---

## 3. Gmail and thread data

**Where:** `server/lib/gmail.js` – `fetchThreads(maxResults, authClient)`.

- **Scope:** `gmail.readonly` + `userinfo.email`. No send or modify.
- **Fetch:** List thread ids, then metadata with Subject header (concurrency **8**). Snippet trimmed to 500 chars. No full body.
- **Limit:** Default 200 threads (Gmail API cap 500).

---

## 4. Auth and user identity

**Where:** `server/lib/auth.js`, `server/routes/auth.js`, `server/middleware/userId.js`, `requireAuth`, `requireGmailAuth`.

- **User ID = email** from Google userinfo after OAuth.
- **Session = signed cookie** `uid` = `base64url(userId).hmac`. Missing/invalid → `req.userId = null`.
- **`requireAuth`:** 401 when `!req.userId`.
- **Token encryption at rest:** When `TOKEN_ENCRYPTION_KEY` is set, tokens stored as `enc:v1:...` (AES-256-GCM). Plaintext rows still readable.

---

## 5. Rate limiting

**Where:** `server/middleware/rateLimit.js`.

- **Auth:** 30 requests / 15 min per IP.
- **Classify/recategorize:** 10 / 15 min per user.
- **Tests:** Limits raised in `NODE_ENV=test`.

---

## 6. Buckets

**Where:** `server/routes/buckets.js`, `server/db/schema.sql`, `server/lib/storage-pg.js`.

- **Defaults:** Important, Can wait, Auto-archive, Newsletter, Other (seeded when empty).
- **Custom:** Name trimmed, max 50 chars; slug id; 409 on duplicate.
- **Delete:** Defaults cannot be removed; classifications for that bucket move to **Other**.

---

## 7. Classification flow (async jobs + polling)

**Where:** `server/lib/runClassifyJob.js`, `server/lib/queue.js`, `server/routes/inbox.js`, `client/src/api/inbox.js`.

- **Jobs table:** `queued` → `running` → `completed`/`failed` with `done`/`total`, optional `result` JSON, `payload` JSONB.
- **Queue:** `QUEUE_DRIVER=local` runs jobs in-process; `QUEUE_DRIVER=sqs` uses SQS + Lambda.
- **Polling:** Client `POST /classify` → `{ jobId }`, then polls `GET /jobs/:jobId` (~800ms) for progress.
- **Force refresh:** `forceRefresh: true` ignores threads cache and refetches Gmail.
- **One active job per user:** Existing `queued`/`running` job is reused (`reused: true`).
- **Partial saves:** Worker saves classifications after each batch.

---

## 8. Recategorize

**Where:** `server/routes/inbox.js` – `POST /recategorize`; client polls `GET /api/inbox/jobs/:id`.

Enqueues a `recategorize` job on the **cached** thread list (no Gmail fetch). Same rate limit and active-job reuse as classify.

---

## 9. Storage and schema

**Where:** `server/lib/storage.js` → `storage-pg.js`, `server/db/schema.sql`.

**Tables:** `buckets`, `classifications`, `threads_cache`, `tokens`, `jobs`.

Postgres only (local Docker or RDS). Optional `TOKEN_ENCRYPTION_KEY` for tokens at rest.

---

## 10. Logging and errors

**Where:** `server/lib/logger.js`.

Structured JSON lines; only `err.message` for errors (no stack/tokens). Global handler returns `err.message` with status `err.status` or 500.

---

## 11. Client API

**Where:** `client/src/api/`.

- **Base URL:** `VITE_API_BASE` or relative `/api`.
- **Credentials:** `credentials: 'include'` for the session cookie.
- **Classify UX:** post + poll job progress.

---

## Summary

| Area | Decision |
|------|----------|
| **LLM** | Batch of 12; json_object; parse retry then Other. |
| **Gmail** | Metadata + Subject; concurrency 8. |
| **Auth** | Signed cookie userId; optional token encryption. |
| **Rate limits** | Auth 30/15min; classify 10/15min per user. |
| **Classification** | Async jobs; client polls; one active job/user. |
| **Storage** | Postgres only. |
| **Queue** | `local` (dev) or `sqs` (prod). |
| **AWS** | App Runner + SQS/Lambda + S3/CloudFront + private RDS. |
