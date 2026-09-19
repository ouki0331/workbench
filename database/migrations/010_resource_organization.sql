ALTER TABLE tags ADD COLUMN custom_color_token TEXT
  CHECK (custom_color_token IS NULL OR custom_color_token IN ('sakura', 'navy', 'olive', 'charcoal'));

ALTER TABLE places ADD COLUMN m49_code TEXT;
ALTER TABLE places ADD COLUMN iso_alpha2 TEXT;
ALTER TABLE places ADD COLUMN iso_alpha3 TEXT;
ALTER TABLE places ADD COLUMN data_source TEXT;
ALTER TABLE places ADD COLUMN data_version TEXT;

CREATE UNIQUE INDEX places_m49_code_idx
  ON places(m49_code) WHERE m49_code IS NOT NULL;
CREATE UNIQUE INDEX places_iso_alpha2_idx
  ON places(iso_alpha2) WHERE iso_alpha2 IS NOT NULL;
CREATE UNIQUE INDEX places_iso_alpha3_idx
  ON places(iso_alpha3) WHERE iso_alpha3 IS NOT NULL;

CREATE TABLE place_datasets (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  license TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE resource_tag_suggestions (
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  evidence TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  generated_at TEXT NOT NULL,
  accepted_at TEXT,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX resource_tag_suggestions_resource_idx
  ON resource_tag_suggestions(resource_id, generated_at DESC);
