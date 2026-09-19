DROP TRIGGER IF EXISTS resources_search_insert;
DROP TRIGGER IF EXISTS resources_search_update;
DROP TRIGGER IF EXISTS resources_search_delete;
DROP TABLE IF EXISTS resource_search;

ALTER TABLE resources DROP COLUMN personal_note;

CREATE VIRTUAL TABLE resource_search USING fts5(
  resource_id UNINDEXED,
  title,
  summary,
  body_text,
  remark_markdown,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO resource_search(resource_id, title, summary, body_text, remark_markdown)
SELECT id, title, summary, body_text, remark_markdown
FROM resources;

CREATE TRIGGER resources_search_insert AFTER INSERT ON resources BEGIN
  INSERT INTO resource_search(resource_id, title, summary, body_text, remark_markdown)
  VALUES (new.id, new.title, new.summary, new.body_text, new.remark_markdown);
END;

CREATE TRIGGER resources_search_update
AFTER UPDATE OF title, summary, body_text, remark_markdown ON resources BEGIN
  DELETE FROM resource_search WHERE resource_id = old.id;
  INSERT INTO resource_search(resource_id, title, summary, body_text, remark_markdown)
  VALUES (new.id, new.title, new.summary, new.body_text, new.remark_markdown);
END;

CREATE TRIGGER resources_search_delete AFTER DELETE ON resources BEGIN
  DELETE FROM resource_search WHERE resource_id = old.id;
END;
