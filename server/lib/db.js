import pg from 'pg'

const { Pool } = pg

let pool = null

/** pg@8.22+ treats sslmode=require as verify-full; strip it so our ssl option wins. */
function normalizeConnectionString(url) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('sslmode')
    parsed.searchParams.delete('sslrootcert')
    parsed.searchParams.delete('sslcert')
    parsed.searchParams.delete('sslkey')
    return parsed.toString()
  } catch {
    return url
      .replace(/([?&])sslmode=[^&]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
  }
}

function sslConfig(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  const url = connectionString || ''
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false
  // RDS and other remote Postgres: encrypt without full CA verify (lean deploy)
  return { rejectUnauthorized: false }
}

export function getPool() {
  if (pool) return pool
  const raw = process.env.DATABASE_URL
  if (!raw) {
    throw new Error('DATABASE_URL is required. Set it in server/.env')
  }
  const connectionString = normalizeConnectionString(raw)
  pool = new Pool({
    connectionString,
    ssl: sslConfig(raw),
  })
  return pool
}

export async function query(text, params) {
  return getPool().query(text, params)
}
