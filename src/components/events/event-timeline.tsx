import type { EventListItem } from "@/lib/events"

import { EventCard } from "./event-card"

const FALLBACK_TIMEZONE = "America/Los_Angeles"

export interface EventTimelineGroup {
  dayKey: string
  items: EventListItem[]
}

function toDayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    return null
  }

  return `${year}-${month}-${day}`
}

export function getTimelineDayKey(event: EventListItem) {
  if (!event.startAt) {
    return "unscheduled"
  }

  try {
    return toDayKey(new Date(event.startAt), event.timezone ?? FALLBACK_TIMEZONE) ?? "unscheduled"
  } catch {
    return "unscheduled"
  }
}

function formatTimelineDay(dayKey: string): { primary: string; secondary?: string } {
  if (dayKey === "unscheduled") {
    return { primary: "Date TBD" }
  }

  const [year, month, day] = dayKey.split("-").map(Number)
  if (!year || !month || !day) {
    return { primary: dayKey }
  }

  const todayKey = toDayKey(new Date(), FALLBACK_TIMEZONE)
  const [tYear, tMonth, tDay] = (todayKey ?? "").split("-").map(Number)
  const todayDate =
    Number.isFinite(tYear) && Number.isFinite(tMonth) && Number.isFinite(tDay)
      ? new Date(Date.UTC(tYear, tMonth - 1, tDay))
      : null
  const targetDate = new Date(Date.UTC(year, month - 1, day))
  const dayDiff = todayDate ? Math.round((targetDate.getTime() - todayDate.getTime()) / 86_400_000) : null

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(targetDate)
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(targetDate)

  if (dayDiff === 0) return { primary: "Today", secondary: weekday }
  if (dayDiff === 1) return { primary: "Tomorrow", secondary: weekday }
  return { primary: weekday, secondary: monthDay }
}

export function EventTimeline({ groups }: { groups: EventTimelineGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/70">
          No events match the current filters.
        </div>
      )}

      {groups.map((group) => {
        const { primary, secondary } = formatTimelineDay(group.dayKey)
        return (
          <section key={group.dayKey} className="space-y-3">
            <div className="pointer-events-none sticky top-14 z-10 -mx-4 px-4 py-1.5 sm:-mx-8 sm:px-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-sm shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{primary}</span>
                {secondary && <span className="text-slate-400">{secondary}</span>}
              </span>
            </div>

            <div className="space-y-3">
              {group.items.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
