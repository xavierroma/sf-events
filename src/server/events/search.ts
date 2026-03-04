import "server-only"

import { dbQuery } from "@/db/client"
import { getCacheStatus } from "@/server/events/repository"
import type { CacheStatus, EventListItem, EventQueryParams, PaginatedEventsResult, SearchMode } from "@/lib/events"

interface EventRow {
  id: string
  title: string
  cover_url: string | null
  start_at: string | null
  end_at: string | null
  timezone: string | null
  slug: string | null
  location_type: string | null
  city: string | null
  city_state: string | null
  latitude: number | null
  longitude: number | null
  hosts: string[] | null
  guest_count: number | null
  ticket_count: number | null
  source_geo: boolean
  source_place: boolean
}

interface SearchFilters {
  whereSql: string
  values: unknown[]
  tsQueryIndex: number | null
}

function mapEventRow(row: EventRow): EventListItem {
  return {
    id: row.id,
    title: row.title,
    coverUrl: row.cover_url,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    slug: row.slug,
    locationType: row.location_type,
    city: row.city,
    cityState: row.city_state,
    latitude: row.latitude,
    longitude: row.longitude,
    hosts: row.hosts ?? [],
    guestCount: row.guest_count,
    ticketCount: row.ticket_count,
    sourceGeo: row.source_geo,
    sourcePlace: row.source_place,
  }
}

function buildSearchFilters(q: string): SearchFilters {
  const trimmed = q.trim()

  if (!trimmed) {
    return {
      whereSql: "WHERE is_active = TRUE",
      values: [],
      tsQueryIndex: null,
    }
  }

  return {
    whereSql: `
      WHERE is_active = TRUE
        AND (
          search_document @@ plainto_tsquery('simple', $1)
          OR title ILIKE $2
          OR city ILIKE $2
          OR city_state ILIKE $2
          OR EXISTS (
            SELECT 1
            FROM unnest(hosts) AS host
            WHERE host ILIKE $2
          )
        )
    `,
    values: [trimmed, `%${trimmed}%`],
    tsQueryIndex: 1,
  }
}

function buildOrderClause(hasQuery: boolean) {
  if (!hasQuery) {
    return "ORDER BY start_at ASC NULLS LAST, id ASC"
  }

  return "ORDER BY relevance_score DESC, start_at ASC NULLS LAST, id ASC"
}

export async function getPaginatedEvents(params: EventQueryParams, mode: SearchMode = "lexical"): Promise<PaginatedEventsResult> {
  if (mode !== "lexical" && mode !== "hybrid") {
    throw new Error(`Unsupported search mode: ${mode}`)
  }

  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize

  const filters = buildSearchFilters(params.q)
  const countResult = await dbQuery<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM events
      ${filters.whereSql}
    `,
    filters.values,
  )

  const total = Number(countResult.rows[0]?.total ?? "0")

  const paginationValues = [...filters.values, pageSize, offset]
  const limitIndex = filters.values.length + 1
  const offsetIndex = filters.values.length + 2

  const tsQuerySql = filters.tsQueryIndex ? `ts_rank(search_document, plainto_tsquery('simple', $${filters.tsQueryIndex}))` : "0"

  const rows = await dbQuery<EventRow>(
    `
      SELECT
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
        ${tsQuerySql} AS relevance_score
      FROM events
      ${filters.whereSql}
      ${buildOrderClause(Boolean(filters.tsQueryIndex))}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    paginationValues,
  )

  return {
    items: rows.rows.map(mapEventRow),
    total,
    page,
    pageSize,
    hasNext: offset + rows.rows.length < total,
  }
}

export async function getMapEvents(
  options: { q: string; limit?: number; mode?: SearchMode } = { q: "" },
): Promise<EventListItem[]> {
  const mode = options.mode ?? "lexical"
  if (mode !== "lexical" && mode !== "hybrid") {
    throw new Error(`Unsupported search mode: ${mode}`)
  }

  const limit = Math.min(Math.max(1, options.limit ?? 2000), 5000)
  const filters = buildSearchFilters(options.q)
  const values = [...filters.values, limit]
  const limitIndex = filters.values.length + 1

  const tsQuerySql = filters.tsQueryIndex ? `ts_rank(search_document, plainto_tsquery('simple', $${filters.tsQueryIndex}))` : "0"

  const rows = await dbQuery<EventRow>(
    `
      SELECT
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
        ${tsQuerySql} AS relevance_score
      FROM events
      ${filters.whereSql}
      ${buildOrderClause(Boolean(filters.tsQueryIndex))}
      LIMIT $${limitIndex}
    `,
    values,
  )

  return rows.rows.map(mapEventRow)
}

export async function readCacheStatus(): Promise<CacheStatus> {
  return getCacheStatus()
}
