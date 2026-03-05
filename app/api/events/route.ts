import { NextResponse } from "next/server"

import { normalizeDayFilter, normalizeLocationFilter, normalizeQuery, type EventQueryParams } from "@/lib/events"
import { getPaginatedEvents } from "@/server/events/search"

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  const query: EventQueryParams = {
    page: parsePositiveInt(params.get("page"), 1),
    pageSize: Math.min(parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    q: normalizeQuery(params.get("q")),
    day: normalizeDayFilter(params.get("day")),
    location: normalizeLocationFilter(params.get("location")),
  }

  try {
    const result = await getPaginatedEvents(query, "lexical")
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch events"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
