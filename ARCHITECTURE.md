# Inbox Concierge – Code structure and key decisions

This document explains how the code is structured and why certain business and technical choices were made (LLM prompt, auth, storage, rate limits, etc.).

---

## 1. Repo layout

| Layer | Path | Role |
|-------|------|------|
| **Frontend** | `client/` | React (Vite), single-page app. `src/api.js` is the only place that talks to the backend; all routes go through it. |
| **Backend** | `server/` | Express app. Routes under `/api/auth`, `/api/buckets`, `/api/inbox`; shared middleware and libs. |
| **Storage** | `server/lib/storage.js` | Thin facade that re-exports `storage-supabase.js`. All persistence goes through this so the backend could be swapped to another DB by replacing the impl. |
| **DB** | `server/db/` | `schema.sql` (tables), `cleanup.sql` (reset). Run in Supabase SQL Editor. |

---

## 2. LLM prompt and classification

**Where:** `server/lib/classification.js` – `buildPrompt()`, `parseResponse()`, `classifyAll()`.

**Design choices:**

- **Single prompt per batch:** The model sees a list of bucket names (including any custom buckets), short rules for the default buckets, and a list of threads (id, subject, snippet). It returns one JSON array of `{ thread_id, bucket, reason }`.
- **Bucket list is dynamic:** The prompt is built from `getBuckets(userId)`, so custom buckets are included and the model must output a bucket name that exactly matches one of those names.
- **Rules in the prompt:** Fixed rules for Important, Can wait, Auto-archive, Newsletter, Other (e.g. “Important: urgent, from people, action needed soon”) so the model behaves consistently without per-user tuning.
- **Structured output:** “Respond with a JSON array only, no markdown.” Response is stripped of markdown code fences, parsed as JSON, then validated: unknown bucket names are mapped to **Other**; `reason` is capped at 120 chars.
- **Model and temperature:** `OPENAI_MODEL` env (default `gpt-4o-mini`), `temperature: 0.2` for stable bucket choices.
- **Batching:** Threads are sent in batches of **12** (`BATCH_SIZE`). After each batch, a 600 ms delay (`DELAY_MS`) is applied to reduce rate-limit risk.
- **Retries:** Only for 429 or 5xx; up to **3** retries per batch with backoff. Other errors (e.g. invalid JSON) are not retried; missing threads in the parsed result get `bucket_id: 'other'` so the run can continue.

---

## 3. Gmail and thread data

**Where:** `server/lib/gmail.js` – `fetchThreads(maxResults, authClient)`.

**Choices:**

- **Scope:** `gmail.readonly` + `userinfo.email`. No send or modify.
- **What we fetch:** List thread ids, then for each thread `threads.get(..., format: 'full')`. From the **first message** we take: Subject (from headers), snippet (cleaned, trimmed to 500 chars). No full body in the prompt – only subject + snippet to keep tokens low and latency reasonable.
- **Limit:** Default 200 threads (configurable; Gmail API cap is 500). Used for “recent inbox” view and for classification.

---

## 4. Auth and user identity

**Where:** `server/lib/auth.js`, `server/routes/auth.js`, `server/middleware/userId.js`, `server/middleware/requireGmailAuth.js`.

**Choices:**

- **User ID = email:** After OAuth callback we call `oauth2.userinfo.get()` and set `userId = data.email` (fallback: `user-${data.id}` or timestamp). All storage keys (buckets, classifications, threads cache, tokens) use this `userId`.
- **Session = signed cookie:** No JWT. Cookie name `uid`; value is `base64url(userId).hmac_sha256(userId)` so the server can verify and set `req.userId`. Middleware `userIdFromCookie` runs on every request and sets `req.userId` (or `'default'` if no/invalid cookie).
- **Gmail required for classify/threads:** Routes that need Gmail (e.g. `/threads`, `/classify-progress`, `/recategorize`) use `requireGmailAuth`, which loads stored OAuth tokens for `req.userId` and attaches `req.gmailAuth`. If no tokens, 401 with “Gmail not connected.”
- **Cookie in production:** When `FRONTEND_URL` is set and not localhost, cookie is `SameSite=None; Secure` for cross-origin (e.g. Netlify + Railway).

---

## 5. Rate limiting

**Where:** `server/middleware/rateLimit.js`.

**Choices:**

- **Auth:** 30 requests per 15 minutes per IP (same limit for `/url`, `/callback`, etc.). Message: “Too many auth attempts.”
- **Classify/recategorize:** 10 requests per 15 minutes per **user** (key: `req.userId || req.ip`). Applied to `POST /api/inbox/classify-progress` and `POST /api/inbox/recategorize`. Message: “Too many classify requests.”
- **Tests:** In `NODE_ENV=test`, limits are raised to 10000 so tests don’t hit them.

---

## 6. Buckets and input validation

**Where:** `server/routes/buckets.js`, `server/db/schema.sql`, `server/lib/storage-supabase.js`.

**Choices:**

- **Default buckets:** Important, Can wait, Auto-archive, Newsletter, Other. Stored in DB; if a user has no rows, we seed these (see `seedDefaultBuckets`).
- **Custom buckets:** User can add buckets (POST with `name`). Name is **trimmed** and length limited to **50** characters; 400 with a clear message if over. ID is derived: lowercase, spaces → `-`, non-alphanumeric stripped; duplicate name or id returns 409.
- **Deleting a bucket:** Default buckets cannot be removed. When a custom bucket is deleted, any classifications pointing to it are moved to **Other** and classifications are re-saved.

---

## 7. Classification flow and SSE

**Where:** `server/routes/inbox.js` (`POST /classify-progress`), `client/src/api.js` (`classifyWithProgress`).

**Choices:**

- **Streaming:** Response is `text/event-stream`. Server sends `{ type: 'progress', done, total }` as batches complete, then `{ type: 'done', threads, classifications }` or `{ type: 'error', error }`. Client uses `fetch` + `ReadableStream` and parses `data: {...}` lines so the UI can show progress without polling.
- **Thread source:** If the user has no threads in cache, we fetch from Gmail (200), save to cache, then classify. So “Classify” always works on the same cached thread list until the next full fetch.
- **Partial saves:** After each batch we call `saveClassifications(progress.partial, userId)` so if the stream drops or the user leaves, we still persist what was classified so far.

---

## 8. Recategorize

**Where:** `server/routes/inbox.js` – `POST /recategorize`.

**Choice:** Re-runs `classifyAll(threads, null, userId)` on the **cached** thread list (no new Gmail fetch), overwrites all classifications, returns the new map. Same rate limit as classify. Used when the user wants to re-run the model (e.g. after adding a bucket or changing rules).

---

## 9. Storage abstraction and schema

**Where:** `server/lib/storage.js` (facade), `server/lib/storage-supabase.js` (Supabase), `server/db/schema.sql`.

**Tables:**

- **buckets** – `(user_id, id, name, is_default)`. Default buckets seeded per user on first load.
- **classifications** – `(user_id, thread_id, bucket_id, reason, updated_at)`. One bucket per thread per user.
- **threads_cache** – `(user_id, threads JSONB)`. One row per user; array of `{ id, subject, snippet }`.
- **tokens** – `(user_id, tokens JSONB)`. OAuth access/refresh tokens.

**Choice:** No local DB or file storage; all state in Supabase. The app does not use Supabase Auth; it uses Google OAuth and stores tokens itself. RLS is in schema but commented out; in production you’d set `app.user_id` and enable policies.

---

## 10. Logging and errors

**Where:** `server/lib/logger.js`, used in `server/index.js`, auth, inbox, and error middleware.

**Choices:**

- **Structured:** One JSON line per log (`logger.info(message, meta)`, `logger.error(message, err, meta)`). Only `err.message` is logged for errors (no stack in logs, no request body or tokens) to avoid leaking secrets.
- **Global error handler:** Express error middleware logs and returns `err.message` with status `err.status` or 500.

---

## 11. Client API and backend URL

**Where:** `client/src/api.js`.

**Choices:**

- **Base URL:** If `VITE_API_BASE` is set (e.g. Railway URL), all requests go to `VITE_API_BASE + '/api'`. Otherwise relative `/api` for same-origin dev.
- **Credentials:** Every request uses `credentials: 'include'` so the cookie is sent. Backend CORS is configured with `credentials: true` and a single `origin` (e.g. Netlify or localhost).
- **SSE:** Only `classifyWithProgress` uses streaming; other endpoints are request/response JSON.

---

## Summary table

| Area | Decision |
|------|----------|
| **LLM** | One prompt per batch of 12 threads; bucket list + rules; JSON array; fallback to Other; temperature 0.2; retries on 429/5xx. |
| **Gmail** | 200 threads; subject + snippet only; first message per thread. |
| **Auth** | userId = email; signed cookie; Gmail required for classify/threads/recategorize. |
| **Rate limits** | Auth 30/15min; classify 10/15min per user. |
| **Buckets** | Default five + custom; name trimmed, max 50 chars; delete moves to Other. |
| **Classification** | SSE progress; partial saves per batch; recategorize re-runs on cache. |
| **Storage** | Facade → Supabase only; buckets, classifications, threads_cache, tokens. |
| **Logging** | Structured JSON; no secrets or stack in logs. |
