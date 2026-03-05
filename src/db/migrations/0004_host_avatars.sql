ALTER TABLE events ADD COLUMN IF NOT EXISTS host_avatars TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE events
SET host_avatars = ARRAY(
  SELECT COALESCE(elem->>'avatar_url', '')
  FROM jsonb_array_elements(
    raw_payload->'discover'->'entry'->'hosts'
  ) AS elem
)
WHERE raw_payload->'discover'->'entry'->'hosts' IS NOT NULL
  AND jsonb_typeof(raw_payload->'discover'->'entry'->'hosts') = 'array';
