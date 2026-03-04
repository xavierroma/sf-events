export const DB_TABLES = {
  events: "events",
  cacheRuns: "cache_runs",
  cacheState: "cache_state",
  eventEmbeddings: "event_embeddings",
} as const

export type CacheRunStatus = "running" | "failed" | "succeeded" | "skipped"

export interface EventRow {
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
  hosts: string[]
  guest_count: number | null
  ticket_count: number | null
  source_geo: boolean
  source_place: boolean
  is_active: boolean
  raw_payload: unknown
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface CacheStateRow {
  singleton_id: boolean
  last_successful_at: string | null
  last_run_status: "idle" | "running" | "failed" | "succeeded"
  active_events_count: number
  last_run_id: string | null
  updated_at: string
}

export interface CacheRunRow {
  id: string
  trigger_reason: "cron" | "bootstrap"
  status: CacheRunStatus
  started_at: string
  finished_at: string | null
  error_message: string | null
  geo_pages: number
  place_pages: number
  total_unique_events: number
  created_at: string
}
