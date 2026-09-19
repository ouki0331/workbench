CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  language_tag TEXT NOT NULL DEFAULT 'en',
  body_text TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  source_external_id TEXT,
  lifecycle_state TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'archived', 'trashed')),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  personal_note TEXT,
  duplicate_of_resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  trashed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX resources_kind_state_idx ON resources(kind, lifecycle_state);
CREATE INDEX resources_updated_at_idx ON resources(updated_at DESC);
CREATE UNIQUE INDEX resources_source_url_unique_idx
  ON resources(source_url)
  WHERE source_url IS NOT NULL AND lifecycle_state <> 'trashed';

CREATE TABLE resource_files (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary',
  relative_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0),
  checksum_sha256 TEXT,
  duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(resource_id, relative_path)
);

CREATE INDEX resource_files_resource_idx ON resource_files(resource_id);
CREATE INDEX resource_files_checksum_idx ON resource_files(checksum_sha256);

CREATE TABLE resource_relations (
  from_resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  to_resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (from_resource_id, to_resource_id, relation_type),
  CHECK (from_resource_id <> to_resource_id)
);

CREATE INDEX resource_relations_to_idx ON resource_relations(to_resource_id, relation_type);

CREATE TABLE tag_groups (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  selection_mode TEXT NOT NULL DEFAULT 'multi'
    CHECK (selection_mode IN ('single', 'multi')),
  color_token TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 1 CHECK (is_system IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  parent_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  external_scheme TEXT,
  external_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(group_id, key)
);

CREATE INDEX tags_group_parent_idx ON tags(group_id, parent_id, sort_order);
CREATE INDEX tags_external_reference_idx
  ON tags(external_scheme, external_id)
  WHERE external_scheme IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE resource_tags (
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  assignment_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_source IN ('manual', 'imported', 'system')),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX resource_tags_tag_idx ON resource_tags(tag_id, resource_id);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('world', 'region', 'subregion', 'country', 'area')),
  code_scheme TEXT NOT NULL,
  code TEXT NOT NULL,
  parent_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE(code_scheme, code)
);

CREATE INDEX places_parent_idx ON places(parent_id, kind);

CREATE TABLE resource_places (
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'coverage'
    CHECK (relation_type IN ('coverage', 'origin')),
  assignment_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_source IN ('manual', 'imported', 'system')),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (resource_id, place_id, relation_type)
);

CREATE INDEX resource_places_place_idx ON resource_places(place_id, relation_type);

CREATE VIRTUAL TABLE resource_search USING fts5(
  resource_id UNINDEXED,
  title,
  summary,
  body_text,
  personal_note,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER resources_search_insert AFTER INSERT ON resources BEGIN
  INSERT INTO resource_search(resource_id, title, summary, body_text, personal_note)
  VALUES (new.id, new.title, new.summary, new.body_text, new.personal_note);
END;

CREATE TRIGGER resources_search_update AFTER UPDATE OF title, summary, body_text, personal_note ON resources BEGIN
  DELETE FROM resource_search WHERE resource_id = old.id;
  INSERT INTO resource_search(resource_id, title, summary, body_text, personal_note)
  VALUES (new.id, new.title, new.summary, new.body_text, new.personal_note);
END;

CREATE TRIGGER resources_search_delete AFTER DELETE ON resources BEGIN
  DELETE FROM resource_search WHERE resource_id = old.id;
END;
