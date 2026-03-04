import { Router } from 'express';
import { addBucket, removeBucket } from '../lib/storage.js';
import { getClassifications, saveClassifications } from '../lib/storage.js';

export const bucketsRouter = Router();

const BUCKET_NAME_MAX_LENGTH = 50;

bucketsRouter.post('/', async (req, res) => {
  const name = (req.body?.name ?? '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Bucket name is required' });
  }
  if (name.length > BUCKET_NAME_MAX_LENGTH) {
    return res.status(400).json({ error: `Bucket name must be ${BUCKET_NAME_MAX_LENGTH} characters or less` });
  }
  try {
    const userId = req.userId || 'default';
    const bucket = await addBucket(name, userId);
    res.status(201).json(bucket);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

bucketsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || 'default';
  try {
    await removeBucket(id, userId);
    const classifications = await getClassifications(userId);
    const updated = { ...classifications };
    let changed = false;
    for (const [threadId, c] of Object.entries(classifications)) {
      if (c.bucket_id === id) {
        updated[threadId] = { ...c, bucket_id: 'other', reason: c.reason || '' };
        changed = true;
      }
    }
    if (changed) await saveClassifications(updated, userId);
    res.json({ ok: true, movedToOther: changed });
  } catch (err) {
    if (err.message === 'Bucket not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Cannot remove default bucket') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});
