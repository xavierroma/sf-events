"use client"

import dynamic from "next/dynamic"

import type { EventListItem } from "@/lib/events"

interface EventMapProps {
  events: EventListItem[]
  selectedEventId?: string | null
  onSelectEvent?: (eventId: string) => void
  className?: string
}

const EventMapInner = dynamic(() => import("@/components/events/event-map-inner").then((mod) => mod.EventMapInner), {
  ssr: false,
  loading: () => <div className="h-[430px] rounded-lg border bg-muted/40" />,
})

export function EventMap(props: EventMapProps) {
  return <EventMapInner {...props} />
}
