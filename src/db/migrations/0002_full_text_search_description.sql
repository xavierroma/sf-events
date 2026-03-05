-- Helper: extract all text-node values from a ProseMirror/Tiptap JSON document
CREATE OR REPLACE FUNCTION extract_prosemirror_text(doc jsonb) RETURNS text AS $$
  SELECT coalesce(
    string_agg(val, ' '),
    ''
  )
  FROM (
    SELECT jsonb_path_query(doc, '$.**.text') #>> '{}' AS val
  ) sq
  WHERE val IS NOT NULL AND trim(val) <> ''
$$ LANGUAGE sql IMMUTABLE;

-- Rebuild search_document to include description, address, and calendar name
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
        coalesce(NEW.raw_payload->'detail'->'event'->'geo_address_info'->>'full_address', '') || ' ' ||
        coalesce(NEW.raw_payload->'detail'->'event'->'geo_address_info'->>'short_address', '') || ' ' ||
        coalesce(NEW.raw_payload->'discover'->'entry'->'calendar'->>'name', '')
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger to also fire when raw_payload changes
DROP TRIGGER IF EXISTS trg_set_events_search_document ON events;
CREATE TRIGGER trg_set_events_search_document
BEFORE INSERT OR UPDATE OF title, city, city_state, hosts, raw_payload
ON events
FOR EACH ROW
EXECUTE FUNCTION set_events_search_document();

-- Backfill all existing rows
UPDATE events SET raw_payload = raw_payload;
