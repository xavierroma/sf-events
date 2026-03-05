function readStringEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

function readOptionalStringEnv(name: string) {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return parsed
}

function readPositiveIntEnv(name: string, fallback: number) {
  const parsed = Math.trunc(readNumberEnv(name, fallback))
  return parsed > 0 ? parsed : fallback
}

export const appConfig = {
  databaseUrl: readOptionalStringEnv("DATABASE_URL"),
  cronSecret: readOptionalStringEnv("CRON_SECRET"),
  luma: {
    apiBase: readStringEnv("LUMA_API_BASE", "https://api2.luma.com"),
    discoverPlaceApiId: readStringEnv("LUMA_DISCOVER_PLACE_ID", "discplace-BDj7GNbGlsF7Cka"),
    latitude: readNumberEnv("LUMA_LATITUDE", 37.7749),
    longitude: readNumberEnv("LUMA_LONGITUDE", -122.4194),
    paginationLimit: readPositiveIntEnv("LUMA_PAGINATION_LIMIT", 100),
    pageDelayMs: readPositiveIntEnv("LUMA_PAGE_DELAY_MS", 2500),
    detailDelayMs: readPositiveIntEnv("LUMA_DETAIL_DELAY_MS", 1750),
    maxPagesPerFeed: readPositiveIntEnv("LUMA_MAX_PAGES_PER_FEED", 500),
  },
}
