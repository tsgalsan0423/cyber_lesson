import Database from 'better-sqlite3'
import { Pool } from 'pg'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function params(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

export function createDatabase() {
  if (process.env.DATABASE_URL) return createPostgres()
  return createSqlite()
}

function createSqlite() {
  const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, 'securelab.db'))
  db.pragma('journal_mode = WAL')
  const adapter = {
    dialect: 'sqlite',
    exec: async (sql) => db.exec(sql),
    get: async (sql, values = []) => db.prepare(sql).get(...values),
    all: async (sql, values = []) => db.prepare(sql).all(...values),
    run: async (sql, values = []) => {
      if (/\breturning\b/i.test(sql)) {
        const row = db.prepare(sql).get(...values)
        return { changes: row ? 1 : 0, lastInsertRowid: row?.id }
      }
      const result = db.prepare(sql).run(...values)
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
    },
    transaction: async (fn) => {
      db.exec('BEGIN')
      try {
        const result = await fn(adapter)
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    close: async () => db.close()
  }
  return adapter
}

function createPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  })
  return {
    dialect: 'postgres',
    exec: async (sql) => pool.query(sql),
    get: async (sql, values = []) => (await pool.query(params(sql), values)).rows[0],
    all: async (sql, values = []) => (await pool.query(params(sql), values)).rows,
    run: async (sql, values = []) => {
      const result = await pool.query(params(sql), values)
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }
    },
    transaction: async (fn) => {
      const client = await pool.connect()
      const scoped = {
        dialect: 'postgres',
        exec: async (sql) => client.query(sql),
        get: async (sql, values = []) => (await client.query(params(sql), values)).rows[0],
        all: async (sql, values = []) => (await client.query(params(sql), values)).rows,
        run: async (sql, values = []) => {
          const result = await client.query(params(sql), values)
          return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }
        }
      }
      try {
        await client.query('BEGIN')
        const result = await fn(scoped)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    close: async () => pool.end()
  }
}
