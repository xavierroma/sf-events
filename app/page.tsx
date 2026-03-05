import { ExplorerClient } from "@/components/events/explorer-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { normalizeDayFilter, normalizeLocationFilter, normalizeQuery, type EventQueryParams } from "@/lib/events"
import { getEventFacets, getPaginatedEvents } from "@/server/events/search"

const LIST_PAGE_SIZE = 24

export const dynamic = "force-dynamic"

type SearchParamsValue = string | string[] | undefined

interface HomePageProps {
  searchParams: Promise<Record<string, SearchParamsValue>>
}

function readFirst(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: SearchParamsValue) {
  const parsed = Number.parseInt(readFirst(value) ?? "1", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }

  return parsed
}

function parseQuery(value: SearchParamsValue) {
  return normalizeQuery(readFirst(value))
}

function parseDay(value: SearchParamsValue) {
  return normalizeDayFilter(readFirst(value))
}

function parseLocation(value: SearchParamsValue) {
  return normalizeLocationFilter(readFirst(value))
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams

  const query: EventQueryParams = {
    page: parsePage(params.page),
    pageSize: LIST_PAGE_SIZE,
    q: parseQuery(params.q),
    day: parseDay(params.day),
    location: parseLocation(params.location),
  }

  try {
    const [listResult, facets] = await Promise.all([
      getPaginatedEvents(query, "lexical"),
      getEventFacets({ q: query.q }),
    ])

    return <ExplorerClient initialResult={listResult} facets={facets} query={query} />
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error"

    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10">
        <Card className="w-full border-rose-500/40 bg-rose-50/80">
          <CardHeader>
            <Badge className="w-fit bg-rose-700 text-rose-50">Data source unavailable</Badge>
            <CardTitle>Unable to load events</CardTitle>
            <CardDescription>
              Try again later.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-rose-900">{message}</CardContent>
        </Card>
      </main>
    )
  }
}
