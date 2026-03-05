-- Fix search_document paths to match the actual raw_payload structure:
-- Discover entries are stored as {feed, entry, ...} not {discover: {entry, feed}}
-- Merged events (seen in both feeds) use {left: {...}, right: {...}} at the top level
-- Detail (when fetched for new events) is stored as {feed, entry, detail: <detail payload>}
CREATE OR REPLACE FUNCTION set_events_search_document() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_document :=
    to_tsvector(
      'simple',
      trim(
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.city, '') || ' ' ||
        coalesce(NEW.city_state, '') || ' ' ||
        coalesce(array_to_string(NEW.hosts, ' '), '') || ' ' ||
        coalesce(
          extract_prosemirror_text(NEW.raw_payload->'detail'->'description_mirror'),
          ''
        ) || ' ' ||
        coalesce(
          NEW.raw_payload->'detail'->'event'->'geo_address_info'->>'full_address',
          NEW.raw_payload->'entry'->'event'->'geo_address_info'->>'full_address',
          NEW.raw_payload->'left'->'entry'->'event'->'geo_address_info'->>'full_address',
          ''
        ) || ' ' ||
        coalesce(
          NEW.raw_payload->'detail'->'event'->'geo_address_info'->>'short_address',
          NEW.raw_payload->'entry'->'event'->'geo_address_info'->>'short_address',
          NEW.raw_payload->'left'->'entry'->'event'->'geo_address_info'->>'short_address',
          ''
        ) || ' ' ||
        coalesce(
          NEW.raw_payload->'entry'->'calendar'->>'name',
          NEW.raw_payload->'left'->'entry'->'calendar'->>'name',
          ''
        )
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill all existing rows with corrected paths
UPDATE events SET raw_payload = raw_payload;
