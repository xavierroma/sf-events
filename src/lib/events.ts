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
  guestCount: number | null
  ticketCount: number | null
  sourceGeo: boolean
  sourcePlace: boolean
}

export interface EventQueryParams {
  tab: EventTab
  page: number
  pageSize: number
  q: string
}

export interface PaginatedEventsResult {
  items: EventListItem[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
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
