-- Bootstrap extensions on first DB launch.
-- PostGIS for geospatial queries (issue locations, nearest-neighbor search).
-- pg_trgm for fuzzy text search on ward names.
-- pgvector (CLIP embedding similarity) is OPTIONAL — only created if the
-- extension is installed in the image. Use imresamu/postgis-pgvector if you
-- want both; the geo-only DedupAgent fallback works without it.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available — falling back to geo-only dedup';
END$$;
