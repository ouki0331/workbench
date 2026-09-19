import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { resolve, basename, dirname, extname } from 'node:path';
import { initializeDatabase } from './init-database.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const hash = (value) => createHash('sha256').update(value).digest('hex');
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

// Synchronous writes deliberately keep this small local service's save protocol serial.
// fault is a test-only callback; no request header or environment variable enables it.
export function openSqliteLibrary(
  library,
  databasePath,
  fault = () => {},
  lock,
) {
  initializeDatabase(databasePath, lock);
  const db = new DatabaseSync(databasePath);
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000',
  );
  const folder = (id, kind) => resolve(library, kind, id);
  const temporary = (id) => resolve(library, '.incoming-' + id);
  for (const op of db
    .prepare("SELECT * FROM resource_writes WHERE state='pending'")
    .all()) {
    rmSync(temporary(op.resource_id), { recursive: true, force: true });
    rmSync(folder(op.resource_id, op.storage_kind), {
      recursive: true,
      force: true,
    });
  }
  // Uncommitted edits retain the old file; committed edits retain the new one.
  for (const edit of db.prepare('SELECT * FROM resource_edits').all()) {
    const unused = edit.state === 'committed' ? edit.old_path : edit.new_path;
    if (unused) rmSync(resolve(library, unused), { force: true });
  }
  const select = `SELECT r.*, f.relative_path, f.mime_type, f.byte_size, f.checksum_sha256, f.id AS file_id, f.duration_seconds, f.duration_source, f.duration_updated_at, f.extracted_metadata_json,
    s.id AS subject_id, s.key AS skill, s.module_id
    FROM resources r JOIN resource_files f ON f.resource_id=r.id AND f.role='primary'
    JOIN resource_subjects rs ON rs.resource_id=r.id AND rs.relation_type='primary'
    JOIN subjects s ON s.id=rs.subject_id`;
  function item(id) {
    const row = db.prepare(select + ' WHERE r.id=?').get(id);
    if (!row) throw fail(404, '资料不存在');
    const target = resolve(library, row.relative_path);
    const meta = {
      id: row.id,
      kind: row.kind,
      title: row.title,
      source: row.source_url || '',
      skill: row.skill,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
      titleSource: row.title_source,
      durationSeconds: row.duration_seconds,
      durationSource: row.duration_source,
      durationUpdatedAt: row.duration_updated_at,
      metadataExtractStatus: row.metadata_extract_status,
      metadataExtractedAt: row.metadata_extracted_at,
      metadataExtractError: row.metadata_extract_error,
      extractedMetadata: row.extracted_metadata_json
        ? JSON.parse(row.extracted_metadata_json)
        : null,
      editableContent:
        row.mime_type?.startsWith('text/') &&
        ['.txt', '.md'].includes(extname(row.relative_path).toLowerCase()),
      canExtract: ['.mp3', '.m4a', '.wav', '.webm'].includes(
        extname(row.relative_path).toLowerCase(),
      ),
      filename: basename(row.relative_path),
      summary: row.summary || undefined,
      resourceRef: { kind: 'local-asset', id: row.id },
      mime: row.mime_type,
      size: row.byte_size,
      ownerUserId: row.owner_user_id,
      subjectId: row.subject_id,
      moduleId: row.module_id,
    };
    if (!existsSync(target)) meta.repairRequired = true;
    return { meta, target };
  }
  function save(kind, fields, filename, content, mime) {
    if (
      !['articles', 'vocabulary', 'audio', 'recordings'].includes(kind) ||
      basename(filename) !== filename
    )
      throw fail(400, '资料格式无效');
    const { operationId } = fields;
    if (typeof operationId !== 'string' || !uuid.test(operationId))
      throw fail(400, '缺少有效保存操作标识，请重新打开表单');
    const subjectId = `subject-ielts-${fields.skill}`;
    const subject = db
      .prepare(`SELECT s.*, m.status AS module_status FROM subjects s
      JOIN learning_modules m ON m.id=s.module_id WHERE s.id=?`)
      .get(subjectId);
    const owner = db
      .prepare("SELECT status FROM users WHERE id='user-local-default'")
      .get();
    if (
      !subject ||
      subject.status !== 'active' ||
      subject.module_status !== 'active' ||
      subject.module_id !== 'module-ielts' ||
      owner?.status !== 'active' ||
      (fields.subjectId !== undefined && fields.subjectId !== subjectId) ||
      (fields.moduleId !== undefined &&
        fields.moduleId !== subject.module_id) ||
      (fields.ownerUserId !== undefined &&
        fields.ownerUserId !== 'user-local-default')
    ) {
      throw fail(400, '请选择有效且启用的雅思科目');
    }
    const source = fields.source || null;
    // Keep the DEV-001 text identity so retrying an existing article still works.
    const requestHash = hash(
      JSON.stringify(
        kind === 'articles' &&
          filename === 'article.md' &&
          mime === 'text/plain; charset=utf-8'
          ? [fields.title, source, subjectId, content.toString('utf8')]
          : [
              kind,
              fields.title,
              source,
              subjectId,
              filename,
              mime,
              fields.summary || '',
              hash(content),
            ],
      ),
    );
    let op = db
      .prepare('SELECT * FROM resource_writes WHERE operation_id=?')
      .get(operationId);
    if (op && op.request_hash !== requestHash)
      throw fail(409, '此次保存内容已变化，请使用新的保存操作');
    if (op?.state === 'committed') {
      const result = item(op.resource_id);
      if (result.meta.repairRequired)
        throw fail(409, '原文件缺失，需要从备份恢复后再打开');
      return result.meta;
    }
    if (!op) {
      op = { resource_id: randomUUID() };
      db.prepare(
        "INSERT INTO resource_writes(operation_id,resource_id,request_hash,state,storage_kind,created_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      ).run(
        operationId,
        op.resource_id,
        requestHash,
        kind,
        fields.createdAt || new Date().toISOString(),
      );
    }
    const id = op.resource_id;
    try {
      fault('before-file');
      mkdirSync(temporary(id), { recursive: true, mode: 0o700 });
      writeFileSync(resolve(temporary(id), filename), content, {
        mode: 0o600,
      });
      if (!readFileSync(resolve(temporary(id), filename)).equals(content))
        throw Error('File verification failed');
      renameSync(temporary(id), folder(id, kind));
      fault('after-file');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO resources (id, kind, title, summary, body_text, source_url, owner_user_id, title_source)
          VALUES (?, ?, ?, ?, ?, ?, 'user-local-default', ?)`).run(
          id,
          kind,
          fields.title,
          fields.summary || null,
          mime.startsWith('text/') || mime.startsWith('application/json')
            ? content.toString('utf8')
            : null,
          source,
          fields.titleSource || 'manual',
        );
        db.prepare(
          'INSERT INTO resource_subjects (resource_id, subject_id) VALUES (?, ?)',
        ).run(id, subjectId);
        db.prepare(`INSERT INTO resource_files (id, resource_id, relative_path, mime_type, byte_size, checksum_sha256)
          VALUES (?, ?, ?, ?, ?, ?)`).run(
          randomUUID(),
          id,
          `${kind}/${id}/${filename}`,
          mime,
          content.length,
          hash(content),
        );
        db.prepare(
          "UPDATE resource_writes SET state='committed' WHERE operation_id=?",
        ).run(operationId);
        fault('before-commit');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      fault('after-commit');
      return item(id).meta;
    } catch (error) {
      if (
        db
          .prepare('SELECT state FROM resource_writes WHERE operation_id=?')
          .get(operationId).state === 'pending'
      ) {
        rmSync(temporary(id), { recursive: true, force: true });
        rmSync(folder(id, kind), { recursive: true, force: true });
      }
      throw error;
    }
  }
  function edit(id, fields) {
    const row = db.prepare(select + ' WHERE r.id=?').get(id);
    if (!row) throw fail(404, '资料不存在');
    if (
      typeof fields.operationId !== 'string' ||
      !uuid.test(fields.operationId)
    )
      throw fail(400, '保存操作标识无效');
    const requestHash = hash(JSON.stringify(fields));
    let op = db
      .prepare('SELECT * FROM resource_edits WHERE operation_id=?')
      .get(fields.operationId);
    if (op && (op.request_hash !== requestHash || op.resource_id !== id))
      throw fail(409, '此次保存内容已变化，请使用新的保存操作');
    if (op?.state === 'committed') return item(id).meta;
    if (!Number.isInteger(fields.revision) || fields.revision !== row.revision)
      throw fail(
        409,
        '资料已在其他操作中更新，请重新打开后再编辑；当前输入仍保留',
      );
    const current = item(id).meta;
    if (fields.content !== undefined && !current.editableContent)
      throw fail(400, '只有 TXT/Markdown 正文可以编辑');
    const subjectId = 'subject-ielts-' + fields.skill;
    const subject = db
      .prepare(`SELECT s.id FROM subjects s JOIN learning_modules m ON m.id=s.module_id
      WHERE s.id=? AND s.status='active' AND m.status='active' AND m.id='module-ielts'`)
      .get(subjectId);
    if (!subject) throw fail(400, '请选择有效且启用的雅思科目');
    const changesBody =
      fields.content !== undefined && fields.content !== row.body_text;
    const newPath = changesBody
      ? `${dirname(row.relative_path)}/content-${fields.operationId}${extname(row.relative_path)}`
      : null;
    if (!op) {
      db.prepare(
        "INSERT INTO resource_edits VALUES (?, ?, ?, ?, ?, 'pending')",
      ).run(
        fields.operationId,
        id,
        requestHash,
        changesBody ? row.relative_path : null,
        newPath,
      );
      op = {
        old_path: changesBody ? row.relative_path : null,
        new_path: newPath,
      };
    }
    const now = new Date().toISOString();
    try {
      if (changesBody) {
        fault('edit-before-file');
        writeFileSync(resolve(library, newPath), fields.content, {
          mode: 0o600,
        });
        if (readFileSync(resolve(library, newPath), 'utf8') !== fields.content)
          throw Error('File verification failed');
        fault('edit-after-file');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`UPDATE resources SET title=?, summary=?, source_url=?, kind=?, body_text=?,
          title_source=?, updated_at=?, revision=revision+1 WHERE id=?`).run(
          fields.title,
          fields.summary || null,
          fields.source || null,
          fields.kind,
          changesBody ? fields.content : row.body_text,
          fields.title !== row.title ? 'manual' : row.title_source,
          now,
          id,
        );
        db.prepare(
          "DELETE FROM resource_subjects WHERE resource_id=? AND relation_type='primary'",
        ).run(id);
        db.prepare(
          'INSERT INTO resource_subjects(resource_id,subject_id) VALUES (?, ?)',
        ).run(id, subjectId);
        const manualDuration = fields.durationSeconds !== row.duration_seconds;
        db.prepare(
          `UPDATE resource_files SET duration_seconds=?, duration_source=?, duration_updated_at=? WHERE id=?`,
        ).run(
          fields.durationSeconds,
          manualDuration ? 'manual' : row.duration_source,
          manualDuration ? now : row.duration_updated_at,
          row.file_id,
        );
        if (changesBody) {
          const bytes = Buffer.from(fields.content);
          db.prepare(
            'UPDATE resource_files SET relative_path=?, byte_size=?, checksum_sha256=? WHERE id=?',
          ).run(newPath, bytes.length, hash(bytes), row.file_id);
        }
        db.prepare(
          "UPDATE resource_edits SET state='committed' WHERE operation_id=?",
        ).run(fields.operationId);
        fault('edit-before-commit');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      fault('edit-after-commit');
      if (op.old_path) rmSync(resolve(library, op.old_path), { force: true });
      return item(id).meta;
    } catch (error) {
      if (
        db
          .prepare('SELECT state FROM resource_edits WHERE operation_id=?')
          .get(fields.operationId).state === 'pending' &&
        newPath
      )
        rmSync(resolve(library, newPath), { force: true });
      throw error;
    }
  }
  function recordExtraction(id, result) {
    const row = db.prepare(select + ' WHERE r.id=?').get(id);
    if (!row) throw fail(404, '资料不存在');
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const automaticTitle = row.title_source !== 'manual' && result.title;
      const automaticDuration =
        row.duration_source !== 'manual' && result.durationSeconds !== null;
      db.prepare(`UPDATE resources SET title=?, title_source=?, metadata_extracted_at=?, metadata_extract_status=?,
        metadata_extract_error=?, updated_at=?, revision=revision+1 WHERE id=?`).run(
        automaticTitle || row.title,
        automaticTitle ? 'embedded' : row.title_source,
        now,
        result.status,
        result.error,
        now,
        id,
      );
      db.prepare(`UPDATE resource_files SET duration_seconds=?, duration_source=?, duration_updated_at=?,
        extracted_metadata_json=?, metadata_extracted_at=? WHERE id=?`).run(
        automaticDuration ? result.durationSeconds : row.duration_seconds,
        automaticDuration ? 'automatic' : row.duration_source,
        automaticDuration ? now : row.duration_updated_at,
        result.raw ? JSON.stringify(result.raw) : null,
        now,
        row.file_id,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return item(id).meta;
  }
  function organization(id) {
    const resource = db
      .prepare(
        'SELECT id, remark_markdown, remark_updated_at, revision FROM resources WHERE id=?',
      )
      .get(id);
    if (!resource) throw fail(404, '资料不存在');
    const assignedTags = db
      .prepare(`SELECT t.id, t.group_id AS groupId, t.key, t.name_en AS nameEn,
        t.name_ja AS nameJa, t.name_zh_cn AS nameZhCn, t.name_zh_tw AS nameZhTw,
        t.is_active AS isActive, t.owner_user_id AS ownerUserId,
        t.custom_color_token AS customColorToken, rt.assignment_source AS assignmentSource,
        rt.confidence FROM resource_tags rt JOIN tags t ON t.id=rt.tag_id
        WHERE rt.resource_id=? ORDER BY t.sort_order, t.id`)
      .all(id);
    const assignedIds = new Set(assignedTags.map((tag) => tag.id));
    const groups = db
      .prepare(`SELECT id, key, selection_mode AS selectionMode,
        color_token AS colorToken, is_system AS isSystem, sort_order AS sortOrder
        FROM tag_groups ORDER BY sort_order, id`)
      .all()
      .map((group) => ({
        ...group,
        tags: db
          .prepare(`SELECT id, key, name_en AS nameEn, name_ja AS nameJa,
            name_zh_cn AS nameZhCn, name_zh_tw AS nameZhTw,
            is_active AS isActive, owner_user_id AS ownerUserId,
            custom_color_token AS customColorToken, sort_order AS sortOrder
            FROM tags WHERE group_id=? AND (is_active=1 OR id IN
              (SELECT tag_id FROM resource_tags WHERE resource_id=?))
            ORDER BY sort_order, id`)
          .all(group.id, id),
      }));
    return {
      revision: resource.revision,
      remark: resource.remark_markdown || '',
      remarkUpdatedAt: resource.remark_updated_at,
      notes: db
        .prepare(`SELECT id, title, body_markdown AS bodyMarkdown,
          sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
          FROM resource_notes WHERE resource_id=? ORDER BY sort_order, created_at, id`)
        .all(id),
      groups,
      assignedTags,
      assignedTagIds: [...assignedIds],
      places: db
        .prepare(`SELECT id, kind, parent_id AS parentId, code_scheme AS codeScheme,
          code, m49_code AS m49Code, iso_alpha2 AS isoAlpha2,
          name_en AS nameEn, name_ja AS nameJa, name_zh_cn AS nameZhCn,
          name_zh_tw AS nameZhTw FROM places WHERE is_active=1
          ORDER BY CASE kind WHEN 'world' THEN 0 WHEN 'region' THEN 1
            WHEN 'subregion' THEN 2 WHEN 'area' THEN 3 ELSE 4 END, code, id`)
        .all(),
      assignedPlaceIds: db
        .prepare("SELECT place_id AS placeId FROM resource_places WHERE resource_id=? AND relation_type='coverage' ORDER BY place_id")
        .all(id)
        .map((row) => row.placeId),
      suggestions: db
        .prepare(`SELECT s.tag_id AS tagId, s.rule_key AS ruleKey, s.evidence,
          s.confidence, s.generated_at AS generatedAt, s.accepted_at AS acceptedAt,
          t.group_id AS groupId, t.name_en AS nameEn, t.name_ja AS nameJa,
          t.name_zh_cn AS nameZhCn, t.name_zh_tw AS nameZhTw
          FROM resource_tag_suggestions s JOIN tags t ON t.id=s.tag_id
          WHERE s.resource_id=? ORDER BY s.confidence DESC, s.tag_id`)
        .all(id),
    };
  }
  function saveOrganization(id, draft) {
    const resource = db
      .prepare('SELECT * FROM resources WHERE id=?')
      .get(id);
    if (!resource) throw fail(404, '资料不存在');
    if (!Number.isInteger(draft.revision) || draft.revision !== resource.revision)
      throw fail(409, '资料已在其他操作中更新，请重新打开后再整理；当前输入仍保留');
    if (typeof draft.remark !== 'string' || draft.remark.length > 20000)
      throw fail(400, '备注最多 20000 个字符');
    if (!Array.isArray(draft.notes) || draft.notes.length > 20)
      throw fail(400, '每份资料最多保存 20 篇笔记');
    const notes = draft.notes.map((note, index) => {
      if (
        !note ||
        typeof note.id !== 'string' ||
        !uuid.test(note.id) ||
        typeof note.title !== 'string' ||
        !note.title.trim() ||
        note.title.length > 200 ||
        typeof note.bodyMarkdown !== 'string' ||
        note.bodyMarkdown.length > 100000
      )
        throw fail(400, '笔记标题或正文格式无效');
      return {
        id: note.id,
        title: note.title.trim(),
        bodyMarkdown: note.bodyMarkdown,
        sortOrder: index,
      };
    });
    if (new Set(notes.map((note) => note.id)).size !== notes.length)
      throw fail(400, '笔记标识重复');
    if (!Array.isArray(draft.tagIds) || draft.tagIds.length > 60)
      throw fail(400, '标签选择格式无效');
    const tagIds = [...new Set(draft.tagIds)];
    const oldTagIds = new Set(
      db
        .prepare('SELECT tag_id AS id FROM resource_tags WHERE resource_id=?')
        .all(id)
        .map((row) => row.id),
    );
    for (const tagId of tagIds) {
      const tag = db.prepare('SELECT is_active FROM tags WHERE id=?').get(tagId);
      if (!tag || (!tag.is_active && !oldTagIds.has(tagId)))
        throw fail(400, '所选标签不存在或已停用');
    }
    const singleGroups = db
      .prepare(`SELECT t.group_id AS groupId, COUNT(*) AS count FROM tags t
        WHERE t.id IN (${tagIds.map(() => '?').join(',') || "''"})
        GROUP BY t.group_id`)
      .all(...tagIds);
    for (const group of singleGroups)
      if (
        group.count > 1 &&
        db
          .prepare("SELECT id FROM tag_groups WHERE id=? AND selection_mode='single'")
          .get(group.groupId)
      )
        throw fail(400, '单选标签组只能选择一个值');
    if (!Array.isArray(draft.customTags) || draft.customTags.length > 20)
      throw fail(400, '自定义标签格式无效');
    const customTags = draft.customTags.map((tag) => {
      const name = typeof tag?.name === 'string' ? tag.name.trim() : '';
      if (!name || name.length > 40)
        throw fail(400, '自定义标签名称应为 1–40 个字符');
      if (!['sakura', 'navy', 'olive', 'charcoal'].includes(tag.color))
        throw fail(400, '请选择有效的自定义标签颜色');
      return { name, color: tag.color };
    });
    const normalizedNames = new Set();
    for (const row of db
      .prepare('SELECT name_en, name_ja, name_zh_cn, name_zh_tw FROM tags')
      .all())
      for (const name of Object.values(row))
        normalizedNames.add(String(name).normalize('NFKC').trim().toLocaleLowerCase());
    for (const tag of customTags) {
      const normalized = tag.name.normalize('NFKC').trim().toLocaleLowerCase();
      if (normalizedNames.has(normalized))
        throw fail(409, `标签“${tag.name}”已存在，请直接使用已有标签`);
      normalizedNames.add(normalized);
    }
    if (!Array.isArray(draft.placeIds) || draft.placeIds.length > 100)
      throw fail(400, '地区选择格式无效');
    const placeIds = [...new Set(draft.placeIds)];
    for (const placeId of placeIds)
      if (!db.prepare('SELECT id FROM places WHERE id=? AND is_active=1').get(placeId))
        throw fail(400, '所选地区不存在或已停用');
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (draft.remark !== (resource.remark_markdown || ''))
        db.prepare('UPDATE resources SET remark_markdown=?, remark_updated_at=? WHERE id=?').run(
          draft.remark || null,
          now,
          id,
        );
      const existingNotes = new Map(
        db
          .prepare('SELECT * FROM resource_notes WHERE resource_id=?')
          .all(id)
          .map((note) => [note.id, note]),
      );
      for (const note of notes) {
        const existing = existingNotes.get(note.id);
        if (existing) {
          const contentChanged =
            existing.title !== note.title ||
            existing.body_markdown !== note.bodyMarkdown;
          db.prepare(`UPDATE resource_notes SET title=?, body_markdown=?, sort_order=?,
            updated_at=? WHERE id=? AND resource_id=?`).run(
            note.title,
            note.bodyMarkdown,
            note.sortOrder,
            contentChanged ? now : existing.updated_at,
            note.id,
            id,
          );
          existingNotes.delete(note.id);
        } else {
          db.prepare(`INSERT INTO resource_notes
            (id,resource_id,user_id,title,body_markdown,sort_order,created_at,updated_at)
            VALUES (?,?,'user-local-default',?,?,?,?,?)`).run(
            note.id,
            id,
            note.title,
            note.bodyMarkdown,
            note.sortOrder,
            now,
            now,
          );
        }
      }
      for (const noteId of existingNotes.keys())
        db.prepare('DELETE FROM resource_notes WHERE id=? AND resource_id=?').run(noteId, id);
      for (const tag of customTags) {
        const tagId = randomUUID();
        db.prepare(`INSERT INTO tags (id,group_id,key,name_en,name_ja,name_zh_cn,name_zh_tw,
          owner_user_id,custom_color_token,sort_order)
          VALUES (?,'tag-group-user',?,?,?,?,?,'user-local-default',?,?)`).run(
          tagId,
          `custom-${tagId}`,
          tag.name,
          tag.name,
          tag.name,
          tag.name,
          tag.color,
          1000 + tagIds.length,
        );
        tagIds.push(tagId);
      }
      db.prepare('DELETE FROM resource_tags WHERE resource_id=?').run(id);
      for (const tagId of tagIds) {
        const suggestion = db
          .prepare('SELECT confidence FROM resource_tag_suggestions WHERE resource_id=? AND tag_id=?')
          .get(id, tagId);
        db.prepare(`INSERT INTO resource_tags(resource_id,tag_id,assignment_source,confidence)
          VALUES (?,?,?,?)`).run(
          id,
          tagId,
          suggestion ? 'system' : 'manual',
          suggestion?.confidence ?? null,
        );
        if (suggestion)
          db.prepare(`UPDATE resource_tag_suggestions SET accepted_at=?
            WHERE resource_id=? AND tag_id=?`).run(now, id, tagId);
      }
      db.prepare("DELETE FROM resource_places WHERE resource_id=? AND relation_type='coverage'").run(id);
      for (const placeId of placeIds)
        db.prepare(`INSERT INTO resource_places(resource_id,place_id,relation_type,assignment_source)
          VALUES (?,?,'coverage','manual')`).run(id, placeId);
      db.prepare('UPDATE resources SET revision=revision+1 WHERE id=?').run(id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { item: item(id).meta, organization: organization(id) };
  }
  function refreshSuggestions(id) {
    const row = db.prepare(select + ' WHERE r.id=?').get(id);
    if (!row) throw fail(404, '资料不存在');
    const text = `${row.title} ${row.summary || ''} ${row.source_url || ''}`.normalize('NFKC').toLocaleLowerCase();
    const candidates = [
      { tagId: `type-${row.kind === 'articles' ? 'article' : row.kind === 'audio' ? 'audio' : row.kind === 'recordings' ? 'recording' : 'vocabulary'}`, ruleKey: 'resource-kind', evidence: `资料类型：${row.kind}`, confidence: 0.99 },
      { tagId: `skill-${row.skill}`, ruleKey: 'primary-subject', evidence: `关联科目：${row.skill}`, confidence: 0.99 },
    ];
    const topicRules = [
      ['topic-finance', /finance|financial|bank|interest rate|金融|银行|銀行/, '标题、摘要或来源包含金融相关词', 0.82],
      ['topic-economy', /economy|economic|inflation|经济|經濟|通胀|通脹/, '标题、摘要或来源包含经济相关词', 0.82],
      ['topic-technology', /technology|software|computer|科技|技术|技術/, '标题、摘要或来源包含科技相关词', 0.78],
      ['topic-environment', /environment|climate|pollution|环境|環境|气候|氣候/, '标题、摘要或来源包含环境相关词', 0.78],
      ['topic-education', /education|school|university|教育|学校|學校/, '标题、摘要或来源包含教育相关词', 0.78],
      ['topic-health', /health|medical|medicine|健康|医疗|醫療/, '标题、摘要或来源包含健康相关词', 0.78],
    ];
    for (const [tagId, pattern, evidence, confidence] of topicRules)
      if (pattern.test(text))
        candidates.push({ tagId, ruleKey: 'metadata-keyword', evidence, confidence });
    const valid = candidates.filter((candidate) =>
      db.prepare('SELECT id FROM tags WHERE id=? AND is_active=1').get(candidate.tagId),
    );
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM resource_tag_suggestions WHERE resource_id=? AND accepted_at IS NULL').run(id);
      for (const suggestion of valid)
        db.prepare(`INSERT INTO resource_tag_suggestions
          (resource_id,tag_id,rule_key,evidence,confidence,generated_at)
          VALUES (?,?,?,?,?,?) ON CONFLICT(resource_id,tag_id) DO UPDATE SET
          rule_key=excluded.rule_key,evidence=excluded.evidence,
          confidence=excluded.confidence,generated_at=excluded.generated_at`).run(
          id,
          suggestion.tagId,
          suggestion.ruleKey,
          suggestion.evidence,
          suggestion.confidence,
          now,
        );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return organization(id).suggestions;
  }
  return {
    save,
    edit,
    recordExtraction,
    organization,
    saveOrganization,
    refreshSuggestions,
    item,
    operationTimestamp: (operationId) =>
      db
        .prepare('SELECT created_at FROM resource_writes WHERE operation_id=?')
        .get(operationId)?.created_at || new Date().toISOString(),
    exists: (id) => !!db.prepare('SELECT id FROM resources WHERE id=?').get(id),
    list: () =>
      db
        .prepare(select + ' ORDER BY r.created_at DESC')
        .all()
        .map((row) => item(row.id).meta),
    close: () => db.close(),
  };
}
