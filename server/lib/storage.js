// Supabase-only storage. Run schema.sql once. userId defaults to 'default'.
import * as supabaseStorage from './storage-supabase.js';

export async function getBuckets(userId) {
  return supabaseStorage.getBuckets(userId);
}

export async function saveBuckets(buckets, userId) {
  return supabaseStorage.saveBuckets(buckets, userId);
}

export async function addBucket(name, userId) {
  return supabaseStorage.addBucket(name, userId);
}

export async function removeBucket(bucketId, userId) {
  return supabaseStorage.removeBucket(bucketId, userId);
}

export async function getClassifications(userId) {
  return supabaseStorage.getClassifications(userId);
}

export async function saveClassifications(classifications, userId) {
  return supabaseStorage.saveClassifications(classifications, userId);
}

export async function getThreadsCache(userId) {
  return supabaseStorage.getThreadsCache(userId);
}

export async function saveThreadsCache(threads, userId) {
  return supabaseStorage.saveThreadsCache(threads, userId);
}

export async function getStoredTokens(userId) {
  return supabaseStorage.getStoredTokens(userId);
}

export async function saveTokens(tokens, userId) {
  return supabaseStorage.saveTokens(tokens, userId);
}

export async function clearTokens(userId) {
  return supabaseStorage.clearTokens(userId);
}

export async function deleteAllUserData(userId) {
  return supabaseStorage.deleteAllUserData(userId);
}
