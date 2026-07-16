// Storage facade. Default driver is Postgres (pg); set STORAGE_DRIVER=supabase for legacy.
import * as pgStorage from './storage-pg.js'
import * as supabaseStorage from './storage-supabase.js'

function getImpl() {
  const driver = (process.env.STORAGE_DRIVER || 'pg').toLowerCase()
  return driver === 'supabase' ? supabaseStorage : pgStorage
}

export async function getBuckets(userId) {
  return getImpl().getBuckets(userId)
}

export async function addBucket(name, userId) {
  return getImpl().addBucket(name, userId)
}

export async function removeBucket(bucketId, userId) {
  return getImpl().removeBucket(bucketId, userId)
}

export async function getClassifications(userId) {
  return getImpl().getClassifications(userId)
}

export async function saveClassifications(classifications, userId) {
  return getImpl().saveClassifications(classifications, userId)
}

export async function getThreadsCache(userId) {
  return getImpl().getThreadsCache(userId)
}

export async function saveThreadsCache(threads, userId) {
  return getImpl().saveThreadsCache(threads, userId)
}

export async function getStoredTokens(userId) {
  return getImpl().getStoredTokens(userId)
}

export async function saveTokens(tokens, userId) {
  return getImpl().saveTokens(tokens, userId)
}

export async function clearTokens(userId) {
  return getImpl().clearTokens(userId)
}

export async function deleteAllUserData(userId) {
  return getImpl().deleteAllUserData(userId)
}

export async function createJob(params) {
  return getImpl().createJob(params)
}

export async function getJob(id) {
  return getImpl().getJob(id)
}

export async function updateJob(id, patch) {
  return getImpl().updateJob(id, patch)
}
