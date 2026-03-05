# SF Bay Area Events

Browse and search all Bay Area events from Luma in one place. No more scrolling the map — Luma hides events behind a mobile-only map view; this app reverse engineers their API and surfaces everything in a searchable, filterable list.

## Features

- Full-text search across event names and descriptions
- Filter by day and location
- Live event indicator (pulsing dot) for events happening right now
- Paginated list, server-rendered for fast loads
- Daily background refresh from Luma's geo + place feeds

## Stack

- **Next.js 16** — App Router, server components
- **Postgres** — shared event cache
- **Tailwind CSS + shadcn/ui** — UI
- **Bun** — runtime and package manager

## URL State

| Param      | Description                                    |
| ---------- | ---------------------------------------------- |
| `q`        | Search query                                   |
| `day`      | Filter by date (`YYYY-MM-DD` or `unscheduled`) |
| `location` | Filter by city/neighborhood                    |
| `page`     | Pagination (default: `1`)                      |

## Data Flow

- The UI reads exclusively from Postgres — no direct Luma API calls at request time.
- A daily cron job fetches all pages from two Luma feeds:
  - **Geo feed** — events near `LUMA_LATITUDE` / `LUMA_LONGITUDE`
  - **Place feed** — events under `LUMA_DISCOVER_PLACE_ID`
- Results are deduped by `event.api_id` and upserted into the cache.
- Newly discovered events trigger a follow-up detail fetch (`/event/get?event_api_id=...`) with paced requests and backoff on `403/429`.

## Setup

1. Install deps:

```bash
bun install
```

2. Configure env:

```bash
cp .env.example .env.local
```

Edit `.env.local` — at minimum set `DATABASE_URL` and `CRON_SECRET`. Set `NEXT_PUBLIC_APP_URL` to your production URL for correct OG metadata.

3. Start Postgres (Docker):

```bash
docker compose up -d
```

4. Run DB migrations:

```bash
bun run db:migrate
```

5. Start dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seeding Data

To do an initial pull from Luma:

```bash
bun run bootstrap:refresh
```

This calls the cron route locally to populate the database for the first time.

## Cron Endpoint

```
GET /api/cron/refresh-events
Authorization: Bearer <CRON_SECRET>
```

Optional query param: `reason=bootstrap` (defaults to `cron`).

`vercel.json` schedules this daily at `0 0 * * *`.

## Validation

```bash
bun run lint
bun run build
```
