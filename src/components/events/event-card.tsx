"use client"

import { MapPin } from "lucide-react"

import type { EventListItem } from "@/lib/events"
import { getLocationLabel } from "@/lib/events"
import { cn } from "@/lib/utils"

import { useEventPanel } from "./event-panel-context"

function hostInitials(host: string) {
  const parts = host
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "?"
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function formatTimelineTime(event: EventListItem) {
  if (!event.startAt) {
    return "TBD"
  }

  const date = new Date(event.startAt)
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  }

  if (event.timezone) {
    options.timeZone = event.timezone
  }

  try {
    return new Intl.DateTimeFormat("en-US", options).format(date)
  } catch {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
}

function getHostLine(hosts: string[]) {
  if (hosts.length === 0) {
    return "Host TBA"
  }

  if (hosts.length === 1) {
    return `By ${hosts[0]}`
  }

  if (hosts.length === 2) {
    return `By ${hosts[0]} & ${hosts[1]}`
  }

  return `By ${hosts.join(", ")}`
}

export function EventCard({ event }: { event: EventListItem }) {
  const { openPanel, selectedEvent } = useEventPanel()
  const isSelected = selectedEvent?.id === event.id
  const cardContent = (
    <article className={cn(
      "grid grid-cols-[1fr_auto] gap-4 rounded-[26px] border p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors",
      isSelected
        ? "border-slate-900 bg-white ring-1 ring-slate-900"
        : "border-slate-200/90 bg-white/85 hover:border-slate-300 hover:bg-white",
    )}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{formatTimelineTime(event)}</span>
        </div>

        <h3 className="text-xl font-bold leading-snug text-slate-900">{event.title}</h3>

        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <div className="flex shrink-0 -space-x-2">
            {event.hosts.slice(0, 3).map((host, index) => (
              <span
                key={`${event.id}-${host}-${index}`}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border border-white text-[10px] font-medium",
                  index === 0 && "bg-emerald-100 text-emerald-800",
                  index === 1 && "bg-amber-100 text-amber-800",
                  index === 2 && "bg-sky-100 text-sky-800",
                )}
              >
                {hostInitials(host)}
              </span>
            ))}
          </div>
          <p className="truncate">{getHostLine(event.hosts)}</p>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{getLocationLabel(event)}</span>
        </p>
      </div>

      <div className="h-[130px] w-[130px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {event.coverUrl ? (
          <img src={event.coverUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">No image</div>
        )}
      </div>
    </article>
  )

  return (
    <button
      id={`event-${event.id}`}
      type="button"
      onClick={() => openPanel(event)}
      className="block w-full cursor-pointer text-left focus-visible:outline-none"
    >
      {cardContent}
    </button>
  )
}
