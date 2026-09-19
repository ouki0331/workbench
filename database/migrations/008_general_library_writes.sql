ALTER TABLE resource_writes ADD COLUMN storage_kind TEXT NOT NULL DEFAULT 'articles';
ALTER TABLE resource_writes ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
CREATE TABLE resource_tombstones (
  resource_id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL
);
