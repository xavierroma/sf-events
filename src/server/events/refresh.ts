import "server-only"

import { appConfig } from "@/lib/env"
import type { RefreshResult, RefreshTrigger } from "@/lib/events"
import {
  beginRefreshGuard,
  createCacheRun,
  findAllEventIds,
  findEventIdsWithDetail,
  markRunFailed,
  markRunSkipped,
  markRunSucceeded,
  patchEventDetail,
  persistEventsSnapshot,
  type PersistableEvent,
} from "@/server/events/repository"

type FeedKind = "geo" | "place"
type Nullable<T> = T | null | undefined

interface RawHost {
  name?: Nullable<string>
  username?: Nullable<string>
}

interface RawCoordinate {
  latitude?: Nullable<number>
  longitude?: Nullable<number>
}

interface RawAddressInfo {
  city?: Nullable<string>
  city_state?: Nullable<string>
}

interface RawEvent {
  cover_url?: Nullable<string>
  name?: Nullable<string>
  start_at?: Nullable<string>
  end_at?: Nullable<string>
  timezone?: Nullable<string>
  url?: Nullable<string>
  location_type?: Nullable<string>
  coordinate?: Nullable<RawCoordinate>
  geo_address_info?: Nullable<RawAddressInfo>
}

interface RawDiscoverEntry {
  api_id: string
  start_at?: Nullable<string>
  hosts?: Nullable<RawHost[]>
  guest_count?: Nullable<number>
  ticket_count?: Nullable<number>
  event?: Nullable<RawEvent>
}

interface PaginatedEventsResponse {
  entries: RawDiscoverEntry[]
  has_more: boolean
  next_cursor?: Nullable<string>
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function normalizeEntry(entry: RawDiscoverEntry, feed: FeedKind): PersistableEvent {
  const event = entry.event ?? null
  const hosts = entry.hosts ?? []
  const coordinate = event?.coordinate ?? null
  const address = event?.geo_address_info ?? null

  return {
    id: entry.api_id,
    title: event?.name?.trim() || "Untitled event",
    coverUrl: event?.cover_url ?? null,
    startAt: entry.start_at ?? event?.start_at ?? null,
    endAt: event?.end_at ?? null,
    timezone: event?.timezone ?? null,
    slug: event?.url ?? null,
    locationType: event?.location_type ?? null,
    city: address?.city ?? null,
    cityState: address?.city_state ?? null,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    hosts: hosts
      .map((h) => h.name?.trim() || h.username?.trim() || "")
      .filter((v): v is string => Boolean(v)),
    guestCount: entry.guest_count ?? null,
    ticketCount: entry.ticket_count ?? null,
    sourceGeo: feed === "geo",
    sourcePlace: feed === "place",
    rawPayload: { discover: { entry, feed } },
  }
}

function mergeEvent(left: PersistableEvent, right: PersistableEvent): PersistableEvent {
  return {
    ...left,
    title: right.title || left.title,
    coverUrl: right.coverUrl ?? left.coverUrl,
    startAt: right.startAt ?? left.startAt,
    endAt: right.endAt ?? left.endAt,
    timezone: right.timezone ?? left.timezone,
    slug: right.slug ?? left.slug,
    locationType: right.locationType ?? left.locationType,
    city: right.city ?? left.city,
    cityState: right.cityState ?? left.cityState,
    latitude: right.latitude ?? left.latitude,
    longitude: right.longitude ?? left.longitude,
    hosts: Array.from(new Set([...left.hosts, ...right.hosts])),
    guestCount: right.guestCount ?? left.guestCount,
    ticketCount: right.ticketCount ?? left.ticketCount,
    sourceGeo: left.sourceGeo || right.sourceGeo,
    sourcePlace: left.sourcePlace || right.sourcePlace,
    rawPayload: { discover: { left: left.rawPayload, right: right.rawPayload } },
  }
}

function dedupeAndSort(geoEvents: PersistableEvent[], placeEvents: PersistableEvent[]) {
  const merged = new Map<string, PersistableEvent>()

  for (const event of [...geoEvents, ...placeEvents]) {
    const existing = merged.get(event.id)
    if (!existing) {
      merged.set(event.id, event)
    } else {
      merged.set(event.id, mergeEvent(existing, event))
    }
  }

  return [...merged.values()].sort((a, b) => {
    const left = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY
    const right = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY
    return left !== right ? left - right : a.id.localeCompare(b.id)
  })
}

async function fetchFeedPage(feed: FeedKind, cursor: string | null): Promise<{
  entries: RawDiscoverEntry[]
  hasMore: boolean
  nextCursor: string | null
}> {
  const endpoint = new URL("/discover/get-paginated-events", appConfig.luma.apiBase)
  endpoint.searchParams.set("pagination_limit", String(appConfig.luma.paginationLimit))

  if (feed === "geo") {
    endpoint.searchParams.set("latitude", String(appConfig.luma.latitude))
    endpoint.searchParams.set("longitude", String(appConfig.luma.longitude))
  } else {
    endpoint.searchParams.set("discover_place_api_id", appConfig.luma.discoverPlaceApiId)
  }

  if (cursor) {
    endpoint.searchParams.set("pagination_cursor", cursor)
  }

  const response = await fetch(endpoint.toString(), { headers: { accept: "application/json" } })

  if (!response.ok) {
    throw new Error(`Luma ${feed} feed returned ${response.status}`)
  }

  const payload = (await response.json()) as PaginatedEventsResponse
  return {
    entries: payload.entries,
    hasMore: payload.has_more,
    nextCursor: payload.next_cursor ?? null,
  }
}

async function collectFeed(feed: FeedKind): Promise<{ pagesFetched: number; events: PersistableEvent[] }> {
  let cursor: string | null = null
  let pagesFetched = 0
  const events: PersistableEvent[] = []

  for (let page = 1; page <= appConfig.luma.maxPagesPerFeed; page++) {
    const result = await fetchFeedPage(feed, cursor)
    pagesFetched++

    for (const entry of result.entries) {
      events.push(normalizeEntry(entry, feed))
    }

    if (!result.hasMore || !result.nextCursor) break

    cursor = result.nextCursor
    await sleep(appConfig.luma.pageDelayMs)
  }

  return { pagesFetched, events }
}

async function fetchEventDetail(eventId: string): Promise<unknown | null> {
  const endpoint = new URL("/event/get", appConfig.luma.apiBase)
  endpoint.searchParams.set("event_api_id", eventId)

  const response = await fetch(endpoint.toString(), { headers: { accept: "application/json" } })

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Luma event detail returned ${response.status} for ${eventId}`)

  return response.json()
}

export async function enrichMissingDetails(): Promise<void> {
  const allEventIds = await findAllEventIds()
  if (allEventIds.length === 0) return

  const idsWithDetail = new Set(await findEventIdsWithDetail(allEventIds))
  const needDetail = allEventIds.filter((id) => !idsWithDetail.has(id))

  for (let i = 0; i < needDetail.length; i++) {
    const id = needDetail[i]
    try {
      const detail = await fetchEventDetail(id)
      if (detail !== null) {
        await patchEventDetail(id, detail)
      }
    } catch {
      // skip on error — next run will retry
    }

    if (i < needDetail.length - 1) {
      await sleep(appConfig.luma.detailDelayMs)
    }
  }
}

export async function runRefresh(trigger: RefreshTrigger): Promise<RefreshResult> {
  const runId = await createCacheRun(trigger.reason, trigger.requestedAt)
  const guard = await beginRefreshGuard(runId)

  if (!guard.acquired) {
    await markRunSkipped(runId, guard.reason ?? "refresh run skipped")
    return { runId, geoPages: 0, placePages: 0, totalUniqueEvents: 0 }
  }

  try {
    const [geo, place] = await Promise.all([collectFeed("geo"), collectFeed("place")])

    const mergedEvents = dedupeAndSort(geo.events, place.events)

    await persistEventsSnapshot(runId, mergedEvents)
    await markRunSucceeded(runId, geo.pagesFetched, place.pagesFetched, mergedEvents.length)

    return {
      runId,
      geoPages: geo.pagesFetched,
      placePages: place.pagesFetched,
      totalUniqueEvents: mergedEvents.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markRunFailed(runId, message).catch(() => { })
    throw error
  }
}
