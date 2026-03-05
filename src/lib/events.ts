export type EventTab = "list" | "map"
export type SearchMode = "lexical" | "hybrid"
export type CacheRunStatus = "idle" | "running" | "failed" | "succeeded"

export interface EventListItem {
  id: string
  title: string
  coverUrl: string | null
  startAt: string | null
  endAt: string | null
  timezone: string | null
  slug: string | null
  locationType: string | null
  city: string | null
  cityState: string | null
  latitude: number | null
  longitude: number | null
  hosts: string[]
  hostAvatars: string[]
  guestAvatars: string[]
  guestNames: string[]
  guestCount: number | null
  ticketCount: number | null
  sourceGeo: boolean
  sourcePlace: boolean
  shortAddress?: string | null
  descriptionMirror?: unknown
}

export interface EventQueryParams {
  page: number
  pageSize: number
  q: string
  day: string | null
  location: string | null
}

export interface PaginatedEventsResult {
  items: EventListItem[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
}

export interface EventFacetsResult {
  days: string[]
  locations: string[]
}

export interface CacheStatus {
  lastSuccessfulAt: string | null
  lastRunStatus: CacheRunStatus
  totalEvents: number
}

export interface RefreshTrigger {
  reason: "cron" | "bootstrap"
  requestedAt: string
}

export interface RefreshResult {
  runId: string
  geoPages: number
  placePages: number
  totalUniqueEvents: number
}

export function toEventUrl(slug: string | null) {
  if (!slug) {
    return null
  }

  if (slug.startsWith("http://") || slug.startsWith("https://")) {
    return slug
  }

  return `https://lu.ma/${slug}`
}

export function formatEventDateTime(event: EventListItem) {
  if (!event.startAt) {
    return "Date not available"
  }

  const date = new Date(event.startAt)
  const formatterOptions: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }

  if (event.timezone) {
    formatterOptions.timeZone = event.timezone
  }

  try {
    return new Intl.DateTimeFormat("en-US", formatterOptions).format(date)
  } catch {
    return date.toLocaleString()
  }
}

export function getLocationLabel(event: EventListItem) {
  if (event.locationType === "online") {
    return "Online"
  }

  return event.cityState ?? event.city ?? "Hidden / Unknown"
}

const DAY_FILTER_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function normalizeQuery(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, 200)
}

export function normalizeDayFilter(value: string | null | undefined) {
  const candidate = (value ?? "").trim()
  return DAY_FILTER_PATTERN.test(candidate) ? candidate : null
}

export function normalizeLocationFilter(value: string | null | undefined) {
  const candidate = (value ?? "").trim()
  return candidate ? candidate.slice(0, 120) : null
}
