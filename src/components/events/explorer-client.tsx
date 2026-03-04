"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, ExternalLink, MapPin, Search, X } from "lucide-react"

import { EventMap } from "@/components/events/event-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CacheStatus, EventListItem, EventQueryParams, PaginatedEventsResult } from "@/lib/events"
import { formatEventDateTime, getLocationLabel, toEventUrl } from "@/lib/events"
import { cn } from "@/lib/utils"

interface ExplorerClientProps {
  listResult: PaginatedEventsResult
  mapEvents: EventListItem[]
  cacheStatus: CacheStatus
  query: EventQueryParams
}

interface EventDetailsPanelProps {
  event: EventListItem | null
  mobile?: boolean
  onClose?: () => void
}

function EventDetailsPanel({ event, mobile = false, onClose }: EventDetailsPanelProps) {
  if (!event) {
    return (
      <Card className="border-slate-900/10 bg-white/90">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select an event from the list or map to see details.
        </CardContent>
      </Card>
    )
  }

  const eventUrl = toEventUrl(event.slug)

  return (
    <Card className={cn("h-full border-slate-900/10 bg-white/95", mobile && "rounded-none border-0")}>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>Event Details</CardDescription>
            <CardTitle className="text-balance text-2xl leading-tight">{event.title}</CardTitle>
          </div>
          {mobile && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
              <X />
            </Button>
          )}
        </div>

        {event.coverUrl && (
          <div className="overflow-hidden rounded-xl border">
            <img src={event.coverUrl} alt={event.title} className="h-52 w-full object-cover" loading="lazy" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{formatEventDateTime(event)}</p>
              <p className="text-xs text-muted-foreground">{event.timezone ?? "Timezone unavailable"}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{getLocationLabel(event)}</p>
              {event.latitude !== null && event.longitude !== null && (
                <p className="text-xs text-muted-foreground">
                  {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{event.locationType ?? "unknown"}</Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            {event.id}
          </Badge>
          <Badge variant="outline">{event.sourceGeo && event.sourcePlace ? "geo + place" : event.sourceGeo ? "geo" : "place"}</Badge>
        </div>

        {event.hosts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hosts</p>
            <p className="text-sm">{event.hosts.join(", ")}</p>
          </div>
        )}

        {eventUrl && (
          <Button asChild className="w-full sm:w-auto">
            <a href={eventUrl} target="_blank" rel="noreferrer">
              Open Event Page
              <ExternalLink />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function formatCacheTime(cacheStatus: CacheStatus) {
  if (!cacheStatus.lastSuccessfulAt) {
    return "No successful refresh yet"
  }

  try {
    return new Date(cacheStatus.lastSuccessfulAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return cacheStatus.lastSuccessfulAt
  }
}

function cacheStatusLabel(status: CacheStatus["lastRunStatus"]) {
  switch (status) {
    case "running":
      return "Refresh running"
    case "failed":
      return "Last refresh failed"
    case "succeeded":
      return "Cache is warm"
    default:
      return "Idle"
  }
}

export function ExplorerClient({ listResult, mapEvents, cacheStatus, query }: ExplorerClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<EventQueryParams["tab"]>(query.tab)
  const [searchInput, setSearchInput] = useState(query.q)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)

  useEffect(() => {
    setActiveTab(query.tab)
  }, [query.tab])

  useEffect(() => {
    setSearchInput(query.q)
  }, [query.q])

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }

      const nextQuery = params.toString()
      const href = nextQuery ? `${pathname}?${nextQuery}` : pathname
      router.push(href, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const allEvents = useMemo(() => {
    const merged = new Map<string, EventListItem>()

    for (const event of mapEvents) {
      merged.set(event.id, event)
    }

    for (const event of listResult.items) {
      if (!merged.has(event.id)) {
        merged.set(event.id, event)
      }
    }

    return [...merged.values()]
  }, [listResult.items, mapEvents])

  const visibleEvents = activeTab === "list" ? listResult.items : mapEvents

  useEffect(() => {
    if (visibleEvents.length === 0) {
      setSelectedEventId(null)
      return
    }

    if (!selectedEventId || !visibleEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(visibleEvents[0].id)
    }
  }, [selectedEventId, visibleEvents])

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null
    }

    return allEvents.find((event) => event.id === selectedEventId) ?? null
  }, [allEvents, selectedEventId])

  const handleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId)
    setIsMobilePanelOpen(true)
  }, [])

  const totalPages = Math.max(1, Math.ceil(listResult.total / listResult.pageSize))
  const canGoPrevious = listResult.page > 1
  const canGoNext = listResult.hasNext

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <section className="mx-auto max-w-[1400px] space-y-5">
        <Card className="border-slate-900/10 bg-white/90">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-950 text-slate-50">San Francisco Events</Badge>
              <Badge variant="secondary">Shared Postgres Cache</Badge>
              <Badge variant="outline">Workflow refresh ({cacheStatusLabel(cacheStatus.lastRunStatus)})</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl tracking-tight">Server-rendered Event Explorer</CardTitle>
              <CardDescription>
                Cached asynchronously by a scheduled workflow. URL params drive tab, pagination, and filters.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>{cacheStatus.totalEvents} cached events</span>
            <span>Last success: {formatCacheTime(cacheStatus)}</span>
            <span>
              List page {listResult.page} of {totalPages}
            </span>
            <span>{mapEvents.length} map candidates</span>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="border-slate-900/10 bg-white/92">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => {
                    const nextTab = value as EventQueryParams["tab"]
                    setActiveTab(nextTab)
                    updateUrl({ tab: nextTab })
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="grid w-full grid-cols-2 sm:w-[260px]">
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="map">Map</TabsTrigger>
                  </TabsList>
                </Tabs>

                <form
                  className="flex w-full gap-2 sm:w-auto"
                  onSubmit={(event) => {
                    event.preventDefault()
                    updateUrl({ q: searchInput.trim() || null, page: "1" })
                  }}
                >
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search events, hosts, location..."
                    className="sm:w-[280px]"
                  />
                  <Button type="submit" variant="secondary" size="icon" aria-label="Search">
                    <Search />
                  </Button>
                </form>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  const nextTab = value as EventQueryParams["tab"]
                  setActiveTab(nextTab)
                  updateUrl({ tab: nextTab })
                }}
                className="w-full"
              >
                <TabsContent value="list" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{listResult.total} results</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoPrevious}
                        onClick={() => updateUrl({ page: String(Math.max(1, listResult.page - 1)), tab: "list" })}
                      >
                        Previous
                      </Button>
                      <span>
                        {listResult.page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoNext}
                        onClick={() => updateUrl({ page: String(listResult.page + 1), tab: "list" })}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[68vh] rounded-lg border bg-background/60 p-2">
                    <div className="space-y-2 pr-2">
                      {listResult.items.length === 0 && (
                        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                          No events match your search.
                        </div>
                      )}

                      {listResult.items.map((event) => {
                        const isSelected = event.id === selectedEventId
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => handleSelectEvent(event.id)}
                            className={cn(
                              "w-full rounded-xl border p-4 text-left transition-colors",
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-slate-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className={cn("font-semibold leading-tight", isSelected ? "text-slate-50" : "text-slate-900")}>
                                  {event.title}
                                </p>
                                <p className={cn("text-xs", isSelected ? "text-slate-300" : "text-muted-foreground")}>
                                  {event.hosts.length > 0 ? event.hosts.join(", ") : "Unknown host"}
                                </p>
                              </div>
                              <Badge variant={isSelected ? "secondary" : "outline"} className="capitalize">
                                {event.locationType ?? "unknown"}
                              </Badge>
                            </div>

                            <div
                              className={cn(
                                "mt-3 flex flex-col gap-1 text-xs sm:flex-row sm:gap-4",
                                isSelected ? "text-slate-300" : "text-muted-foreground",
                              )}
                            >
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatEventDateTime(event)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {getLocationLabel(event)}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="map" className="mt-0">
                  <EventMap events={mapEvents} selectedEventId={selectedEventId} onSelectEvent={handleSelectEvent} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <aside className="hidden lg:block">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-hidden">
              <ScrollArea className="h-[calc(100vh-3rem)] pr-1">
                <EventDetailsPanel event={selectedEvent} />
              </ScrollArea>
            </div>
          </aside>
        </div>
      </section>

      <div className={cn("fixed inset-0 z-50 lg:hidden", isMobilePanelOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <button
          type="button"
          onClick={() => setIsMobilePanelOpen(false)}
          className={cn(
            "absolute inset-0 bg-slate-950/35 transition-opacity",
            isMobilePanelOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label="Close details overlay"
        />
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform",
            isMobilePanelOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <ScrollArea className="h-full">
            <EventDetailsPanel event={selectedEvent} mobile onClose={() => setIsMobilePanelOpen(false)} />
          </ScrollArea>
        </div>
      </div>
    </main>
  )
}
