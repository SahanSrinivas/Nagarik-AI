-- Bootstrap extensions on first DB launch.
-- PostGIS for geospatial queries (issue locations, nearest-neighbor search).
-- pgvector for embedding-based dedup (CLIP/text embeddings).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
