import { getAuthenticatedClient } from './auth.js'
import { logger } from './logger.js'

const FETCH_CONCURRENCY = 8

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index], index)
    }
  }

  const poolSize = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: poolSize }, () => worker()))
  return results
}

export async function fetchThreads(maxResults = 200, authClient) {
  const auth = authClient ?? await getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const gmail = (await import('googleapis')).google.gmail({ version: 'v1', auth });
  const listRes = await gmail.users.threads.list({
    userId: 'me',
    maxResults: Math.min(maxResults, 500),
  });

  const threadIds = (listRes.data.threads || []).map((t) => t.id).slice(0, maxResults);
  if (threadIds.length === 0) return [];

  const fetched = await mapPool(threadIds, FETCH_CONCURRENCY, async (id) => {
    try {
      const res = await gmail.users.threads.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['Subject'],
      });
      const msg = res.data.messages?.[0];
      const subject = msg?.payload?.headers?.find((h) => h.name === 'Subject')?.value || '(No subject)';
      const snippet =
        (res.data.snippet || msg?.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 500) || '';
      return { id, subject, snippet };
    } catch (e) {
      logger.error('Failed to fetch thread', e, { threadId: id })
      return null
    }
  })

  return fetched.filter(Boolean);
}
