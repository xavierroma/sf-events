import "server-only"

import { randomUUID } from "node:crypto"

import type { PoolClient } from "pg"

import type { CacheStatus, EventListItem, RefreshTrigger } from "@/lib/events"
import { withClient } from "@/db/client"

const REFRESH_LOCK_KEY = 987_654_321
const RUN_STALE_AFTER_MS = 6 * 60 * 60 * 1000

export interface PersistableEvent extends EventListItem {
  rawPayload: unknown
}

async function ensureCacheStateRow(client: PoolClient) {
  await client.query(
    `
      INSERT INTO cache_state (singleton_id, last_run_status, active_events_count)
      VALUES (TRUE, 'idle', 0)
      ON CONFLICT (singleton_id) DO NOTHING
    `,
  )
}

export async function createCacheRun(triggerReason: RefreshTrigger["reason"], requestedAt: string) {
  const runId = randomUUID()

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO cache_runs (
          id,
          trigger_reason,
          status,
          started_at,
          created_at
        ) VALUES ($1, $2, 'running', $3::timestamptz, NOW())
      `,
      [runId, triggerReason, requestedAt],
    )
  })

  return runId
}

export async function beginRefreshGuard(runId: string) {
  return withClient(async (client) => {
    await client.query("BEGIN")

    try {
      await ensureCacheStateRow(client)

      const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock($1) AS locked", [REFRESH_LOCK_KEY])
      if (!lock.rows[0]?.locked) {
        await client.query("ROLLBACK")
        return { acquired: false, reason: "advisory lock is busy" }
      }

      const state = await client.query<{ last_run_status: string; updated_at: string | null }>(
        "SELECT last_run_status, updated_at FROM cache_state WHERE singleton_id = TRUE FOR UPDATE",
      )

      const currentState = state.rows[0]
      const updatedAtMs = currentState?.updated_at ? new Date(currentState.updated_at).getTime() : 0
      const hasFreshRunningState =
        currentState?.last_run_status === "running" && Date.now() - updatedAtMs <= RUN_STALE_AFTER_MS

      if (hasFreshRunningState) {
        await client.query("ROLLBACK")
        return { acquired: false, reason: "another refresh run is active" }
      }

      await client.query(
        `
          UPDATE cache_state
          SET last_run_status = 'running', last_run_id = $1, updated_at = NOW()
          WHERE singleton_id = TRUE
        `,
        [runId],
      )

      await client.query("COMMIT")
      return { acquired: true, reason: null }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  })
}

export async function findEventIdsWithDetail(ids: string[]): Promise<string[]> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) {
    return []
  }

  return withClient(async (client) => {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM events
        WHERE id = ANY($1::text[])
          AND raw_payload ? 'detail'
      `,
      [uniqueIds],
    )

    return result.rows.map((row) => row.id)
  })
}

export async function findAllEventIds(): Promise<string[]> {
  return withClient(async (client) => {
    const result = await client.query<{ id: string }>(`SELECT id FROM events WHERE is_active = TRUE`)
    return result.rows.map((row) => row.id)
  })
}

export async function patchEventDetail(eventId: string, detail: unknown): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `
        UPDATE events
        SET raw_payload = raw_payload || jsonb_build_object('detail', $2::jsonb),
            updated_at = NOW()
        WHERE id = $1
      `,
      [eventId, JSON.stringify(detail)],
    )
  })
}

export async function persistEventsSnapshot(runId: string, events: PersistableEvent[]) {
  await withClient(async (client) => {
    await client.query("BEGIN")

    try {
      const ids: string[] = []

      for (const event of events) {
        ids.push(event.id)

        await client.query(
          `
            INSERT INTO events (
              id,
              title,
              cover_url,
              start_at,
              end_at,
              timezone,
              slug,
              location_type,
              city,
              city_state,
              latitude,
              longitude,
              hosts,
              guest_count,
              ticket_count,
              source_geo,
              source_place,
              is_active,
              raw_payload,
              first_seen_at,
              last_seen_at,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4::timestamptz,
              $5::timestamptz,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14,
              $15,
              $16,
              $17,
              TRUE,
              $18::jsonb,
              NOW(),
              NOW(),
              NOW(),
              NOW()
            )
            ON CONFLICT (id) DO UPDATE
            SET
              title = EXCLUDED.title,
              cover_url = EXCLUDED.cover_url,
              start_at = EXCLUDED.start_at,
              end_at = EXCLUDED.end_at,
              timezone = EXCLUDED.timezone,
              slug = EXCLUDED.slug,
              location_type = EXCLUDED.location_type,
              city = EXCLUDED.city,
              city_state = EXCLUDED.city_state,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              hosts = EXCLUDED.hosts,
              guest_count = EXCLUDED.guest_count,
              ticket_count = EXCLUDED.ticket_count,
              source_geo = EXCLUDED.source_geo,
              source_place = EXCLUDED.source_place,
              is_active = TRUE,
              raw_payload = events.raw_payload || EXCLUDED.raw_payload,
              last_seen_at = NOW(),
              updated_at = NOW()
          `,
          [
            event.id,
            event.title,
            event.coverUrl,
            event.startAt,
            event.endAt,
            event.timezone,
            event.slug,
            event.locationType,
            event.city,
            event.cityState,
            event.latitude,
            event.longitude,
            event.hosts,
            event.guestCount,
            event.ticketCount,
            event.sourceGeo,
            event.sourcePlace,
            JSON.stringify(event.rawPayload ?? {}),
          ],
        )
      }

      await client.query(
        `
          UPDATE events
          SET is_active = FALSE, updated_at = NOW()
          WHERE is_active = TRUE
            AND NOT (id = ANY($1::text[]))
        `,
        [ids],
      )

      await client.query(
        `
          UPDATE cache_state
          SET
            last_successful_at = NOW(),
            last_run_status = 'succeeded',
            active_events_count = $2,
            last_run_id = $1,
            updated_at = NOW()
          WHERE singleton_id = TRUE
        `,
        [runId, events.length],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  })
}

export async function markRunSucceeded(runId: string, geoPages: number, placePages: number, totalUniqueEvents: number) {
  await withClient(async (client) => {
    await client.query(
      `
        UPDATE cache_runs
        SET
          status = 'succeeded',
          finished_at = NOW(),
          geo_pages = $2,
          place_pages = $3,
          total_unique_events = $4
        WHERE id = $1
      `,
      [runId, geoPages, placePages, totalUniqueEvents],
    )
  })
}

export async function markRunFailed(runId: string, errorMessage: string) {
  await withClient(async (client) => {
    await client.query("BEGIN")

    try {
      await client.query(
        `
          UPDATE cache_runs
          SET status = 'failed', finished_at = NOW(), error_message = $2
          WHERE id = $1
        `,
        [runId, errorMessage.slice(0, 4000)],
      )

      await client.query(
        `
          UPDATE cache_state
          SET last_run_status = 'failed', updated_at = NOW()
          WHERE singleton_id = TRUE AND last_run_id = $1
        `,
        [runId],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  })
}

export async function markRunSkipped(runId: string, reason: string) {
  await withClient(async (client) => {
    await client.query(
      `
        UPDATE cache_runs
        SET status = 'skipped', finished_at = NOW(), error_message = $2
        WHERE id = $1
      `,
      [runId, reason.slice(0, 4000)],
    )
  })
}

export async function getCacheStatus(): Promise<CacheStatus> {
  return withClient(async (client) => {
    await ensureCacheStateRow(client)

    const result = await client.query<{
      last_successful_at: string | null
      last_run_status: CacheStatus["lastRunStatus"]
      active_events_count: number
    }>(
      `
        SELECT last_successful_at, last_run_status, active_events_count
        FROM cache_state
        WHERE singleton_id = TRUE
      `,
    )

    const row = result.rows[0]
    return {
      lastSuccessfulAt: row?.last_successful_at ?? null,
      lastRunStatus: row?.last_run_status ?? "idle",
      totalEvents: row?.active_events_count ?? 0,
    }
  })
}
