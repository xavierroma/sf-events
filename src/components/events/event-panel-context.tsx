"use client"

import { createContext, useCallback, useContext, useState } from "react"
import type { ReactNode } from "react"

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
  const [selectedEvent, setSelectedEvent] = useState<EventListItem | null>(null)

  const openPanel = useCallback((event: EventListItem) => {
    setSelectedEvent(event)
  }, [])

  const closePanel = useCallback(() => {
    setSelectedEvent(null)
  }, [])

  const currentIndex = selectedEvent ? allEvents.findIndex((e) => e.id === selectedEvent.id) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allEvents.length - 1

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setSelectedEvent(allEvents[currentIndex - 1] ?? null)
  }, [allEvents, currentIndex])

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < allEvents.length - 1)
      setSelectedEvent(allEvents[currentIndex + 1] ?? null)
  }, [allEvents, currentIndex])

  return (
    <EventPanelContext.Provider value={{ selectedEvent, allEvents, openPanel, closePanel, goNext, goPrev, hasNext, hasPrev }}>
      {children}
    </EventPanelContext.Provider>
  )
}
