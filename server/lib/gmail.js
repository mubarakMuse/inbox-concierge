import { getAuthenticatedClient } from './auth.js';

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

  const threads = [];
  for (const id of threadIds) {
    try {
      const res = await gmail.users.threads.get({
        userId: 'me',
        id,
        format: 'full',
      });
      const msg = res.data.messages?.[0];
      const subject = msg?.payload?.headers?.find((h) => h.name === 'Subject')?.value || '(No subject)';
      const snippet =
        (res.data.snippet || msg?.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 500) || '';
      threads.push({ id, subject, snippet });
    } catch (e) {
      console.warn('Failed to fetch thread', id, e.message);
    }
  }
  return threads;
}
