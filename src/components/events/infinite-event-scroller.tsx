"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import type { EventListItem, EventQueryParams, PaginatedEventsResult } from "@/lib/events"
import { getTimelineDayKey, EventTimeline } from "./event-timeline"
import type { EventTimelineGroup } from "./event-timeline"
import { EventPanelProvider } from "./event-panel-context"
import { EventInlineSidebar, EventSidePanelMobile } from "./event-side-panel"

interface InfiniteEventScrollerProps {
  initialResult: PaginatedEventsResult
  query: EventQueryParams
}

function buildApiUrl(query: EventQueryParams, page: number): string {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("pageSize", String(query.pageSize))
  if (query.q) params.set("q", query.q)
  if (query.day) params.set("day", query.day)
  if (query.location) params.set("location", query.location)
  return `/api/events?${params.toString()}`
}

function groupEvents(events: EventListItem[]): EventTimelineGroup[] {
  const map = new Map<string, EventListItem[]>()
  for (const event of events) {
    const dayKey = getTimelineDayKey(event)
    const existing = map.get(dayKey)
    if (existing) {
      existing.push(event)
    } else {
      map.set(dayKey, [event])
    }
  }
  return [...map.entries()].map(([dayKey, items]) => ({ dayKey, items }))
}

export function InfiniteEventScroller({ initialResult, query }: InfiniteEventScrollerProps) {
  const searchParams = useSearchParams()
  const deepLinkEventId = useRef(searchParams.get("event"))

  const [allEvents, setAllEvents] = useState<EventListItem[]>(initialResult.items)
  const [isLoading, setIsLoading] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(!initialResult.hasNext)

  const nextPageRef = useRef<number | null>(initialResult.hasNext ? initialResult.page + 1 : null)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextPageRef.current === null) return
    loadingRef.current = true
    setIsLoading(true)
    try {
      const res = await fetch(buildApiUrl(query, nextPageRef.current))
      if (!res.ok) throw new Error("Failed to fetch events")
      const result: PaginatedEventsResult = await res.json()
      setAllEvents((prev) => [...prev, ...result.items])
      const newNext = result.hasNext ? result.page + 1 : null
      nextPageRef.current = newNext
      if (newNext === null) setReachedEnd(true)
    } catch (err) {
      console.error("Failed to load more events:", err)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }, [query])

  // IntersectionObserver sentinel to trigger loading next page
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "400px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Auto-load pages until the deep-linked event is found
  useEffect(() => {
    const id = deepLinkEventId.current
    if (!id || scrolledRef.current) return
    if (allEvents.some((e) => e.id === id)) return
    if (nextPageRef.current === null) return
    loadMore()
  }, [allEvents, loadMore])

  // Scroll to deep-linked event once it appears in the list
  useEffect(() => {
    const id = deepLinkEventId.current
    if (!id || scrolledRef.current) return
    if (!allEvents.some((e) => e.id === id)) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`event-${id}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        scrolledRef.current = true
      }
    })
  }, [allEvents])

  const groupedEvents = groupEvents(allEvents)

  return (
    <EventPanelProvider allEvents={allEvents}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8">
        <div className="flex items-start gap-6">
          <section className="min-w-0 flex-1 space-y-5">
            <EventTimeline groups={groupedEvents} />

            <div ref={sentinelRef} className="flex h-10 items-center justify-center">
              {isLoading && <p className="text-sm text-slate-400">Loading more events…</p>}
            </div>

            {reachedEnd && allEvents.length > 0 && (
              <p className="text-center text-sm text-slate-400">You reached the end.</p>
            )}
          </section>

          <aside
            className="hidden w-[600px] shrink-0 lg:sticky lg:top-14 py-1.5 lg:block"
            style={{ height: "calc(100vh - 3.5rem)" }}
          >
            <EventInlineSidebar />
          </aside>
        </div>
      </main>

      <EventSidePanelMobile />
    </EventPanelProvider>
  )
}
