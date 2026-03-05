# Luma Event Explorer (Next.js)

Productionized explorer for SF events with a shared server cache.

## Stack

- Next.js App Router (server components + client interactivity)
- Postgres shared cache
- Workflow DevKit (`workflow`) for async cache refresh
- OpenStreetMap + Leaflet for map tab

## URL State

- `tab=list|map`
- `page=<positive int>`
- `q=<search text>`

## Data Flow

- UI reads from Postgres only.
- No public `/api/events` endpoint.
- Scheduled workflow fetches all pages from:
  - geo feed (`latitude`, `longitude`)
  - place feed (`discover_place_api_id`)
- Results are deduped by `event.api_id` and upserted into cache tables.
- Newly discovered events trigger an extra detail fetch (`/event/get?event_api_id=...`) with exponential backoff on `403/429` and paced requests to reduce rate limiting.

## Setup

1. Install deps:

```bash
bun install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Run DB migrations:

```bash
bun run db:migrate
```

4. Start dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow Triggering

### Cron endpoint

`GET /api/cron/refresh-events`

Requires:

`Authorization: Bearer <CRON_SECRET>`

Optional query param:

- `reason=bootstrap` (otherwise defaults to `cron`)

### One-off bootstrap refresh

```bash
bun run bootstrap:refresh
```

This calls the cron route to enqueue an initial refresh run.

## Vercel Schedule (Hobby)

`vercel.json` includes a daily cron:

- `0 0 * * *` -> `/api/cron/refresh-events`

## Validation

```bash
bun run lint
bun run build
```
