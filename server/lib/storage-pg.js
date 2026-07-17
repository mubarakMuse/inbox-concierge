import { query } from './db.js'
import { slugify } from './slugify.js'
import { encryptTokens, decryptTokens } from './tokenCrypto.js'

const DEFAULT_USER_ID = 'default'

function uid(userId) {
  return userId ?? DEFAULT_USER_ID
}

const defaultBuckets = [
  { id: 'important', name: 'Important', is_default: true },
  { id: 'can-wait', name: 'Can wait', is_default: true },
  { id: 'auto-archive', name: 'Auto-archive', is_default: true },
  { id: 'newsletter', name: 'Newsletter', is_default: true },
  { id: 'other', name: 'Other', is_default: true },
]

async function seedDefaultBuckets(userId) {
  const u = uid(userId)
  for (const b of defaultBuckets) {
    await query(
      `INSERT INTO buckets (user_id, id, name, is_default)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, id) DO NOTHING`,
      [u, b.id, b.name, b.is_default]
    )
  }
}

export async function getBuckets(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `SELECT id, name, is_default FROM buckets
     WHERE user_id = $1
     ORDER BY is_default DESC`,
    [u]
  )
  if (!rows || rows.length === 0) {
    await seedDefaultBuckets(u)
    return defaultBuckets
  }
  return rows
}

export async function addBucket(name, userId = DEFAULT_USER_ID) {
  const buckets = await getBuckets(userId)
  const id = slugify(name)
  if (buckets.some((b) => b.id === id || b.name === name)) {
    throw new Error('Bucket with this name already exists')
  }
  const u = uid(userId)
  await query(
    `INSERT INTO buckets (user_id, id, name, is_default)
     VALUES ($1, $2, $3, false)`,
    [u, id, name]
  )
  return { id, name, is_default: false }
}

export async function removeBucket(bucketId, userId = DEFAULT_USER_ID) {
  const buckets = await getBuckets(userId)
  const bucket = buckets.find((b) => b.id === bucketId)
  if (!bucket) throw new Error('Bucket not found')
  if (bucket.is_default) throw new Error('Cannot remove default bucket')
  const u = uid(userId)
  await query(`DELETE FROM buckets WHERE user_id = $1 AND id = $2`, [u, bucketId])
  return { removed: bucketId }
}

export async function getClassifications(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `SELECT thread_id, bucket_id, reason FROM classifications WHERE user_id = $1`,
    [u]
  )
  const out = {}
  for (const r of rows || []) {
    out[r.thread_id] = { bucket_id: r.bucket_id, reason: r.reason || '' }
  }
  return out
}

export async function saveClassifications(classifications, userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const entries = Object.entries(classifications)
  if (entries.length === 0) {
    await query(`DELETE FROM classifications WHERE user_id = $1`, [u])
    return
  }
  for (const [thread_id, c] of entries) {
    await query(
      `INSERT INTO classifications (user_id, thread_id, bucket_id, reason, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, thread_id)
       DO UPDATE SET bucket_id = EXCLUDED.bucket_id, reason = EXCLUDED.reason, updated_at = now()`,
      [u, thread_id, c.bucket_id, c.reason || '']
    )
  }
}

export async function updateThreadClassification(threadId, bucketId, reason, userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const reasonText = reason ?? ''
  await query(
    `INSERT INTO classifications (user_id, thread_id, bucket_id, reason, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, thread_id)
     DO UPDATE SET bucket_id = EXCLUDED.bucket_id, reason = EXCLUDED.reason, updated_at = now()`,
    [u, threadId, bucketId, reasonText]
  )
  return { thread_id: threadId, bucket_id: bucketId, reason: reasonText }
}

export async function getLastSortedAt(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `SELECT MAX(updated_at) AS last_sorted_at FROM classifications WHERE user_id = $1`,
    [u]
  )
  const value = rows[0]?.last_sorted_at
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export async function getThreadsCache(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `SELECT threads FROM threads_cache WHERE user_id = $1`,
    [u]
  )
  const row = rows[0]
  if (!row || row.threads == null) return null
  return Array.isArray(row.threads) ? row.threads : []
}

export async function saveThreadsCache(threads, userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  await query(
    `INSERT INTO threads_cache (user_id, threads, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id)
     DO UPDATE SET threads = EXCLUDED.threads, updated_at = now()`,
    [u, JSON.stringify(threads || [])]
  )
}

export async function getStoredTokens(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(`SELECT tokens FROM tokens WHERE user_id = $1`, [u])
  const raw = rows[0]?.tokens ?? null
  if (raw == null) return null
  return decryptTokens(raw)
}

export async function saveTokens(tokens, userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const toStore = encryptTokens(tokens)
  await query(
    `INSERT INTO tokens (user_id, tokens, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id)
     DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = now()`,
    [u, JSON.stringify(toStore)]
  )
}

export async function clearTokens(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  await query(`DELETE FROM tokens WHERE user_id = $1`, [u])
}

export async function createJob({ id, userId, type, payload = {} }) {
  const u = uid(userId)
  const { rows } = await query(
    `INSERT INTO jobs (id, user_id, type, status, done, total, error, result, payload, created_at, updated_at)
     VALUES ($1, $2, $3, 'queued', 0, 0, NULL, NULL, $4::jsonb, now(), now())
     RETURNING *`,
    [id, u, type, JSON.stringify(payload || {})]
  )
  return rows[0]
}

export async function getActiveJob(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `SELECT * FROM jobs
     WHERE user_id = $1 AND status IN ('queued', 'running')
     ORDER BY created_at ASC
     LIMIT 1`,
    [u]
  )
  return rows[0] ?? null
}

/** Mark queued/running jobs failed so in-flight workers stop writing. */
export async function cancelActiveJobs(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  const { rows } = await query(
    `UPDATE jobs
     SET status = 'failed', error = 'Cancelled', updated_at = now()
     WHERE user_id = $1 AND status IN ('queued', 'running')
     RETURNING *`,
    [u]
  )
  return rows
}

export async function getJob(id) {
  const { rows } = await query(`SELECT * FROM jobs WHERE id = $1`, [id])
  return rows[0] ?? null
}

export async function updateJob(id, patch = {}) {
  const sets = ['updated_at = now()']
  const params = [id]
  let i = 2

  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`)
    params.push(patch.status)
  }
  if (patch.done !== undefined) {
    sets.push(`done = $${i++}`)
    params.push(patch.done)
  }
  if (patch.total !== undefined) {
    sets.push(`total = $${i++}`)
    params.push(patch.total)
  }
  if (patch.error !== undefined) {
    sets.push(`error = $${i++}`)
    params.push(patch.error)
  }
  if (patch.result !== undefined) {
    sets.push(`result = $${i++}::jsonb`)
    params.push(
      typeof patch.result === 'string' ? patch.result : JSON.stringify(patch.result)
    )
  }

  const { rows } = await query(
    `UPDATE jobs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  )
  return rows[0]
}

export async function deleteAllUserData(userId = DEFAULT_USER_ID) {
  const u = uid(userId)
  await cancelActiveJobs(u)
  await query(`DELETE FROM jobs WHERE user_id = $1`, [u])
  await query(`DELETE FROM classifications WHERE user_id = $1`, [u])
  await query(`DELETE FROM buckets WHERE user_id = $1`, [u])
  await query(`DELETE FROM threads_cache WHERE user_id = $1`, [u])
  await query(`DELETE FROM tokens WHERE user_id = $1`, [u])
}
