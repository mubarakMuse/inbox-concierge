import { getSupabase } from './supabase.js';
import { slugify } from './slugify.js';

const DEFAULT_USER_ID = 'default'

function uid(userId) {
  return userId ?? DEFAULT_USER_ID
}

function storageError(error) {
  const message = error?.message || 'Storage error'
  if (message.includes('fetch failed')) {
    return new Error('Cannot reach Supabase. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and that your project is active.')
  }
  if (message === 'Supabase not configured') {
    return new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env')
  }
  return new Error(message)
}

const defaultBuckets = [
  { id: 'important', name: 'Important', is_default: true },
  { id: 'can-wait', name: 'Can wait', is_default: true },
  { id: 'auto-archive', name: 'Auto-archive', is_default: true },
  { id: 'newsletter', name: 'Newsletter', is_default: true },
  { id: 'other', name: 'Other', is_default: true },
];

export async function getBuckets(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { data: rows, error } = await supabase
    .from('buckets')
    .select('id, name, is_default')
    .eq('user_id', u)
    .order('is_default', { ascending: false });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    await seedDefaultBuckets(supabase, u);
    return defaultBuckets;
  }
  return rows;
}

async function seedDefaultBuckets(supabase, userId) {
  const u = uid(userId);
  const toInsert = defaultBuckets.map((b) => ({
    user_id: u,
    id: b.id,
    name: b.name,
    is_default: b.is_default,
  }));
  const { error } = await supabase.from('buckets').upsert(toInsert, { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message);
}

export async function addBucket(name, userId = DEFAULT_USER_ID) {
  const buckets = await getBuckets(userId);
  const id = slugify(name);
  if (buckets.some((b) => b.id === id || b.name === name)) {
    throw new Error('Bucket with this name already exists');
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { error } = await supabase.from('buckets').insert({
    user_id: u,
    id,
    name,
    is_default: false,
  });
  if (error) throw new Error(error.message);
  return { id, name, is_default: false };
}

export async function removeBucket(bucketId, userId = DEFAULT_USER_ID) {
  const buckets = await getBuckets(userId);
  const bucket = buckets.find((b) => b.id === bucketId);
  if (!bucket) throw new Error('Bucket not found');
  if (bucket.is_default) throw new Error('Cannot remove default bucket');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { error } = await supabase.from('buckets').delete().eq('user_id', u).eq('id', bucketId);
  if (error) throw new Error(error.message);
  return { removed: bucketId };
}

export async function getClassifications(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { data: rows, error } = await supabase
    .from('classifications')
    .select('thread_id, bucket_id, reason')
    .eq('user_id', u);
  if (error) throw new Error(error.message);
  const out = {};
  for (const r of rows || []) {
    out[r.thread_id] = { bucket_id: r.bucket_id, reason: r.reason || '' };
  }
  return out;
}

export async function saveClassifications(classifications, userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const entries = Object.entries(classifications).map(([thread_id, c]) => ({
    user_id: u,
    thread_id,
    bucket_id: c.bucket_id,
    reason: c.reason || '',
  }));
  if (entries.length === 0) {
    const { error: delErr } = await supabase.from('classifications').delete().eq('user_id', u);
    if (delErr) throw new Error(delErr.message);
    return;
  }
  const { error } = await supabase.from('classifications').upsert(entries, { onConflict: 'user_id,thread_id' });
  if (error) throw new Error(error.message);
}

export async function getThreadsCache(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { data: row, error } = await supabase
    .from('threads_cache')
    .select('threads')
    .eq('user_id', u)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  if (!row || !row.threads) return null;
  return Array.isArray(row.threads) ? row.threads : [];
}

export async function saveThreadsCache(threads, userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { error } = await supabase.from('threads_cache').upsert(
    { user_id: u, threads: threads || [], updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

export async function getStoredTokens(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { data: row, error } = await supabase.from('tokens').select('tokens').eq('user_id', u).single();
  if (error && error.code !== 'PGRST116') throw storageError(error);
  return row?.tokens ?? null;
}

export async function saveTokens(tokens, userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { error } = await supabase.from('tokens').upsert(
    { user_id: u, tokens, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

export async function clearTokens(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const { error } = await supabase.from('tokens').delete().eq('user_id', u);
  if (error) throw new Error(error.message);
}

export async function createJob({ id, userId, type }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const row = {
    id,
    user_id: u,
    type,
    status: 'queued',
    done: 0,
    total: 0,
    error: null,
    result: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('jobs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getJob(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ?? null;
}

export async function updateJob(id, patch = {}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const updates = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.done !== undefined) updates.done = patch.done;
  if (patch.total !== undefined) updates.total = patch.total;
  if (patch.error !== undefined) updates.error = patch.error;
  if (patch.result !== undefined) updates.result = patch.result;
  const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAllUserData(userId = DEFAULT_USER_ID) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const u = uid(userId);
  const tables = ['classifications', 'buckets', 'threads_cache', 'tokens', 'jobs'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', u);
    if (error) throw new Error(error.message);
  }
}
