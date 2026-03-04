import { ExplorerClient } from "@/components/events/explorer-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventQueryParams } from "@/lib/events"
import { getMapEvents, getPaginatedEvents, readCacheStatus } from "@/server/events/search"

const LIST_PAGE_SIZE = 40

export const dynamic = "force-dynamic"

type SearchParamsValue = string | string[] | undefined

interface HomePageProps {
  searchParams: Promise<Record<string, SearchParamsValue>>
}

function readFirst(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value
}

function parseTab(value: SearchParamsValue): EventQueryParams["tab"] {
  const tab = readFirst(value)
  return tab === "map" ? "map" : "list"
}

function parsePage(value: SearchParamsValue) {
  const parsed = Number.parseInt(readFirst(value) ?? "1", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }

  return parsed
}

function parseQuery(value: SearchParamsValue) {
  const query = (readFirst(value) ?? "").trim()
  return query.slice(0, 200)
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams

  const query: EventQueryParams = {
    tab: parseTab(params.tab),
    page: parsePage(params.page),
    pageSize: LIST_PAGE_SIZE,
    q: parseQuery(params.q),
  }

  try {
    const [listResult, mapEvents, cacheStatus] = await Promise.all([
      getPaginatedEvents(query, "lexical"),
      getMapEvents({ q: query.q, mode: "lexical", limit: 2000 }),
      readCacheStatus(),
    ])

    return <ExplorerClient listResult={listResult} mapEvents={mapEvents} cacheStatus={cacheStatus} query={query} />
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error"

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full border-rose-500/40 bg-rose-50/80">
          <CardHeader>
            <Badge className="w-fit bg-rose-700 text-rose-50">Data source unavailable</Badge>
            <CardTitle>Unable to load cached events</CardTitle>
            <CardDescription>
              Verify `DATABASE_URL`, run migrations, and enqueue the refresh workflow at least once.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-rose-900">{message}</CardContent>
        </Card>
      </main>
    )
  }
}
