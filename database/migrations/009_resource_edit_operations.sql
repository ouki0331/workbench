ALTER TABLE resources ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE resource_edits (
  operation_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  old_path TEXT,
  new_path TEXT,
  state TEXT NOT NULL CHECK(state IN ('pending','committed'))
);
