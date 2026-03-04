import { describe, it, expect } from 'vitest';
import { parseResponse, getBucketIdByName } from '../lib/classification.js';

describe('parseResponse', () => {
  const names = ['Important', 'Can wait', 'Other'];

  it('parses valid JSON array', () => {
    const text = '[{"thread_id":"t1","bucket":"Important","reason":"Urgent"}]';
    expect(parseResponse(text, names)).toEqual([
      { thread_id: 't1', bucket: 'Important', reason: 'Urgent' },
    ]);
  });

  it('strips markdown code fence', () => {
    const text = '```json\n[{"thread_id":"t1","bucket":"Other","reason":""}]\n```';
    expect(parseResponse(text, names)).toEqual([
      { thread_id: 't1', bucket: 'Other', reason: '' },
    ]);
  });

  it('maps unknown bucket to Other', () => {
    const text = '[{"thread_id":"t1","bucket":"Unknown","reason":"x"}]';
    expect(parseResponse(text, names)).toEqual([
      { thread_id: 't1', bucket: 'Other', reason: 'x' },
    ]);
  });

  it('truncates reason to 120 chars', () => {
    const long = 'a'.repeat(150);
    const text = `[{"thread_id":"t1","bucket":"Important","reason":"${long}"}]`;
    expect(parseResponse(text, names)[0].reason.length).toBe(120);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseResponse('not json', names)).toEqual([]);
    expect(parseResponse('', names)).toEqual([]);
  });

  it('filters out items missing thread_id or bucket', () => {
    const text = '[{"bucket":"Other"},{"thread_id":"t1"},{"thread_id":"t2","bucket":"Other","reason":""}]';
    expect(parseResponse(text, names)).toEqual([
      { thread_id: 't2', bucket: 'Other', reason: '' },
    ]);
  });
});

describe('getBucketIdByName', () => {
  const buckets = [
    { id: 'important', name: 'Important' },
    { id: 'other', name: 'Other' },
  ];

  it('returns id for matching name', () => {
    expect(getBucketIdByName(buckets, 'Important')).toBe('important');
    expect(getBucketIdByName(buckets, 'Other')).toBe('other');
  });

  it('returns other for unknown name', () => {
    expect(getBucketIdByName(buckets, 'Can wait')).toBe('other');
  });
});
