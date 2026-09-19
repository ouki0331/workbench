CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ja',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO users (id, display_name, locale)
VALUES ('user-local-default', 'Local user', 'ja');

ALTER TABLE resources ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE resources ADD COLUMN remark_markdown TEXT;
ALTER TABLE resources ADD COLUMN remark_updated_at TEXT;
ALTER TABLE resources ADD COLUMN title_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE resources ADD COLUMN metadata_extracted_at TEXT;
ALTER TABLE resources ADD COLUMN metadata_extract_status TEXT NOT NULL DEFAULT 'not_run'
  CHECK (metadata_extract_status IN ('not_run', 'success', 'partial', 'failed'));
ALTER TABLE resources ADD COLUMN metadata_extract_error TEXT;

UPDATE resources
SET owner_user_id = 'user-local-default'
WHERE owner_user_id IS NULL;

CREATE INDEX resources_owner_state_idx
  ON resources(owner_user_id, lifecycle_state, updated_at DESC);

ALTER TABLE resource_files ADD COLUMN duration_source TEXT;
ALTER TABLE resource_files ADD COLUMN duration_updated_at TEXT;
ALTER TABLE resource_files ADD COLUMN extracted_metadata_json TEXT;
ALTER TABLE resource_files ADD COLUMN metadata_extracted_at TEXT;

CREATE TABLE resource_notes (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX resource_notes_resource_idx
  ON resource_notes(resource_id, updated_at DESC);
CREATE INDEX resource_notes_user_idx
  ON resource_notes(user_id, updated_at DESC);

CREATE VIRTUAL TABLE resource_note_search USING fts5(
  note_id UNINDEXED,
  resource_id UNINDEXED,
  title,
  body_markdown,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER resource_notes_search_insert AFTER INSERT ON resource_notes BEGIN
  INSERT INTO resource_note_search(note_id, resource_id, title, body_markdown)
  VALUES (new.id, new.resource_id, new.title, new.body_markdown);
END;

CREATE TRIGGER resource_notes_search_update AFTER UPDATE OF title, body_markdown ON resource_notes BEGIN
  DELETE FROM resource_note_search WHERE note_id = old.id;
  INSERT INTO resource_note_search(note_id, resource_id, title, body_markdown)
  VALUES (new.id, new.resource_id, new.title, new.body_markdown);
END;

CREATE TRIGGER resource_notes_search_delete AFTER DELETE ON resource_notes BEGIN
  DELETE FROM resource_note_search WHERE note_id = old.id;
END;

CREATE TABLE learning_modules (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'planned')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'planned')),
  UNIQUE(module_id, key)
);

CREATE TABLE resource_subjects (
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (relation_type IN ('primary', 'supporting', 'reference')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (resource_id, subject_id)
);

CREATE INDEX resource_subjects_subject_idx
  ON resource_subjects(subject_id, resource_id);

INSERT OR IGNORE INTO learning_modules
  (id, key, name_en, name_ja, name_zh_cn, name_zh_tw, status)
VALUES
  ('module-ielts', 'ielts', 'IELTS', 'IELTS', '雅思', '雅思', 'active');

INSERT OR IGNORE INTO subjects
  (id, module_id, key, name_en, name_ja, name_zh_cn, name_zh_tw, sort_order)
VALUES
  ('subject-ielts-listening', 'module-ielts', 'listening', 'Listening', 'リスニング', '听力', '聽力', 10),
  ('subject-ielts-reading', 'module-ielts', 'reading', 'Reading', 'リーディング', '阅读', '閱讀', 20),
  ('subject-ielts-writing', 'module-ielts', 'writing', 'Writing', 'ライティング', '写作', '寫作', 30),
  ('subject-ielts-speaking', 'module-ielts', 'speaking', 'Speaking', 'スピーキング', '口语', '口語', 40),
  ('subject-ielts-vocabulary', 'module-ielts', 'vocabulary', 'Vocabulary', '語彙', '词汇', '詞彙', 50),
  ('subject-ielts-grammar', 'module-ielts', 'grammar', 'Grammar', '文法', '语法', '語法', 60);

CREATE TABLE resource_view_sessions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  closed_at TEXT,
  dwell_seconds INTEGER NOT NULL DEFAULT 0 CHECK (dwell_seconds >= 0),
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  device_class TEXT CHECK (device_class IS NULL OR device_class IN ('desktop', 'tablet', 'mobile', 'unknown')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX resource_view_sessions_resource_idx
  ON resource_view_sessions(resource_id, opened_at DESC);
CREATE INDEX resource_view_sessions_user_idx
  ON resource_view_sessions(user_id, opened_at DESC);

ALTER TABLE tags ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
