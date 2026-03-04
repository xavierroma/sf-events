import "server-only"

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg"

import { appConfig } from "@/lib/env"

declare global {
  var __lumaPool: Pool | undefined
}

function shouldEnableSsl(connectionString: string) {
  return !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")
}

export function getPool() {
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL is not configured")
  }

  if (!global.__lumaPool) {
    global.__lumaPool = new Pool({
      connectionString: appConfig.databaseUrl,
      ssl: shouldEnableSsl(appConfig.databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  }

  return global.__lumaPool
}

export async function withClient<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, values)
}
