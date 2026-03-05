import type { Metadata } from "next"

import { ExplorerClient } from "@/components/events/explorer-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatEventDateTime, getLocationLabel, normalizeDayFilter, normalizeLocationFilter, normalizeQuery, type EventQueryParams } from "@/lib/events"
import { getEventById, getEventFacets, getPaginatedEvents } from "@/server/events/search"

const LIST_PAGE_SIZE = 24

export const dynamic = "force-dynamic"

const DEFAULT_TITLE = "SF Bay Area Events — All hidden events in a List"
const DEFAULT_DESCRIPTION =
  "Discover every Bay Area event on Luma without the map. Search and filter hundreds of hidden events, all in one place."

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const params = await searchParams
  const eventId = readFirst(params.event)

  if (eventId) {
    try {
      const event = await getEventById(eventId)

      if (event) {
        const title = `${event.title} — SF Bay Area Events`
        const parts: string[] = []
        if (event.hosts.length > 0) {
          parts.push(`By ${event.hosts.slice(0, 3).join(", ")}`)
        }
        const location = getLocationLabel(event)
        if (location) parts.push(location)
        const date = formatEventDateTime(event)
        if (date) parts.push(date)
        const description = parts.join(" · ")

        const images = event.coverUrl
          ? [{ url: event.coverUrl, width: 1280, height: 640, alt: event.title }]
          : [{ url: "/sf.png", width: 1280, height: 640, alt: "SF Bay Area Events" }]

        return {
          title,
          description,
          openGraph: {
            type: "website",
            title,
            description,
            images,
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: images.map((img) => img.url),
          },
        }
      }
    } catch {
      // fall through to default metadata
    }
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  }
}

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
