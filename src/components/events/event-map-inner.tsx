"use client"

import { useEffect, useMemo } from "react"
import { LatLngBounds } from "leaflet"
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"

import type { EventListItem } from "@/lib/events"
import { toEventUrl } from "@/lib/events"
import { cn } from "@/lib/utils"

interface EventMapInnerProps {
  events: EventListItem[]
  selectedEventId?: string | null
  onSelectEvent?: (eventId: string) => void
  className?: string
}

function hasCoordinates(event: EventListItem): event is EventListItem & { latitude: number; longitude: number } {
  return event.latitude !== null && event.longitude !== null
}

function FitToEventBounds({ events }: { events: (EventListItem & { latitude: number; longitude: number })[] }) {
  const map = useMap()

  useEffect(() => {
    if (events.length === 0) {
      return
    }

    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 13, { animate: false })
      return
    }

    const bounds = new LatLngBounds(events.map((event) => [event.latitude, event.longitude]))
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false })
  }, [events, map])

  return null
}

export function EventMapInner({ events, selectedEventId, onSelectEvent, className }: EventMapInnerProps) {
  const mappableEvents = useMemo(() => events.filter(hasCoordinates), [events])

  const defaultCenter: [number, number] =
    mappableEvents.length > 0 ? [mappableEvents[0].latitude, mappableEvents[0].longitude] : [37.7749, -122.4194]

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-lg border bg-background/70">
        <MapContainer
          center={defaultCenter}
          zoom={11}
          scrollWheelZoom
          className="h-[430px] w-full"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <FitToEventBounds events={mappableEvents} />

          {mappableEvents.map((event, index) => {
            const url = toEventUrl(event.slug)
            const isSelected = selectedEventId === event.id
            return (
              <CircleMarker
                key={event.id}
                center={[event.latitude, event.longitude]}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  color: isSelected ? "#0f172a" : index % 2 === 0 ? "#d9480f" : "#0f766e",
                  fillColor: isSelected ? "#facc15" : index % 2 === 0 ? "#f97316" : "#14b8a6",
                  fillOpacity: isSelected ? 0.95 : 0.85,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectEvent?.(event.id),
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold leading-tight">{event.title}</p>
                    <p className="text-xs text-slate-600">{event.cityState ?? event.city ?? "Unknown location"}</p>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-600 underline underline-offset-2"
                      >
                        Open event page
                      </a>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Plotted {mappableEvents.length} of {events.length} events (events without coordinates cannot be mapped).
      </p>
    </div>
  )
}
