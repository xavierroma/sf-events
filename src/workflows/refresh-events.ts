import { FatalError, RetryableError, getStepMetadata, sleep } from "workflow"

import { appConfig } from "@/lib/env"
import type { RefreshResult, RefreshTrigger } from "@/lib/events"
import {
  beginRefreshGuard,
  createCacheRun,
  markRunFailed,
  markRunSkipped,
  markRunSucceeded,
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

interface FeedPageResult {
  entries: RawDiscoverEntry[]
  hasMore: boolean
  nextCursor: string | null
}

interface CollectedFeed {
  feed: FeedKind
  pagesFetched: number
  events: PersistableEvent[]
}

type StepWithRetries<TArgs extends unknown[], TResult> = ((...args: TArgs) => Promise<TResult>) & {
  maxRetries?: number
}

const fetchFeedPageStep: StepWithRetries<[FeedKind, string | null], FeedPageResult> = async (feed, cursor) => {
  "use step"

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

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  })

  if (response.status === 403 || response.status === 429) {
    const metadata = getStepMetadata()
    const attempt = Math.max(1, metadata.attempt)
    const retryAfterMs = Math.min(15 * 60_000, 2 ** (attempt - 1) * 10_000)
    throw new RetryableError(`Luma rate-limited ${feed} feed on page fetch`, {
      retryAfter: retryAfterMs,
    })
  }

  if (response.status >= 500) {
    throw new RetryableError(`Luma ${feed} feed returned ${response.status}`)
  }

  if (!response.ok) {
    throw new FatalError(`Luma ${feed} feed returned non-retryable status ${response.status}`)
  }

  const payload = (await response.json()) as PaginatedEventsResponse
  return {
    entries: payload.entries,
    hasMore: payload.has_more,
    nextCursor: payload.next_cursor ?? null,
  }
}
fetchFeedPageStep.maxRetries = 8

const createCacheRunStep: StepWithRetries<[RefreshTrigger["reason"], string], string> = async (
  triggerReason,
  requestedAt,
) => {
  "use step"

  return createCacheRun(triggerReason, requestedAt)
}

const beginRefreshGuardStep: StepWithRetries<[string], { acquired: boolean; reason: string | null }> = async (
  runId,
) => {
    "use step"

    return beginRefreshGuard(runId)
  }

const persistSnapshotStep: StepWithRetries<[string, PersistableEvent[]], void> = async (runId, events) => {
  "use step"

  await persistEventsSnapshot(runId, events)
}

const markRunSucceededStep: StepWithRetries<[string, number, number, number], void> = async (
  runId,
  geoPages,
  placePages,
  totalUniqueEvents,
) => {
  "use step"

  await markRunSucceeded(runId, geoPages, placePages, totalUniqueEvents)
}

const markRunFailedStep: StepWithRetries<[string, string], void> = async (runId, errorMessage) => {
  "use step"

  await markRunFailed(runId, errorMessage)
}

const markRunSkippedStep: StepWithRetries<[string, string], void> = async (runId, reason) => {
  "use step"

  await markRunSkipped(runId, reason)
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
      .map((host) => host.name?.trim() || host.username?.trim() || "")
      .filter((value): value is string => Boolean(value)),
    guestCount: entry.guest_count ?? null,
    ticketCount: entry.ticket_count ?? null,
    sourceGeo: feed === "geo",
    sourcePlace: feed === "place",
    rawPayload: {
      entry,
      feed,
    },
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
    rawPayload: {
      left: left.rawPayload,
      right: right.rawPayload,
    },
  }
}

function getDeterministicDelayMs(pageNumber: number) {
  const jitterMs = (pageNumber * 173) % 900
  return appConfig.luma.pageDelayMs + jitterMs
}

async function collectFeed(feed: FeedKind): Promise<CollectedFeed> {
  let cursor: string | null = null
  let pagesFetched = 0
  const events: PersistableEvent[] = []

  for (let pageNumber = 1; pageNumber <= appConfig.luma.maxPagesPerFeed; pageNumber += 1) {
    const pageResult: FeedPageResult = await fetchFeedPageStep(feed, cursor)
    pagesFetched += 1

    for (const entry of pageResult.entries) {
      events.push(normalizeEntry(entry, feed))
    }

    if (!pageResult.hasMore || !pageResult.nextCursor) {
      break
    }

    cursor = pageResult.nextCursor
    await sleep(getDeterministicDelayMs(pageNumber))
  }

  return {
    feed,
    pagesFetched,
    events,
  }
}

function dedupeAndSort(geoEvents: PersistableEvent[], placeEvents: PersistableEvent[]) {
  const merged = new Map<string, PersistableEvent>()

  for (const event of [...geoEvents, ...placeEvents]) {
    const existing = merged.get(event.id)
    if (!existing) {
      merged.set(event.id, event)
      continue
    }

    merged.set(event.id, mergeEvent(existing, event))
  }

  return [...merged.values()].sort((a, b) => {
    const left = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY
    const right = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY

    if (left === right) {
      return a.id.localeCompare(b.id)
    }

    return left - right
  })
}

export async function refreshEventsWorkflow(trigger: RefreshTrigger): Promise<RefreshResult> {
  "use workflow"

  const runId = await createCacheRunStep(trigger.reason, trigger.requestedAt)
  const guard = await beginRefreshGuardStep(runId)

  if (!guard.acquired) {
    await markRunSkippedStep(runId, guard.reason ?? "refresh run skipped")

    return {
      runId,
      geoPages: 0,
      placePages: 0,
      totalUniqueEvents: 0,
    }
  }

  try {
    const geo = await collectFeed("geo")
    const place = await collectFeed("place")

    const mergedEvents = dedupeAndSort(geo.events, place.events)

    await persistSnapshotStep(runId, mergedEvents)
    await markRunSucceededStep(runId, geo.pagesFetched, place.pagesFetched, mergedEvents.length)

    return {
      runId,
      geoPages: geo.pagesFetched,
      placePages: place.pagesFetched,
      totalUniqueEvents: mergedEvents.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh workflow error"
    await markRunFailedStep(runId, message)
    throw error
  }
}
