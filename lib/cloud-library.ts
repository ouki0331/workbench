const OWNER_ID = 'user-local-default';
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const SEARCH_TEXT_CHARACTERS = 200_000;
const TEXT_DETAIL_BYTES = MAX_TEXT_BYTES;
const UUID_V4 =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const KINDS = ['articles', 'vocabulary', 'audio', 'recordings'] as const;

type Kind = (typeof KINDS)[number];

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
};

type ResourceRow = {
  id: string;
  kind: Kind;
  title: string;
  summary: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
  body_text: string | null;
  title_source: string;
  metadata_extract_status: string;
  metadata_extracted_at: string | null;
  metadata_extract_error: string | null;
  owner_user_id: string;
  relative_path: string;
  mime_type: string;
  byte_size: number;
  checksum_sha256: string;
  duration_seconds: number | null;
  duration_source: string | null;
  duration_updated_at: string | null;
  extracted_metadata_json: string | null;
  file_id: string;
  subject_id: string;
  skill: string;
  module_id: string;
};

type SaveTextInput = {
  kind?: unknown;
  title?: unknown;
  content?: unknown;
  meaning?: unknown;
  example?: unknown;
  source?: unknown;
  skill?: unknown;
  operationId?: unknown;
};

type EditInput = {
  operationId?: unknown;
  revision?: unknown;
  title?: unknown;
  summary?: unknown;
  source?: unknown;
  kind?: unknown;
  skill?: unknown;
  durationSeconds?: unknown;
  content?: unknown;
};

export class CloudLibraryError extends Error {
  status: number;
  headers?: HeadersInit;

  constructor(status: number, message: string, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function fail(status: number, message: string, headers?: HeadersInit): never {
  throw new CloudLibraryError(status, message, headers);
}

function requiredText(value: unknown, max: number, message: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(400, message);
  return value.trim();
}

function optionalText(value: unknown, max: number, message: string) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) fail(400, message);
  return value.trim();
}

function requiredUtf8Text(value: unknown, maxBytes: number, message: string) {
  if (typeof value !== 'string') fail(400, message);
  const normalized = value.trim();
  if (!normalized || new TextEncoder().encode(normalized).byteLength > maxBytes)
    fail(400, message);
  return normalized;
}

function sourceUrl(value: unknown) {
  const source = optionalText(value, 2048, '来源地址无效');
  if (!source) return '';
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    fail(400, '来源地址必须是有效的 HTTP 或 HTTPS 地址');
  }
}

function validKind(value: unknown): value is Kind {
  return typeof value === 'string' && KINDS.includes(value as Kind);
}

function validOperationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

async function sha256(value: string | Uint8Array) {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function filenameFromKey(key: string) {
  return key.slice(key.lastIndexOf('/') + 1);
}

function extension(filename: string) {
  const index = filename.lastIndexOf('.');
  return index < 0 ? '' : filename.slice(index);
}

function selectSql(where = '') {
  return `SELECT r.*, f.relative_path, f.mime_type, f.byte_size,
    f.checksum_sha256, f.id AS file_id, f.duration_seconds,
    f.duration_source, f.duration_updated_at, f.extracted_metadata_json,
    s.id AS subject_id, s.key AS skill, s.module_id
    FROM resources r
    JOIN resource_files f ON f.resource_id=r.id AND f.role='primary'
    JOIN resource_subjects rs ON rs.resource_id=r.id AND rs.relation_type='primary'
    JOIN subjects s ON s.id=rs.subject_id
    JOIN resource_writes w ON w.resource_id=r.id AND w.state='committed'
    ${where}`;
}

function meta(row: ResourceRow) {
  const filename = filenameFromKey(row.relative_path);
  return {
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
      row.mime_type.startsWith('text/') &&
      ['.txt', '.md'].includes(extension(filename).toLowerCase()),
    canExtract: false,
    filename,
    summary: row.summary || undefined,
    resourceRef: { kind: 'local-asset', id: row.id },
    mime: row.mime_type,
    size: row.byte_size,
    ownerUserId: row.owner_user_id,
    subjectId: row.subject_id,
    moduleId: row.module_id,
  };
}

async function subject(db: D1Database, skill: unknown) {
  if (typeof skill !== 'string') fail(400, '请选择有效且启用的雅思科目');
  const subjectId = `subject-ielts-${skill}`;
  const row = await db
    .prepare(`SELECT s.id, s.module_id FROM subjects s
      JOIN learning_modules m ON m.id=s.module_id
      WHERE s.id=? AND s.status='active' AND m.status='active'
        AND m.id='module-ielts'`)
    .bind(subjectId)
    .first<{ id: string; module_id: string }>();
  if (!row) fail(400, '请选择有效且启用的雅思科目');
  return row;
}

async function rowById(db: D1Database, id: string) {
  const row = await db
    .prepare(selectSql('WHERE r.id=? AND r.owner_user_id=?'))
    .bind(id, OWNER_ID)
    .first<ResourceRow>();
  if (!row) fail(404, '资料不存在');
  return row;
}

async function objectText(files: R2Bucket, row: ResourceRow) {
  if (
    (!row.mime_type.startsWith('text/') &&
      !row.mime_type.startsWith('application/json')) ||
    row.byte_size > TEXT_DETAIL_BYTES
  )
    return null;
  const object = await files.get(row.relative_path);
  if (!object) fail(409, '原文件缺失，请从备份恢复');
  return object.text();
}

export function createCloudLibrary(bindings: Bindings) {
  const { DB, FILES } = bindings;

  async function item(id: string) {
    return rowById(DB, id);
  }

  async function list() {
    const rows = await DB.prepare(
      selectSql('WHERE r.owner_user_id=? ORDER BY r.created_at DESC'),
    )
      .bind(OWNER_ID)
      .all<ResourceRow>();
    return rows.results.map(meta);
  }

  async function detail(kind: string, id: string) {
    const row = await item(id);
    if (row.kind !== kind) fail(404, '资料不存在');
    return { item: meta(row), content: await objectText(FILES, row) };
  }

  async function saveText(input: SaveTextInput) {
    if (
      !validKind(input.kind) ||
      !['articles', 'vocabulary'].includes(input.kind)
    )
      fail(400, '不支持此文本分类');
    if (!validOperationId(input.operationId))
      fail(400, '缺少有效保存操作标识，请重新打开表单');
    const kind = input.kind;
    const operationId = input.operationId;
    const title = requiredText(
      input.title,
      200,
      '标题不能为空且最多 200 个字符',
    );
    const source = sourceUrl(input.source);
    const selectedSubject = await subject(DB, input.skill);
    let content: string;
    let summary = '';
    let filename: string;
    let mime: string;
    if (kind === 'articles') {
      content = requiredUtf8Text(
        input.content,
        MAX_TEXT_BYTES,
        '正文不能为空且 UTF-8 内容最多 2 MiB',
      );
      filename = 'article.md';
      mime = 'text/plain; charset=utf-8';
    } else {
      const meaning = requiredText(
        input.meaning,
        5000,
        '释义不能为空且最多 5000 个字符',
      );
      const example = optionalText(
        input.example,
        10000,
        '例句最多 10000 个字符',
      );
      content = JSON.stringify({ word: title, meaning, example }, null, 2);
      summary = meaning.slice(0, 180);
      filename = 'word.json';
      mime = 'application/json; charset=utf-8';
    }
    const requestHash = await sha256(
      JSON.stringify([
        kind,
        title,
        source || null,
        selectedSubject.id,
        filename,
        mime,
        summary,
        await sha256(content),
      ]),
    );
    const existing = await DB.prepare(
      'SELECT * FROM resource_writes WHERE operation_id=?',
    )
      .bind(operationId)
      .first<{
        resource_id: string;
        request_hash: string;
        state: string;
      }>();
    if (existing && existing.request_hash !== requestHash)
      fail(409, '此次保存内容已变化，请使用新的保存操作');
    if (existing?.state === 'committed')
      return meta(await item(existing.resource_id));

    const resourceId = existing?.resource_id || crypto.randomUUID();
    const now = new Date().toISOString();
    if (!existing) {
      await DB.prepare(`INSERT INTO resource_writes
        (operation_id,resource_id,request_hash,state,storage_kind,created_at)
        VALUES (?,?,?,'pending',?,?)`)
        .bind(operationId, resourceId, requestHash, kind, now)
        .run();
    }
    const bytes = new TextEncoder().encode(content);
    const objectKey = `resources/${resourceId}/content/${operationId}-${filename}`;
    await FILES.put(objectKey, bytes, {
      httpMetadata: { contentType: mime },
      customMetadata: { operationId },
    });
    const fileId = crypto.randomUUID();
    await DB.batch([
      DB.prepare(`INSERT INTO resources
        (id,kind,title,summary,body_text,source_url,owner_user_id,title_source,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'manual',?,?)`).bind(
        resourceId,
        kind,
        title,
        summary || null,
        content.slice(0, SEARCH_TEXT_CHARACTERS),
        source || null,
        OWNER_ID,
        now,
        now,
      ),
      DB.prepare(
        'INSERT INTO resource_subjects (resource_id,subject_id) VALUES (?,?)',
      ).bind(resourceId, selectedSubject.id),
      DB.prepare(`INSERT INTO resource_files
        (id,resource_id,relative_path,original_filename,mime_type,byte_size,checksum_sha256)
        VALUES (?,?,?,?,?,?,?)`).bind(
        fileId,
        resourceId,
        objectKey,
        filename,
        mime,
        bytes.byteLength,
        await sha256(bytes),
      ),
      DB.prepare(
        "UPDATE resource_writes SET state='committed' WHERE operation_id=?",
      ).bind(operationId),
    ]);
    return meta(await item(resourceId));
  }

  async function edit(kind: string, id: string, input: EditInput) {
    const row = await item(id);
    if (row.kind !== kind) fail(404, '资料不存在');
    if (!validOperationId(input.operationId)) fail(400, '保存操作标识无效');
    if (!validKind(input.kind)) fail(400, '请选择有效资料类别');
    const operationId = input.operationId;
    const nextKind = input.kind;
    const title = requiredText(
      input.title,
      200,
      '标题不能为空且最多 200 个字符',
    );
    const summary = optionalText(input.summary, 5000, '摘要最多 5000 个字符');
    const source = sourceUrl(input.source);
    const selectedSubject = await subject(DB, input.skill);
    if (
      input.durationSeconds !== null &&
      (typeof input.durationSeconds !== 'number' ||
        !Number.isFinite(input.durationSeconds) ||
        input.durationSeconds < 0)
    )
      fail(400, '时长必须为空或非负秒数');
    const duration = input.durationSeconds as number | null;
    if (input.content !== undefined && !meta(row).editableContent)
      fail(400, '只有 TXT/Markdown 正文可以编辑');
    const content =
      input.content === undefined
        ? undefined
        : requiredUtf8Text(
            input.content,
            MAX_TEXT_BYTES,
            '正文不能为空且 UTF-8 内容最多 2 MiB',
          );
    const normalized = {
      operationId,
      revision: input.revision,
      title,
      summary,
      source,
      kind: nextKind,
      skill: input.skill,
      durationSeconds: duration,
      ...(content === undefined ? {} : { content }),
    };
    const requestHash = await sha256(JSON.stringify(normalized));
    const existing = await DB.prepare(
      'SELECT * FROM resource_edits WHERE operation_id=?',
    )
      .bind(operationId)
      .first<{
        resource_id: string;
        request_hash: string;
        state: string;
        new_path: string | null;
      }>();
    if (
      existing &&
      (existing.resource_id !== id || existing.request_hash !== requestHash)
    )
      fail(409, '此次保存内容已变化，请使用新的保存操作');
    if (existing?.state === 'committed') return detail(nextKind, id);
    if (!Number.isInteger(input.revision) || input.revision !== row.revision)
      fail(409, '资料已在其他操作中更新，请重新打开后再编辑；当前输入仍保留');

    const changesBody =
      content !== undefined && content !== (await objectText(FILES, row));
    const newPath = changesBody
      ? `resources/${id}/content/${operationId}-${filenameFromKey(row.relative_path)}`
      : null;
    if (!existing) {
      await DB.prepare(`INSERT INTO resource_edits
        (operation_id,resource_id,request_hash,old_path,new_path,state)
        VALUES (?,?,?,?,?,'pending')`)
        .bind(
          operationId,
          id,
          requestHash,
          changesBody ? row.relative_path : null,
          newPath,
        )
        .run();
    }
    let byteSize = row.byte_size;
    let checksum = row.checksum_sha256;
    if (changesBody && newPath && content !== undefined) {
      const bytes = new TextEncoder().encode(content);
      byteSize = bytes.byteLength;
      checksum = await sha256(bytes);
      await FILES.put(newPath, bytes, {
        httpMetadata: { contentType: row.mime_type },
        customMetadata: { operationId },
      });
    }
    const now = new Date().toISOString();
    const manualDuration = duration !== row.duration_seconds;
    const statements = [
      DB.prepare(`UPDATE resources SET title=?,summary=?,source_url=?,kind=?,body_text=?,
        title_source=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?`).bind(
        title,
        summary || null,
        source || null,
        nextKind,
        content === undefined
          ? row.body_text
          : content.slice(0, SEARCH_TEXT_CHARACTERS),
        title !== row.title ? 'manual' : row.title_source,
        now,
        id,
        input.revision,
      ),
      DB.prepare(
        `DELETE FROM resource_subjects WHERE resource_id=? AND relation_type='primary'
          AND changes()=1`,
      ).bind(id),
      DB.prepare(
        `INSERT INTO resource_subjects(resource_id,subject_id)
          SELECT ?,? WHERE changes()=1`,
      ).bind(id, selectedSubject.id),
      DB.prepare(`UPDATE resource_files SET relative_path=?,byte_size=?,checksum_sha256=?,
        duration_seconds=?,duration_source=?,duration_updated_at=? WHERE id=?
        AND changes()=1`).bind(
        newPath || row.relative_path,
        byteSize,
        checksum,
        duration,
        manualDuration ? 'manual' : row.duration_source,
        manualDuration ? now : row.duration_updated_at,
        row.file_id,
      ),
      DB.prepare(
        `UPDATE resource_edits SET state='committed' WHERE operation_id=?
          AND changes()=1`,
      ).bind(operationId),
    ];
    await DB.batch(statements);
    const committed = await DB.prepare(
      `SELECT r.revision, e.state FROM resources r
        JOIN resource_edits e ON e.resource_id=r.id
        WHERE r.id=? AND e.operation_id=?`,
    )
      .bind(id, operationId)
      .first<{ revision: number; state: string }>();
    if (
      committed?.revision !== Number(input.revision) + 1 ||
      committed.state !== 'committed'
    )
      fail(409, '资料已在其他操作中更新，请重新打开后再编辑；当前输入仍保留');
    return detail(nextKind, id);
  }

  async function file(kind: string, id: string, request: Request) {
    const row = await item(id);
    if (row.kind !== kind) fail(404, '资料不存在');
    const range = request.headers.get('range');
    let object: R2ObjectBody | null;
    let status = 200;
    let responseRange: { offset: number; length: number } | null = null;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match)
        fail(416, '请求的文件范围无效', {
          'Content-Range': `bytes */${row.byte_size}`,
        });
      const startText = match[1];
      const endText = match[2];
      let offset: number;
      let length: number;
      if (!startText) {
        const suffix = Number(endText);
        if (!Number.isInteger(suffix) || suffix <= 0)
          fail(416, '请求的文件范围无效', {
            'Content-Range': `bytes */${row.byte_size}`,
          });
        length = Math.min(suffix, row.byte_size);
        offset = row.byte_size - length;
      } else {
        offset = Number(startText);
        const end = endText ? Number(endText) : row.byte_size - 1;
        if (
          !Number.isInteger(offset) ||
          !Number.isInteger(end) ||
          offset < 0 ||
          offset >= row.byte_size ||
          end < offset
        )
          fail(416, '请求的文件范围无效', {
            'Content-Range': `bytes */${row.byte_size}`,
          });
        length = Math.min(end, row.byte_size - 1) - offset + 1;
      }
      object = await FILES.get(row.relative_path, {
        range: { offset, length },
      });
      responseRange = { offset, length };
      status = 206;
    } else {
      object = await FILES.get(row.relative_path);
    }
    if (!object) fail(409, '原文件缺失，请从备份恢复');
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Content-Type': row.mime_type,
      ETag: object.httpEtag,
    });
    if (status === 206 && responseRange) {
      const { offset, length } = responseRange;
      headers.set(
        'Content-Range',
        `bytes ${offset}-${offset + length - 1}/${row.byte_size}`,
      );
      headers.set('Content-Length', String(length));
    } else {
      headers.set('Content-Length', String(row.byte_size));
    }
    if (new URL(request.url).searchParams.has('download'))
      headers.set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(row.title + extension(filenameFromKey(row.relative_path)))}`,
      );
    return new Response(request.method === 'HEAD' ? null : object.body, {
      status,
      headers,
    });
  }

  return { list, detail, saveText, edit, file };
}

type OptionalBindings = { DB?: D1Database; FILES?: R2Bucket };
type RouteContext = { params: Promise<{ path?: string[] }> };

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

async function requestBody(request: Request) {
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('application/json'))
    throw new CloudLibraryError(415, '请求必须使用 JSON');
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new CloudLibraryError(400, 'JSON 内容无效');
  }
}

function assertSameOriginWrite(request: Request) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite))
    throw new CloudLibraryError(403, '拒绝跨站写入请求');
  const origin = request.headers.get('origin');
  if (!origin) return;
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new CloudLibraryError(403, '写入请求来源无效');
  }
  if (origin !== requestOrigin)
    throw new CloudLibraryError(403, '拒绝跨站写入请求');
}

export function createCloudLibraryRoute(bindings: OptionalBindings) {
  return async function handle(request: Request, context: RouteContext) {
    try {
      assertSameOriginWrite(request);
      if (!bindings.DB || !bindings.FILES)
        throw new CloudLibraryError(503, '云端资料存储尚未配置');
      const library = createCloudLibrary({
        DB: bindings.DB,
        FILES: bindings.FILES,
      });
      const { path = [] } = await context.params;
      const [first, kind, id, action] = path;
      if (path.length === 1 && first === 'status' && request.method === 'GET')
        return json({
          available: true,
          directory: 'Cloudflare D1 + R2',
          mode: 'cloud',
          maxUploadBytes: 90 * 1024 * 1024,
          capabilities: { edit: true, organization: false },
        });
      if (path.length === 1 && first === 'items' && request.method === 'GET')
        return json({ items: await library.list(), warnings: [] });
      if (path.length === 1 && first === 'text' && request.method === 'POST')
        return json(await library.saveText(await requestBody(request)), 201);
      if (first === 'items' && kind && id && !action) {
        if (request.method === 'GET')
          return json(await library.detail(kind, id));
        if (request.method === 'PATCH')
          return json(await library.edit(kind, id, await requestBody(request)));
      }
      if (
        first === 'items' &&
        kind &&
        id &&
        action === 'file' &&
        ['GET', 'HEAD'].includes(request.method)
      )
        return library.file(kind, id, request);
      return json({ error: '接口不存在' }, 404);
    } catch (error) {
      const status = error instanceof CloudLibraryError ? error.status : 500;
      const message =
        error instanceof CloudLibraryError
          ? error.message
          : '云端资料操作失败，请重试；当前输入仍保留';
      if (status === 416)
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers: new Headers({
            'Content-Type': 'application/json',
            ...Object.fromEntries(
              new Headers(
                error instanceof CloudLibraryError ? error.headers : undefined,
              ),
            ),
          }),
        });
      return json({ error: message }, status);
    }
  };
}
