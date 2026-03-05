"use client"

import { useEffect, useState } from "react"
import { CalendarDays, ChevronUp, ChevronDown, Copy, ExternalLink, MapPin, User, X } from "lucide-react"

import type { EventListItem } from "@/lib/events"
import { getLocationLabel, toEventUrl } from "@/lib/events"
import { cn } from "@/lib/utils"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

import { ProseMirrorRenderer } from "./prose-mirror-renderer"
import { useEventPanel } from "./event-panel-context"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // md breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

function hostInitials(host: string) {
  const parts = host
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("")
}

function formatPanelDate(event: EventListItem) {
  if (!event.startAt) return null
  const date = new Date(event.startAt)
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }
  if (event.timezone) opts.timeZone = event.timezone
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(date)
  } catch {
    return null
  }
}

function formatPanelDayBadge(event: EventListItem) {
  if (!event.startAt) return null
  const date = new Date(event.startAt)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  if (event.timezone) opts.timeZone = event.timezone
  try {
    const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(date)
    const month = parts.find((p) => p.type === "month")?.value ?? ""
    const day = parts.find((p) => p.type === "day")?.value ?? ""
    return { month: month.toUpperCase(), day }
  } catch {
    return null
  }
}

function formatPanelTime(event: EventListItem) {
  if (!event.startAt) return "TBD"
  const startDate = new Date(event.startAt)
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
  if (event.timezone) timeOpts.timeZone = event.timezone
  try {
    const startStr = new Intl.DateTimeFormat("en-US", timeOpts).format(startDate)
    if (!event.endAt) return startStr
    const endDate = new Date(event.endAt)
    const endStr = new Intl.DateTimeFormat("en-US", timeOpts).format(endDate)
    return `${startStr} – ${endStr}`
  } catch {
    return startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
}

function getHostLine(hosts: string[]) {
  if (hosts.length === 0) return "Host TBA"
  if (hosts.length === 1) return `Hosted by ${hosts[0]}`
  if (hosts.length === 2) return `Hosted by ${hosts[0]} & ${hosts[1]}`
  return `Hosted by ${hosts[0]}, ${hosts[1]} & ${hosts.length - 2} more`
}

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => { })
  }
}

const AVATAR_COLORS = [
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-amber-500 text-white",
  "bg-sky-600 text-white",
  "bg-rose-600 text-white",
]

function AttendanceRow({ event }: { event: EventListItem }) {
  const count = event.guestCount ?? event.ticketCount ?? 0
  const verb = event.guestCount !== null && event.guestCount > 0 ? "going" : "registered"

  const combined = [
    ...event.guestAvatars.map((url, i) => ({ name: event.guestNames[i] ?? "", avatarUrl: url })),
    ...event.hosts.map((name, i) => ({ name, avatarUrl: event.hostAvatars[i] ?? "" })),
  ].sort((a, b) => (b.avatarUrl ? 1 : 0) - (a.avatarUrl ? 1 : 0))
  const entries = Array.from(new Map(combined.map((e) => [e.avatarUrl || e.name, e])).values())

  const slots = Math.min(5, count)
  const namedEntries = entries.filter((e) => e.name).slice(0, 2)
  const rest = count - namedEntries.length
  const label = namedEntries.length === 0
    ? `${count} ${verb}`
    : rest <= 0
      ? `${namedEntries.map((e) => e.name).join(" & ")} ${verb}`
      : `${namedEntries.map((e) => e.name).join(", ")} and ${rest} others`

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {Array.from({ length: slots }).map((_, i) => {
          const entry = entries[i]
          return entry?.avatarUrl ? (
            <img
              key={i}
              src={entry.avatarUrl}
              alt={entry.name}
              className="h-8 w-8 rounded-full border-2 border-card object-cover"
            />
          ) : (
            <span
              key={i}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-[11px] font-semibold",
                AVATAR_COLORS[i % AVATAR_COLORS.length],
              )}
            >
              {entry?.name ? hostInitials(entry.name) : <User className="h-3.5 w-3.5 opacity-60" />}
            </span>
          )
        })}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

interface PanelContentProps {
  event: EventListItem
  onClose: () => void
}

function PanelContent({ event, onClose }: PanelContentProps) {
  const { goNext, goPrev, hasNext, hasPrev } = useEventPanel()
  const eventUrl = toEventUrl(event.slug)
  const dayBadge = formatPanelDayBadge(event)
  const dateLabel = formatPanelDate(event)
  const timeLabel = formatPanelTime(event)
  const locationLabel = getLocationLabel(event)

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-1 px-2 py-2">
        <button
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}?event=${event.id}`
            copyToClipboard(url)
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Link
        </button>

        {eventUrl && (
          <a
            href={eventUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Event Page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Previous event"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            disabled={!hasNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Next event"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Cover image */}
        {event.coverUrl ? (
          <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
            <img src={event.coverUrl} alt={event.title} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
            No cover image
          </div>
        )}

        <div className="space-y-5 p-5">
          {/* Title + hosts */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold leading-snug text-foreground">{event.title}</h2>
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 -space-x-2">
                {event.hosts.slice(0, 3).map((host, index) => {
                  const avatarUrl = event.hostAvatars[index]
                  return avatarUrl ? (
                    <img
                      key={`${event.id}-${host}-${index}`}
                      src={avatarUrl}
                      alt={host}
                      className="h-6 w-6 rounded-full border-2 border-background object-cover"
                    />
                  ) : (
                    <span
                      key={`${event.id}-${host}-${index}`}
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-medium",
                        index === 0 && "bg-emerald-100 text-emerald-800",
                        index === 1 && "bg-amber-100 text-amber-800",
                        index === 2 && "bg-sky-100 text-sky-800",
                      )}
                    >
                      {hostInitials(host)}
                    </span>
                  )
                })}
              </div>
              <span className="text-sm text-muted-foreground">{getHostLine(event.hosts)}</span>
            </div>
          </div>

          {/* Date & Location */}
          <div className="flex gap-3">
            <div className="flex flex-1 items-start gap-3">
              {dayBadge && (
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-card text-center shadow-sm">
                  <div className="w-full rounded-t-lg bg-rose-500 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    {dayBadge.month}
                  </div>
                  <div className="py-1 text-lg font-bold leading-none text-foreground">{dayBadge.day}</div>
                </div>
              )}
              <div className="min-w-0">
                {dateLabel && <p className="font-medium text-foreground">{dateLabel}</p>}
                <p className="text-sm text-muted-foreground">{timeLabel}</p>
              </div>
            </div>

            {event.locationType !== "online" && locationLabel && (
              <div className="flex flex-1 items-start gap-2">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  {event.shortAddress
                    ? <p className="font-medium text-foreground">{event.shortAddress}</p>
                    : event.locationType === "offline" && (
                      <p className="font-medium text-muted-foreground italic">Register to see address</p>
                    )
                  }
                  <p className="text-sm text-muted-foreground">{locationLabel}</p>
                </div>
              </div>
            )}
            {event.locationType === "online" && (
              <div className="flex flex-1 items-start gap-2">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Online Event</p>
                </div>
              </div>
            )}
          </div>

          {/* Attendance */}
          {((event.guestCount !== null && event.guestCount > 0) || (event.ticketCount !== null && event.ticketCount > 0)) && (
            <AttendanceRow event={event} />
          )}

          {/* About Event */}
          {!!event.descriptionMirror && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About Event</p>
              <ProseMirrorRenderer doc={event.descriptionMirror} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <CalendarDays className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Select an event</p>
        <p className="text-xs text-muted-foreground">Click any event to see its details here</p>
      </div>
    </div>
  )
}

export function EventInlineSidebar() {
  const { selectedEvent, closePanel } = useEventPanel()

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {selectedEvent ? (
        <PanelContent event={selectedEvent} onClose={closePanel} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

export function EventSidePanelMobile() {
  const { selectedEvent, closePanel } = useEventPanel()
  const isMobile = useIsMobile()

  if (!isMobile) {
    return null
  }

  const isOpen = selectedEvent !== null

  return (
    <Drawer open={isOpen} onOpenChange={(open: boolean) => !open && closePanel()}>
      <DrawerContent className="h-full">
        {selectedEvent && <PanelContent event={selectedEvent} onClose={closePanel} />}
      </DrawerContent>
    </Drawer>
  )
}
