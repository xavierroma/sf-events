import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migrations")
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
})

const migrationsDir = join(process.cwd(), "src", "db", "migrations")

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function main() {
  await ensureMigrationsTable()

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b))

  for (const filename of files) {
    const fullPath = join(migrationsDir, filename)
    const sql = await readFile(fullPath, "utf8")
    const checksum = createHash("sha256").update(sql).digest("hex")

    const existing = await pool.query<{ checksum: string }>(
      "SELECT checksum FROM schema_migrations WHERE filename = $1",
      [filename],
    )

    if (existing.rowCount === 1) {
      const appliedChecksum = existing.rows[0]?.checksum
      if (appliedChecksum !== checksum) {
        throw new Error(`Migration checksum mismatch for ${filename}.`)
      }
      console.log(`Skipping ${filename} (already applied)`)
      continue
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum])
      await client.query("COMMIT")
      console.log(`Applied ${filename}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  console.log("Migration complete")
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
