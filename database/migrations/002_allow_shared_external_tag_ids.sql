DROP INDEX IF EXISTS tags_external_reference_idx;

CREATE INDEX tags_external_reference_idx
  ON tags(external_scheme, external_id)
  WHERE external_scheme IS NOT NULL AND external_id IS NOT NULL;
