"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Plus, Rss, Search, SlidersHorizontal, Ticket, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EventQueryParams } from "@/lib/events"

const ALL = "_all_"

function formatDayOption(dayKey: string) {
  if (dayKey === "unscheduled") {
    return "Date TBD"
  }

  const [year, month, day] = dayKey.split("-").map(Number)
  if (!year || !month || !day) {
    return dayKey
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function buildHref(q: string, day: string, location: string) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (day) params.set("day", day)
  if (location) params.set("location", location)
  const qs = params.toString()
  return qs ? `?${qs}` : "?"
}

interface FilterBarProps {
  query: EventQueryParams
  dayOptions: string[]
  locationOptions: string[]
}

export function FilterBar({ query, dayOptions, locationOptions }: FilterBarProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState(query.q ?? "")
  const [day, setDay] = useState(query.day ?? "")
  const [location, setLocation] = useState(query.location ?? "")
  const [filterOpen, setFilterOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSearchValue(query.q ?? "") }, [query.q])
  useEffect(() => { setDay(query.day ?? "") }, [query.day])
  useEffect(() => { setLocation(query.location ?? "") }, [query.location])

  useEffect(() => {
    if (!filterOpen) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element
      if (filterRef.current && !filterRef.current.contains(target)) {
        if (!target.closest("[data-radix-popper-content-wrapper]")) {
          setFilterOpen(false)
        }
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [filterOpen])

  function navigate(q: string, d: string, loc: string) {
    router.push(buildHref(q, d, loc))
  }

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(value, day, location), 400)
  }

  function handleDayChange(value: string) {
    const resolved = value === ALL ? "" : value
    setDay(resolved)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    navigate(searchValue, resolved, location)
  }

  function handleLocationChange(value: string) {
    const resolved = value === ALL ? "" : value
    setLocation(resolved)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    navigate(searchValue, day, resolved)
  }

  function resetFilters() {
    setDay("")
    setLocation("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    navigate(searchValue, "", "")
  }

  const hasActiveFilters = !!day || !!location

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-[#f2f2f2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <h1 className="flex-1 text-xl font-bold tracking-tight text-slate-900">Events</h1>

        {/* Search input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search…"
            className="h-9 w-44 rounded-lg border-slate-200 bg-white pl-8 text-sm"
          />
        </div>

        {/* Filter dropdown */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${hasActiveFilters
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">Day</p>
                  <Select value={day || ALL} onValueChange={handleDayChange}>
                    <SelectTrigger className="h-8 w-full rounded-lg border-slate-200 text-xs">
                      <SelectValue placeholder="All days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All days</SelectItem>
                      {dayOptions.map((d) => (
                        <SelectItem key={d} value={d}>{formatDayOption(d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">Location</p>
                  <Select value={location || ALL} onValueChange={handleLocationChange}>
                    <SelectTrigger className="h-8 w-full rounded-lg border-slate-200 text-xs">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All locations</SelectItem>
                      {locationOptions.map((loc) => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
