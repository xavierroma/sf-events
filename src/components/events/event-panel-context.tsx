"use client"

import { createContext, useCallback, useContext } from "react"
import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { EventListItem } from "@/lib/events"

interface EventPanelContextValue {
  selectedEvent: EventListItem | null
  allEvents: EventListItem[]
  openPanel: (event: EventListItem) => void
  closePanel: () => void
  goNext: () => void
  goPrev: () => void
  hasNext: boolean
  hasPrev: boolean
}

const EventPanelContext = createContext<EventPanelContextValue | null>(null)

export function useEventPanel() {
  const ctx = useContext(EventPanelContext)
  if (!ctx) throw new Error("useEventPanel must be used within EventPanelProvider")
  return ctx
}

interface EventPanelProviderProps {
  allEvents: EventListItem[]
  children: ReactNode
}

export function EventPanelProvider({ allEvents, children }: EventPanelProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const eventId = searchParams.get("event")
  const selectedEvent = eventId ? (allEvents.find((e) => e.id === eventId) ?? null) : null

  const openPanel = useCallback((event: EventListItem) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("event", event.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const closePanel = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("event")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const currentIndex = selectedEvent ? allEvents.findIndex((e) => e.id === selectedEvent.id) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allEvents.length - 1

  const goPrev = useCallback(() => {
    const prev = allEvents[currentIndex - 1]
    if (currentIndex > 0 && prev) openPanel(prev)
  }, [allEvents, currentIndex, openPanel])

  const goNext = useCallback(() => {
    const next = allEvents[currentIndex + 1]
    if (currentIndex >= 0 && currentIndex < allEvents.length - 1 && next) openPanel(next)
  }, [allEvents, currentIndex, openPanel])

  return (
    <EventPanelContext.Provider value={{ selectedEvent, allEvents, openPanel, closePanel, goNext, goPrev, hasNext, hasPrev }}>
      {children}
    </EventPanelContext.Provider>
  )
}
