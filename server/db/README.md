# Database

No `users` table. `user_id` is TEXT (Google email or `'default'`). No FKs.

| Table | PK | Purpose |
|-------|-----|---------|
| buckets | (user_id, id) | Bucket definitions |
| classifications | (user_id, thread_id) | Thread → bucket + reason |
| threads_cache | user_id | Cached 200 threads (jsonb) |
| tokens | user_id | OAuth tokens |

**Cleanup:** Run `schema.sql` once. To reset: run `cleanup.sql` in SQL Editor, then in app Disconnect and Connect Gmail again.

To add a proper users table later: `users(id UUID PK, email UNIQUE)` and FK other tables to `users.id`; create user on first login.
