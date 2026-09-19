-- Sources describe provenance, not resource identity.
DROP INDEX resources_source_url_unique_idx;
UPDATE resources SET source_url = NULL WHERE trim(source_url) = '';
CREATE INDEX resources_source_url_idx ON resources(source_url) WHERE source_url IS NOT NULL;

-- A durable intent precedes file creation. Only committed resources enter the catalog.
CREATE TABLE resource_writes (
  operation_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'committed'))
);
