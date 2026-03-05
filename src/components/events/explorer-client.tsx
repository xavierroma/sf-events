import { Suspense } from "react"

import type { EventFacetsResult, EventQueryParams, PaginatedEventsResult } from "@/lib/events"

import { FilterBar } from "./filter-bar"
import { InfiniteEventScroller } from "./infinite-event-scroller"

interface ExplorerClientProps {
  initialResult: PaginatedEventsResult
  facets: EventFacetsResult
  query: EventQueryParams
}

export function ExplorerClient({ initialResult, facets, query }: ExplorerClientProps) {
  const dayOptions = [...new Set(facets.days)]
  if (query.day && !dayOptions.includes(query.day)) {
    dayOptions.unshift(query.day)
  }

  const locationOptions = [...new Set(facets.locations)]
  if (query.location && !locationOptions.includes(query.location)) {
    locationOptions.unshift(query.location)
  }

  const scrollerKey = `${query.q}|${query.day ?? ""}|${query.location ?? ""}`

  return (
    <Suspense>
      <FilterBar
        query={query}
        dayOptions={dayOptions}
        locationOptions={locationOptions}
      />
      <InfiniteEventScroller
        key={scrollerKey}
        initialResult={initialResult}
        query={query}
      />
    </Suspense>
  )
}
