import OpenAI from 'openai';
import { getBuckets } from './storage.js';

const BATCH_SIZE = 12;
const DELAY_MS = 600;
const MAX_RETRIES = 3;
const PARSE_RETRIES = 1;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(buckets, threads) {
  const bucketList = buckets.map((b) => b.name).join(', ');
  const customBuckets = buckets.filter((b) => !b.is_default).map((b) => b.name);
  const customLine =
    customBuckets.length > 0
      ? `\nCustom buckets: treat as user-defined categories by name (${customBuckets.join(', ')}).`
      : `\nCustom buckets: treat as user-defined categories by name.`;
  const threadList = threads.map((t) => `id: ${t.id}\nsubject: ${t.subject}\nsnippet: ${t.snippet?.slice(0, 200) || ''}`).join('\n---\n');
  return `You classify email threads into exactly one of these buckets: ${bucketList}.
${customLine}

For each thread, choose the best bucket. Also provide a short "reason" (one phrase) explaining why.

Rules:
- Important: urgent, from people, action needed soon.
- Can wait: not urgent, can be read later.
- Auto-archive: receipts, notifications, low value.
- Newsletter: subscriptions, marketing, digests.
- Other: anything that doesn't fit above.

Respond with a JSON object only, no markdown: { "items": [ { "thread_id": "<id>", "bucket": "<bucket name exactly as listed>", "reason": "<short phrase>" } ] }

Threads:
---
${threadList}`;
}

export function parseResponse(text, validBucketNames) {
  const cleaned = text.replace(/```json?\s*/g, '').replace(/```\s*$/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  let arr;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && Array.isArray(parsed.items)) {
    arr = parsed.items;
  } else {
    return [];
  }
  return arr
    .filter((x) => x && x.thread_id && x.bucket)
    .map((x) => ({
      thread_id: String(x.thread_id),
      bucket: validBucketNames.includes(x.bucket) ? x.bucket : 'Other',
      reason: typeof x.reason === 'string' ? x.reason.slice(0, 120) : '',
    }));
}

export function getBucketIdByName(buckets, name) {
  const b = buckets.find((x) => x.name === name);
  return b ? b.id : 'other';
}

function assignOther(results, batch) {
  for (const t of batch) {
    if (!results[t.id]) {
      results[t.id] = { bucket_id: 'other', reason: '' };
    }
  }
}

export async function classifyAll(threads, onProgress, userId) {
  const buckets = await getBuckets(userId);
  const validNames = buckets.map((b) => b.name);
  const results = {};
  const batches = [];
  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    batches.push(threads.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let lastError;
    let batchDone = false;

    for (let r = 0; r < MAX_RETRIES && !batchDone; r++) {
      try {
        let parsed = [];
        for (let parseAttempt = 0; parseAttempt <= PARSE_RETRIES; parseAttempt++) {
          const prompt = buildPrompt(buckets, batch);
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          });
          const text = completion.choices?.[0]?.message?.content || '{}';
          parsed = parseResponse(text, validNames);
          if (parsed.length > 0 || batch.length === 0) break;
        }

        for (const p of parsed) {
          results[p.thread_id] = {
            bucket_id: getBucketIdByName(buckets, p.bucket),
            reason: p.reason,
          };
        }
        assignOther(results, batch);
        if (onProgress) {
          await onProgress({ done: (i + 1) * batch.length, total: threads.length, partial: { ...results } });
        }
        batchDone = true;
        lastError = null;
      } catch (err) {
        lastError = err;
        if (err?.code === 'JOB_CANCELLED' || err?.message === 'Cancelled') throw err;
        if (err?.status === 429 || (err?.status >= 500 && err?.status < 600)) {
          await new Promise((res) => setTimeout(res, DELAY_MS * (r + 1)));
        } else throw err;
      }
    }

    if (!batchDone) {
      if (lastError && Object.keys(results).length === 0) throw lastError;
      assignOther(results, batch);
      if (onProgress) {
        await onProgress({ done: (i + 1) * batch.length, total: threads.length, partial: { ...results } });
      }
    }

    await new Promise((res) => setTimeout(res, DELAY_MS));
  }

  return results;
}
