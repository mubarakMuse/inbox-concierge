import pg from 'pg'

const { Pool } = pg

let pool = null

function sslConfig() {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  const url = process.env.DATABASE_URL || ''
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false
  return { rejectUnauthorized: false }
}

export function getPool() {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when STORAGE_DRIVER=pg. Set it in server/.env')
  }
  pool = new Pool({
    connectionString,
    ssl: sslConfig(),
  })
  return pool
}

export async function query(text, params) {
  return getPool().query(text, params)
}
