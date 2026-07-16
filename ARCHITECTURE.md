# Inbox Concierge – Code structure and key decisions

This document explains how the code is structured and why certain business and technical choices were made (LLM prompt, auth, storage, rate limits, etc.).

---

## 1. Repo layout

| Layer | Path | Role |
|-------|------|------|
| **Frontend** | `client/` | React (Vite). All HTTP calls go through `client/src/api/`. |
| **Backend** | `server/` | Express app. Routes under `/api/auth`, `/api/buckets`, `/api/inbox`; shared middleware and libs. |
| **Storage** | `server/lib/storage.js` | Facade selecting `storage-pg.js` (default) or `storage-supabase.js` via `STORAGE_DRIVER`. |
| **DB** | `server/db/` | `schema.sql` (tables), `cleanup.sql` (reset). Local: `docker compose up -d`. Prod: RDS (`psql "$DATABASE_URL" -f server/db/schema.sql`). |

---

## 2. LLM prompt and classification

**Where:** `server/lib/classification.js` – `buildPrompt()`, `parseResponse()`, `classifyAll()`.

**Design choices:**

- **Single prompt per batch:** The model sees a list of bucket names (including any custom buckets), short rules for the default buckets, and a list of threads (id, subject, snippet). It returns a JSON object `{ "items": [ { thread_id, bucket, reason } ] }`.
- **Bucket list is dynamic:** The prompt is built from `getBuckets(userId)`, so custom buckets are included. Prompt includes: “Custom buckets: treat as user-defined categories by name”.
- **Rules in the prompt:** Fixed rules for Important, Can wait, Auto-archive, Newsletter, Other so the model behaves consistently without per-user tuning.
- **Structured output:** OpenAI `response_format: { type: 'json_object' }`. Response is stripped of markdown fences, parsed; `items` (or a legacy array) is validated. Unknown bucket names map to **Other**; `reason` is capped at 120 chars.
- **Parse failure:** If a batch response cannot be parsed, the batch is retried once, then those threads are assigned **Other**.
- **Model and temperature:** `OPENAI_MODEL` env (default `gpt-4o-mini`), `temperature: 0.2`.
- **Batching:** Threads in batches of **12** (`BATCH_SIZE`), with a 600 ms delay between batches.
- **Retries:** API 429/5xx up to **3** retries with backoff.

---

## 3. Gmail and thread data

**Where:** `server/lib/gmail.js` – `fetchThreads(maxResults, authClient)`.

**Choices:**

- **Scope:** `gmail.readonly` + `userinfo.email`. No send or modify.
- **What we fetch:** List thread ids, then `threads.get(..., format: 'metadata', metadataHeaders: ['Subject'])` with concurrency **8**. Subject from headers; snippet from the thread metadata response (trimmed to 500 chars). No full body.
- **Limit:** Default 200 threads (Gmail API cap 500).

---

## 4. Auth and user identity

**Where:** `server/lib/auth.js`, `server/routes/auth.js`, `server/middleware/userId.js`, `server/middleware/requireAuth.js`, `server/middleware/requireGmailAuth.js`.

**Choices:**

- **User ID = email:** After OAuth callback we set `userId` from Google userinfo. All storage keys use this `userId`.
- **Session = signed cookie:** Cookie `uid` = `base64url(userId).hmac`. `userIdFromCookie` sets `req.userId` or **`null`** if missing/invalid (not `'default'`).
- **`requireAuth`:** Returns 401 `{ error: 'Not authenticated' }` when `!req.userId`. Used on buckets, inbox, and auth disconnect/delete.
- **Auth status:** If no `userId`, returns `{ connected: false, hasTokens: false }` without 401.
- **Gmail required for classify/threads:** `requireGmailAuth` loads OAuth tokens for `req.userId`; 401 if not connected.
- **Token encryption at rest:** When `TOKEN_ENCRYPTION_KEY` is set (64-char hex or passphrase), tokens are stored as `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` (AES-256-GCM). Legacy plaintext JSON rows still decrypt/read if they do not start with `enc:v1:`.

---

## 5. Rate limiting

**Where:** `server/middleware/rateLimit.js`.

**Choices:**

- **Auth:** 30 requests per 15 minutes per IP.
- **Classify/recategorize:** 10 requests per 15 minutes per **user** on `POST /api/inbox/classify` and `POST /api/inbox/recategorize`.
- **Tests:** In `NODE_ENV=test`, limits are raised so tests don’t hit them.

---

## 6. Buckets and input validation

**Where:** `server/routes/buckets.js`, `server/db/schema.sql`, `server/lib/storage-pg.js` (default).

**Choices:**

- **Default buckets:** Important, Can wait, Auto-archive, Newsletter, Other. Seeded per user when empty.
- **Custom buckets:** Name trimmed, max **50** chars; slug id; 409 on duplicate.
- **Deleting a bucket:** Defaults cannot be removed; classifications for that bucket move to **Other**.

---

## 7. Classification flow (async jobs + polling)

**Where:** `server/lib/runClassifyJob.js`, `server/lib/queue.js`, `server/routes/inbox.js`, `client/src/api/inbox.js`.

**Choices:**

- **Jobs table:** `queued` → `running` → `completed`/`failed` with `done`/`total`, optional `result` JSON, and `payload` JSONB (e.g. `{ forceRefresh: true }`).
- **Queue drivers:** `QUEUE_DRIVER=local` runs `runClassifyJob` in-process; `QUEUE_DRIVER=sqs` uses SQS + Lambda.
- **Polling (no SSE):** Client `POST /classify` with optional `{ forceRefresh }` → `{ jobId, reused? }`, then polls `GET /jobs/:jobId` (~800ms) for progress. SSE `/classify-progress` was removed.
- **Force refresh:** `forceRefresh: true` ignores threads cache and refetches Gmail before classifying.
- **One active job per user:** If a `queued`/`running` job exists, `startJob` returns that id with `reused: true` instead of creating another (avoids double OpenAI spend).
- **Partial saves:** Worker saves classifications after each batch.

---

## 8. Recategorize

**Where:** `server/routes/inbox.js` – `POST /recategorize`; client polls `GET /api/inbox/jobs/:id`.

**Choice:** Enqueues a `recategorize` job on the **cached** thread list (no Gmail fetch). Same rate limit and active-job reuse as classify.

---

## 9. Storage abstraction and schema

**Where:** `server/lib/storage.js` (facade), `server/lib/storage-pg.js` (default), `server/lib/storage-supabase.js` (optional), `server/db/schema.sql`.

**Tables:**

- **buckets** – `(user_id, id, name, is_default)`.
- **classifications** – `(user_id, thread_id, bucket_id, reason, updated_at)`.
- **threads_cache** – `(user_id, threads JSONB)`.
- **tokens** – `(user_id, tokens JSONB)` – plaintext object or encrypted string value when key is set.
- **jobs** – `(id, user_id, type, status, done, total, error, result, payload)`.

**Choice:** Default storage is Postgres (`STORAGE_DRIVER=pg`). Optional Supabase driver remains for legacy.

---

## 10. Logging and errors

**Where:** `server/lib/logger.js`, used in `server/index.js`, auth, inbox, and error middleware.

**Choices:**

- **Structured:** One JSON line per log. Only `err.message` for errors (no stack/tokens).
- **Global error handler:** Returns `err.message` with status `err.status` or 500.

---

## 11. Client API and backend URL

**Where:** `client/src/api/` (`client.js`, `auth.js`, `inbox.js`, `buckets.js`).

**Choices:**

- **Base URL:** `VITE_API_BASE` or relative `/api`.
- **Credentials:** `credentials: 'include'` for the session cookie.
- **Classify UX:** `classifyWithProgress` posts to `/classify` and polls `/jobs/:id` (no EventSource/SSE).

---

## Summary table

| Area | Decision |
|------|----------|
| **LLM** | Batch of 12; `{ items: [...] }` + json_object; parse retry then Other; custom bucket line. |
| **Gmail** | Metadata + Subject; concurrency 8; subject + snippet. |
| **Auth** | userId from cookie or null; requireAuth; optional TOKEN_ENCRYPTION_KEY. |
| **Rate limits** | Auth 30/15min; classify 10/15min per user. |
| **Buckets** | Default five + custom; name max 50; delete → Other. |
| **Classification** | Async jobs; client polls job progress; forceRefresh; one active job/user. |
| **Storage** | Postgres default; jobs.payload; token encrypt optional. |
| **Logging** | Structured JSON; no secrets. |
| **AWS lean** | App Runner + SQS/Lambda + S3/CloudFront + private RDS. |
