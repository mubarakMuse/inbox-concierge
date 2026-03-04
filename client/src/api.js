const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const defaultFetchOpts = { credentials: 'include' };

function throwApiError(res, data, fallback) {
  const e = new Error(data?.error || fallback);
  e.status = res.status;
  throw e;
}

export async function getAuthUrl() {
  const res = await fetch(`${API_BASE}/auth/url`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get auth URL');
  return data.url;
}

export async function getAuthStatus() {
  const res = await fetch(`${API_BASE}/auth/status`, defaultFetchOpts);
  const data = await res.json();
  return data;
}

export async function disconnect() {
  const res = await fetch(`${API_BASE}/auth/disconnect`, { method: 'POST', ...defaultFetchOpts });
  if (!res.ok) throw new Error('Failed to disconnect');
}

export async function deleteAllMyData() {
  const res = await fetch(`${API_BASE}/auth/delete-all-data`, { method: 'POST', ...defaultFetchOpts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to delete data');
  return data;
}

export async function getBucketsWithCounts() {
  const res = await fetch(`${API_BASE}/inbox/buckets`, defaultFetchOpts);
  const data = await res.json();
  if (!res.ok) throwApiError(res, data, 'Failed to load buckets');
  return data;
}

export async function getThreads(bucketId) {
  const url = bucketId ? `${API_BASE}/inbox/threads?bucket_id=${encodeURIComponent(bucketId)}` : `${API_BASE}/inbox/threads`;
  const res = await fetch(url, defaultFetchOpts);
  const data = await res.json();
  if (!res.ok) throwApiError(res, data, 'Failed to load threads');
  return data;
}

export function classifyWithProgress(onProgress, onDone, onError) {
  fetch(`${API_BASE}/inbox/classify-progress`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || res.statusText);
        err.status = res.status;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (onDone) onDone();
            return;
          }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.type === 'progress' && onProgress) onProgress(payload);
                if (payload.type === 'done' && onDone) onDone(payload);
                if (payload.type === 'error' && onError) onError(payload.error);
              } catch {
                /* ignore malformed SSE line */
              }
            }
          }
          read();
        });
      }
      read();
    })
    .catch((err) => {
      if (onError) onError(err.message, err.status);
    });
}

export async function recategorize() {
  const res = await fetch(`${API_BASE}/inbox/recategorize`, { method: 'POST', ...defaultFetchOpts });
  const data = await res.json();
  if (!res.ok) throwApiError(res, data, 'Recategorization failed');
  return data;
}

export async function createBucket(name) {
  const res = await fetch(`${API_BASE}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    ...defaultFetchOpts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create bucket');
  return data;
}

export async function deleteBucket(id) {
  const res = await fetch(`${API_BASE}/buckets/${encodeURIComponent(id)}`, { method: 'DELETE', ...defaultFetchOpts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove bucket');
  return data;
}
