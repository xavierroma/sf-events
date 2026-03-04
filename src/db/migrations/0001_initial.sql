CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cover_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  timezone TEXT,
  slug TEXT,
  location_type TEXT,
  city TEXT,
  city_state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  hosts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  guest_count INTEGER,
  ticket_count INTEGER,
  source_geo BOOLEAN NOT NULL DEFAULT FALSE,
  source_place BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_document TSVECTOR NOT NULL DEFAULT ''::TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at);
CREATE INDEX IF NOT EXISTS events_city_state_idx ON events (city_state);
CREATE INDEX IF NOT EXISTS events_is_active_idx ON events (is_active);
CREATE INDEX IF NOT EXISTS events_coordinates_idx ON events (latitude, longitude);
CREATE INDEX IF NOT EXISTS events_search_document_idx ON events USING GIN (search_document);

CREATE OR REPLACE FUNCTION set_events_search_document() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_document :=
    to_tsvector(
      'simple',
      trim(
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.city, '') || ' ' ||
        coalesce(NEW.city_state, '') || ' ' ||
        coalesce(array_to_string(NEW.hosts, ' '), '')
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_events_search_document ON events;
CREATE TRIGGER trg_set_events_search_document
BEFORE INSERT OR UPDATE OF title, city, city_state, hosts
ON events
FOR EACH ROW
EXECUTE FUNCTION set_events_search_document();

CREATE TABLE IF NOT EXISTS cache_runs (
  id TEXT PRIMARY KEY,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('cron', 'bootstrap')),
  status TEXT NOT NULL CHECK (status IN ('running', 'failed', 'succeeded', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  geo_pages INTEGER NOT NULL DEFAULT 0,
  place_pages INTEGER NOT NULL DEFAULT 0,
  total_unique_events INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cache_state (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id = TRUE),
  last_successful_at TIMESTAMPTZ,
  last_run_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_run_status IN ('idle', 'running', 'failed', 'succeeded')),
  active_events_count INTEGER NOT NULL DEFAULT 0,
  last_run_id TEXT REFERENCES cache_runs(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cache_state (singleton_id, last_run_status, active_events_count)
VALUES (TRUE, 'idle', 0)
ON CONFLICT (singleton_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS event_embeddings (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  embedding JSONB,
  model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
