import "server-only"

import { dbQuery } from "@/db/client"
import { getCacheStatus } from "@/server/events/repository"
import type {
  CacheStatus,
  EventFacetsResult,
  EventListItem,
  EventQueryParams,
  PaginatedEventsResult,
  SearchMode,
} from "@/lib/events"
import { normalizeDayFilter, normalizeLocationFilter, normalizeQuery } from "@/lib/events"

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
  short_address: string | null
  description_mirror: unknown
}

interface SearchFilters {
  whereSql: string
  values: unknown[]
  tsQueryIndex: number | null
}

interface EventSearchFiltersInput {
  q: string
  day?: string | null
  location?: string | null
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
    shortAddress: row.short_address ?? null,
    descriptionMirror: row.description_mirror ?? undefined,
  }
}

function buildSearchFilters(input: EventSearchFiltersInput): SearchFilters {
  const values: unknown[] = []
  const conditions: string[] = ["is_active = TRUE", "end_at > NOW()"]

  const normalizedQuery = normalizeQuery(input.q)
  let tsQueryIndex: number | null = null

  if (normalizedQuery) {
    values.push(normalizedQuery)
    tsQueryIndex = values.length

    values.push(`%${normalizedQuery}%`)
    const ilikeIndex = values.length

    conditions.push(`
      (
        search_document @@ plainto_tsquery('simple', $${tsQueryIndex})
        OR title ILIKE $${ilikeIndex}
        OR city ILIKE $${ilikeIndex}
        OR city_state ILIKE $${ilikeIndex}
        OR EXISTS (
          SELECT 1
          FROM unnest(hosts) AS host
          WHERE host ILIKE $${ilikeIndex}
        )
      )
    `)
  }

  const normalizedDay = normalizeDayFilter(input.day ?? null)
  if (normalizedDay) {
    values.push(normalizedDay)
    const dayIndex = values.length
    conditions.push(`DATE(start_at AT TIME ZONE COALESCE(timezone, 'America/Los_Angeles')) = $${dayIndex}::date`)
  }

  const normalizedLocation = normalizeLocationFilter(input.location ?? null)
  if (normalizedLocation) {
    values.push(normalizedLocation)
    const locationIndex = values.length
    conditions.push(`LOWER(COALESCE(NULLIF(city_state, ''), NULLIF(city, ''))) = LOWER($${locationIndex})`)
  }

  return {
    whereSql: `WHERE ${conditions.join("\n  AND ")}`,
    values,
    tsQueryIndex,
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

  const filters = buildSearchFilters(params)
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
        CASE WHEN raw_payload->'detail'->'event'->'geo_address_info'->>'mode' = 'shown'
          THEN raw_payload->'detail'->'event'->'geo_address_info'->>'short_address'
          ELSE NULL END AS short_address,
        raw_payload->'detail'->'description_mirror' AS description_mirror,
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
  const filters = buildSearchFilters({ q: options.q })
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
        CASE WHEN raw_payload->'detail'->'event'->'geo_address_info'->>'mode' = 'shown'
          THEN raw_payload->'detail'->'event'->'geo_address_info'->>'short_address'
          ELSE NULL END AS short_address,
        raw_payload->'detail'->'description_mirror' AS description_mirror,
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

export async function getEventById(id: string): Promise<EventListItem | null> {
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
        CASE WHEN raw_payload->'detail'->'event'->'geo_address_info'->>'mode' = 'shown'
          THEN raw_payload->'detail'->'event'->'geo_address_info'->>'short_address'
          ELSE NULL END AS short_address,
        raw_payload->'detail'->'description_mirror' AS description_mirror
      FROM events
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  )

  const row = rows.rows[0]
  return row ? mapEventRow(row) : null
}

export async function getEventFacets(filters: Pick<EventSearchFiltersInput, "q">): Promise<EventFacetsResult> {
  const search = buildSearchFilters({ q: filters.q })

  const [daysResult, locationsResult] = await Promise.all([
    dbQuery<{ day: string }>(
      `
        SELECT TO_CHAR(DATE(start_at AT TIME ZONE COALESCE(timezone, 'America/Los_Angeles')), 'YYYY-MM-DD') AS day
        FROM events
        ${search.whereSql}
          AND start_at IS NOT NULL
        GROUP BY day
        ORDER BY day ASC
        LIMIT 45
      `,
      search.values,
    ),
    dbQuery<{ location: string | null }>(
      `
        SELECT COALESCE(NULLIF(city_state, ''), NULLIF(city, '')) AS location
        FROM events
        ${search.whereSql}
          AND COALESCE(NULLIF(city_state, ''), NULLIF(city, '')) IS NOT NULL
        GROUP BY location
        ORDER BY COUNT(*) DESC, location ASC
        LIMIT 80
      `,
      search.values,
    ),
  ])

  return {
    days: daysResult.rows.map((row) => row.day).filter(Boolean),
    locations: locationsResult.rows.map((row) => row.location).filter((value): value is string => Boolean(value)),
  }
}
