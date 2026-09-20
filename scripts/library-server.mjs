import { createServer } from 'node:http';
import { openSqliteLibrary } from './sqlite-library.mjs';
import { extractMediaMetadata } from './extract-media-metadata.mjs';
import { acquireLibraryLock } from './library-lock.mjs';
import { parseProgress, validResourceRef } from '../lib/progress.ts';
import { fetchPublic } from './public-fetch.mjs';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  rename,
  rm,
  mkdtemp,
  stat,
  realpath,
} from 'node:fs/promises';
import { resolve, extname, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
const runFile = promisify(execFile);
const project = fileURLToPath(new URL('..', import.meta.url));
export const defaultLibrary = resolve(project, '../ielts-study-library');
const kinds = ['articles', 'vocabulary', 'audio', 'recordings'];
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const audioMime = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
};
const staticMime = {
  ...audioMime,
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const catalogTopics = {
  'international-politics': {
    label: '国际政治',
    categories: ['International_relations'],
    matches:
      /international|diplom|foreign|global|conflict|aid|policy|relations|united nations|treaty|asylum|isolation|sanction|summit|recognition/i,
    fallback: [
      ['International relations', 'International_relations'],
      ['Diplomacy', 'Diplomacy'],
      ['United Nations', 'United_Nations'],
    ],
  },
  'economy-finance': {
    label: '经济金融',
    categories: ['Economics', 'Finance'],
    matches:
      /econom|financ|bank|bond|budget|capital|credit|trade|inflation|market|debt|income|asset|currency|tax|price|investment|consumer|deficit/i,
    fallback: [
      ['Economy', 'Economy'],
      ['International trade', 'International_trade'],
      ['Inflation', 'Inflation'],
      ['Central bank', 'Central_bank'],
    ],
  },
};
function plain(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function fallbackCatalog() {
  return Object.entries(catalogTopics).flatMap(([topic, config]) =>
    config.fallback.map(([title, key]) => ({
      id: `simplewiki:${key}`,
      title,
      topic,
      topicLabel: config.label,
      provider: 'Simple English Wikipedia',
      description: '简明英文背景文章，可在工作台内阅读或朗读。',
      url: `https://simple.wikipedia.org/wiki/${key}`,
    })),
  );
}
async function queryCatalog() {
  const results = await Promise.allSettled(
    Object.entries(catalogTopics).map(async ([topic, config]) => {
      const categoryResults = await Promise.all(
        config.categories.map(async (category) => {
          const api = new URL('https://simple.wikipedia.org/w/api.php');
          api.searchParams.set('action', 'query');
          api.searchParams.set('list', 'categorymembers');
          api.searchParams.set('cmtitle', `Category:${category}`);
          api.searchParams.set('cmlimit', '20');
          api.searchParams.set('cmnamespace', '0');
          api.searchParams.set('format', 'json');
          const response = await fetchPublic(api.href, {
            limit: 1024 * 1024,
          });
          const data = JSON.parse(response.body.toString('utf8'));
          return Array.isArray(data.query?.categorymembers)
            ? data.query.categorymembers
            : [];
        }),
      );
      return categoryResults
        .flat()
        .filter(
          (page) =>
            page &&
            typeof page.title === 'string' &&
            !/^\d/.test(page.title) &&
            page.title.length <= 80 &&
            config.matches.test(page.title),
        )
        .map((page) => {
          const key = String(page.title).replaceAll(' ', '_');
          return {
            id: `simplewiki:${key}`,
            title: plain(page.title).slice(0, 200),
            topic,
            topicLabel: config.label,
            provider: 'Simple English Wikipedia',
            description: `${config.label} · 简明英文背景文章`,
            url: `https://simple.wikipedia.org/wiki/${encodeURIComponent(key)}`,
          };
        })
        .slice(0, 14);
    }),
  );
  const live = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  return Array.from(new Map(live.map((item) => [item.id, item])).values());
}
export function mergeCatalog(live, cached = []) {
  const fallback = fallbackCatalog(),
    staleTopics = [];
  const items = Object.keys(catalogTopics).flatMap((topic) => {
    const current = live.filter((item) => item.topic === topic);
    if (current.length) return current;
    staleTopics.push(topic);
    const previous = cached.filter((item) => item.topic === topic);
    return previous.length
      ? previous
      : fallback.filter((item) => item.topic === topic);
  });
  return { items, staleTopics };
}
function childOperationId(parent, label) {
  const value = createHash('sha256')
    .update(parent + ':' + label)
    .digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}
function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
function text(value, max, required = false) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw fail(400, '字段为空或内容过长');
  return value.trim();
}
function sourceUrl(value = '') {
  const s = text(value, 2000);
  if (s) {
    try {
      const url = new URL(s);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname)
        throw Error('invalid URL');
    } catch {
      throw fail(400, '请输入有效的 http:// 或 https:// 来源链接');
    }
  }
  return s;
}
async function body(req, limit) {
  if (Number(req.headers['content-length']) > limit)
    throw fail(413, '文件超出大小限制');
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw fail(413, '文件超出大小限制');
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
async function jsonBody(req) {
  try {
    return JSON.parse((await body(req, 2 * 1024 * 1024)).toString('utf8'));
  } catch (e) {
    if (e.status) throw e;
    throw fail(400, 'JSON 格式无效');
  }
}
function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
async function sendFile(req, res, path, mime, downloadName) {
  const info = await stat(path);
  if (!info.isFile()) throw fail(404, '文件不存在');
  let start = 0,
    end = info.size - 1,
    status = 200;
  const headers = {
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
  };
  if (downloadName)
    headers['Content-Disposition'] =
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  if (req.headers.range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!m || (!m[1] && !m[2])) throw fail(416, '不支持此音频范围');
    if (m[1]) {
      start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), end);
    } else start = Math.max(0, info.size - Number(m[2]));
    if (start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      res.end();
      return;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || info.size === 0) {
    res.end();
    return;
  }
  const stream = createReadStream(path, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
export async function createLibraryServer({
  libraryDir = defaultLibrary,
  staticDir = resolve(project, 'dist-cloudstudio'),
  mode = process.env.IELTS_LIBRARY_MODE || 'legacy',
  databasePath = process.env.IELTS_DB_PATH,
  fault,
  backupHook,
  fetchResource = fetchPublic,
  metadataProbe = extractMediaMetadata,
} = {}) {
  const requestedLibrary = resolve(libraryDir);
  if (!['legacy', 'sqlite'].includes(mode))
    throw Error('IELTS_LIBRARY_MODE must be legacy or sqlite');
  if (
    mode === 'sqlite' &&
    (!databasePath ||
      resolve(databasePath) !==
        resolve(requestedLibrary, 'workbench.sqlite3') ||
      requestedLibrary === resolve(defaultLibrary))
  )
    throw Error(
      'SQLite preview requires an isolated IELTS_LIBRARY_DIR and IELTS_DB_PATH=<directory>/workbench.sqlite3',
    );
  await mkdir(requestedLibrary, { recursive: true, mode: 0o700 });
  const library = await realpath(requestedLibrary);
  const marker = resolve(library, '.library-mode.json');
  let existingMode;
  try {
    existingMode = JSON.parse(await readFile(marker, 'utf8')).mode;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existingMode && existingMode !== mode)
    throw Error(
      'Library directory mode does not match; use a separate directory',
    );
  if (!existingMode) {
    const entries = await readdir(library);
    if (mode === 'sqlite' && entries.length)
      throw Error(
        'SQLite preview requires a new empty directory; existing files are preserved',
      );
    await writeFile(marker, JSON.stringify({ mode }), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  const directoryLock = acquireLibraryLock(library);
  let sqliteCatalog;
  try {
    for (const k of [...kinds, 'progress', 'backups'])
      await mkdir(resolve(library, k), { recursive: true, mode: 0o700 });
    sqliteCatalog =
      mode === 'sqlite'
        ? openSqliteLibrary(
            library,
            resolve(databasePath),
            fault,
            directoryLock,
          )
        : null;
    const introduction =
      '# 雅思学习资料库\n\narticles：文章原文及上传文档\nvocabulary：单词、释义、例句 JSON\naudio：练习音频原文件\nrecordings：个人录音原文件\nprogress：打包备份时保存的学习进度快照\nbackups：ZIP 备份，打包时不会嵌套备份目录\n\n每份资料位于分类/UUID/ 下，metadata.json 保存标题、来源、科目、创建时间与文件名。请整体复制此目录迁移；文件不依赖浏览器缓存。不要只复制 metadata.json。\n\n运行：在 ielts-workbench 中执行 npm run start:local。可通过 IELTS_LIBRARY_DIR 指定迁移后的本地目录；云盘可先同步此目录。不要同时在多台电脑写入同一同步目录。\n';
    try {
      await writeFile(
        resolve(library, 'README.md'),
        sqliteCatalog
          ? '# SQLite 资料目录\n\nworkbench.sqlite3 是目录索引；分类目录保存原文、音频及练习文件。请保留整个目录。请通过应用打包备份，恢复后显式导入所附进度 JSON。\n'
          : introduction,
        {
          flag: 'wx',
          mode: 0o600,
        },
      );
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    try {
      await writeFile(
        resolve(library, 'manifest.json'),
        JSON.stringify(
          {
            format: 'ielts-study-library',
            version: 1,
            categories: kinds,
            mode,
          },
          null,
          2,
        ),
        { flag: 'wx', mode: 0o600 },
      );
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    async function persist(kind, fields, filename, content, mime) {
      if (sqliteCatalog) {
        let meta = sqliteCatalog.save(
          kind,
          {
            ...fields,
            title: text(fields.title, 200, true),
            source: sourceUrl(fields.source),
          },
          filename,
          content,
          mime,
        );
        if (meta.canExtract && meta.metadataExtractStatus === 'not_run') {
          const result = await metadataProbe(
            sqliteCatalog.item(meta.id).target,
          );
          meta = sqliteCatalog.recordExtraction(meta.id, result);
        }
        return meta;
      }
      if (!kinds.includes(kind)) throw fail(400, '资料分类无效');
      const id = randomUUID(),
        tmp = await mkdtemp(resolve(library, '.incoming-'));
      try {
        const meta = {
          id,
          kind,
          title: text(fields.title, 200, true),
          source: sourceUrl(fields.source),
          skill: ['listening', 'reading', 'writing', 'speaking'].includes(
            fields.skill,
          )
            ? fields.skill
            : 'reading',
          createdAt: new Date().toISOString(),
          filename,
          mime,
          size: content.length,
          ...(fields.summary ? { summary: text(fields.summary, 200) } : {}),
        };
        await writeFile(resolve(tmp, filename), content, { mode: 0o600 });
        await writeFile(
          resolve(tmp, 'metadata.json'),
          JSON.stringify(meta, null, 2),
          { mode: 0o600 },
        );
        await rename(tmp, resolve(library, kind, id));
        return meta;
      } catch (e) {
        await rm(tmp, { recursive: true, force: true });
        throw e;
      }
    }
    async function item(kind, id) {
      if (!kinds.includes(kind) || !uuid.test(id))
        throw fail(404, '资料不存在');
      if (sqliteCatalog) {
        return sqliteCatalog.item(id);
      }
      try {
        const folder = resolve(library, kind, id),
          meta = JSON.parse(
            await readFile(resolve(folder, 'metadata.json'), 'utf8'),
          );
        if (
          meta.id !== id ||
          meta.kind !== kind ||
          basename(meta.filename) !== meta.filename
        )
          throw fail(500, '资料索引损坏');
        const target = await realpath(resolve(folder, meta.filename));
        if (!target.startsWith(library + sep)) throw fail(403, '无效资料路径');
        return { meta, target };
      } catch (e) {
        if (e.code === 'ENOENT') throw fail(404, '资料不存在');
        throw e;
      }
    }
    async function searchableContent(meta, target) {
      if (
        !['articles', 'vocabulary'].includes(meta.kind) ||
        meta.mime === 'application/pdf' ||
        meta.size > 2 * 1024 * 1024
      )
        return '';
      const raw = await readFile(target, 'utf8');
      if (meta.mime.startsWith('application/json')) {
        try {
          const value = JSON.parse(raw);
          if (value?.format === 'ielts-practice') {
            return [
              value.material?.title,
              value.material?.body,
              value.response,
              value.notes,
              ...(Array.isArray(value.material?.questions)
                ? value.material.questions.flatMap((question) => [
                    question.prompt,
                    ...(question.options || []),
                  ])
                : []),
            ]
              .filter(Boolean)
              .join(' ');
          }
          return [value.word, value.meaning, value.example]
            .filter(Boolean)
            .join(' ');
        } catch {
          return raw;
        }
      }
      return raw;
    }
    function excerpt(value, query) {
      const cleaned = plain(value).slice(0, 200000);
      const at = cleaned.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
      const start = Math.max(0, at < 0 ? 0 : at - 58);
      const end = Math.min(cleaned.length, start + 150);
      return `${start ? '…' : ''}${cleaned.slice(start, end)}${end < cleaned.length ? '…' : ''}`;
    }
    let backupRunning = false;
    let activeWrites = 0;
    let writesDrained;
    function reserveWrite() {
      if (backupRunning)
        throw fail(409, '正在备份，请稍后重试；表单内容仍保留');
      activeWrites++;
      return () => {
        activeWrites--;
        if (!activeWrites) {
          writesDrained?.();
          writesDrained = undefined;
        }
      };
    }
    const waitForWrites = () =>
      activeWrites
        ? new Promise((resolve) => {
            writesDrained = resolve;
          })
        : Promise.resolve();
    let catalogRunning = null;
    async function catalog(force = false) {
      const path = resolve(library, 'resource-catalog.json');
      let cached = null;
      try {
        cached = JSON.parse(await readFile(path, 'utf8'));
      } catch {}
      const cacheAge = cached
          ? Date.now() - Date.parse(cached.updatedAt)
          : Infinity,
        cacheLifetime = cached?.staleTopics?.length
          ? 5 * 60 * 1000
          : 6 * 60 * 60 * 1000,
        fresh =
          cached && Array.isArray(cached.items) && cacheAge < cacheLifetime;
      if (fresh && !force) return { ...cached, stale: false };
      if (!catalogRunning)
        catalogRunning = queryCatalog()
          .then(async (items) => {
            const merged = mergeCatalog(items, cached?.items),
              value = { updatedAt: new Date().toISOString(), ...merged };
            await writeFile(path, JSON.stringify(value, null, 2), {
              mode: 0o600,
            });
            return { ...value, stale: value.staleTopics.length > 0 };
          })
          .catch(() => {
            const merged = mergeCatalog([], cached?.items);
            return {
              updatedAt: cached?.updatedAt || null,
              ...merged,
              stale: true,
            };
          })
          .finally(() => {
            catalogRunning = null;
          });
      return catalogRunning;
    }
    const server = createServer(async (req, res) => {
      let releaseWrite;
      try {
        const host = req.headers.host || '';
        const u = new URL(req.url, 'http://' + host);
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
          throw fail(403, '仅允许本机访问');
        if (u.pathname.startsWith('/api/library')) {
          if (
            req.headers['sec-fetch-site'] === 'cross-site' ||
            (req.headers.origin && req.headers.origin !== `http://${host}`)
          )
            throw fail(403, '不允许跨站访问本地资料');
          if (
            !['GET', 'HEAD'].includes(req.method) &&
            req.headers['x-ielts-local'] !== '1'
          )
            throw fail(403, '缺少本地请求标识');
          if (
            !['GET', 'HEAD'].includes(req.method) &&
            u.pathname !== '/api/library/backup'
          ) {
            releaseWrite = reserveWrite();
          }
          if (u.pathname === '/api/library/status' && req.method === 'GET') {
            json(res, 200, {
              available: true,
              directory: library,
              mode,
              maxUploadBytes: 90 * 1024 * 1024,
            });
            return;
          }
          if (u.pathname === '/api/library/items' && req.method === 'GET') {
            if (sqliteCatalog) {
              json(res, 200, { items: sqliteCatalog.list(), warnings: [] });
              return;
            }
            const items = [],
              warnings = [];
            for (const kind of kinds) {
              for (const entry of await readdir(resolve(library, kind), {
                withFileTypes: true,
              })) {
                if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
                try {
                  const { meta } = await item(kind, entry.name);
                  items.push(meta);
                } catch {
                  warnings.push(`${kind}/${entry.name}`);
                }
              }
            }
            items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            json(res, 200, { items, warnings });
            return;
          }
          if (u.pathname === '/api/library/search' && req.method === 'GET') {
            const query = text(u.searchParams.get('q') || '', 100, true),
              terms = query
                .normalize('NFKC')
                .toLocaleLowerCase()
                .split(/\s+/)
                .filter(Boolean),
              results = [];
            for (const kind of kinds) {
              const entries = sqliteCatalog
                ? sqliteCatalog
                    .list()
                    .filter((row) => row.kind === kind)
                    .map((row) => ({ name: row.id, isDirectory: () => true }))
                : await readdir(resolve(library, kind), {
                    withFileTypes: true,
                  });
              for (const entry of entries) {
                if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
                try {
                  const { meta, target } = await item(kind, entry.name),
                    content = await searchableContent(meta, target),
                    metadata = [
                      meta.title,
                      meta.source,
                      meta.skill,
                      meta.summary,
                      meta.kind,
                    ]
                      .filter(Boolean)
                      .join(' '),
                    haystack = `${metadata} ${content}`
                      .normalize('NFKC')
                      .toLocaleLowerCase();
                  if (!terms.every((term) => haystack.includes(term))) continue;
                  const titleMatch = terms.some((term) =>
                    meta.title.toLocaleLowerCase().includes(term),
                  );
                  results.push({
                    id: meta.id,
                    kind: meta.kind,
                    title: meta.title,
                    source: meta.source,
                    skill: meta.skill,
                    createdAt: meta.createdAt,
                    excerpt: excerpt(
                      content || meta.summary || meta.source,
                      terms[0],
                    ),
                    rank: titleMatch ? 0 : content ? 1 : 2,
                  });
                } catch {}
              }
            }
            results.sort(
              (a, b) =>
                a.rank - b.rank || b.createdAt.localeCompare(a.createdAt),
            );
            json(res, 200, { items: results.slice(0, 30) });
            return;
          }
          if (u.pathname === '/api/library/catalog' && req.method === 'GET') {
            const topic = u.searchParams.get('topic');
            if (topic && !catalogTopics[topic]) throw fail(400, '资源主题无效');
            const result = await catalog(u.searchParams.get('refresh') === '1');
            json(res, 200, {
              ...result,
              items: topic
                ? result.items.filter((entry) => entry.topic === topic)
                : result.items,
            });
            return;
          }
          if (
            u.pathname === '/api/library/import-url' &&
            req.method === 'POST'
          ) {
            const data = await jsonBody(req);
            let fetched;
            try {
              fetched = await fetchResource(text(data.url, 2000, true));
            } catch (e) {
              throw fail(400, e.message);
            }
            const url = fetched.url,
              fields = {
                title: data.title || '网页阅读材料',
                source: url,
                skill: data.skill,
                operationId: data.operationId,
                titleSource: data.title ? 'manual' : 'filename',
              };
            const audioExtension = Object.entries(audioMime).find(
              ([, mime]) => mime === fetched.mime,
            )?.[0];
            if (audioExtension) {
              const meta = await persist(
                'audio',
                {
                  ...fields,
                  title:
                    data.title ||
                    decodeURIComponent(
                      new URL(url).pathname.split('/').pop() || '链接音频',
                    ),
                  skill: 'listening',
                },
                'original' + audioExtension,
                fetched.body,
                fetched.mime,
              );
              json(res, 201, { item: meta, content: null, audioLinks: [] });
              return;
            }
            if (
              !['text/html', 'application/xhtml+xml', 'text/plain'].includes(
                fetched.mime,
              )
            )
              throw fail(
                400,
                '此链接不是可读取的网页正文或直接音频。暂不支持视频平台、PDF和需要登录的页面。',
              );
            let extracted;
            if (fetched.mime === 'text/plain') {
              extracted = {
                title: data.title || '链接文本',
                content: fetched.body.toString('utf8'),
                audioLinks: [],
              };
            } else {
              const temp = await mkdtemp(resolve(library, '.capture-'));
              try {
                const filename = resolve(temp, 'page.html');
                await writeFile(filename, fetched.body);
                const result = await runFile(
                  'python3',
                  [
                    resolve(project, 'scripts/extract-article.py'),
                    filename,
                    url,
                  ],
                  { timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
                );
                extracted = JSON.parse(result.stdout);
              } catch {
                throw fail(
                  422,
                  '没有提取到可用正文。页面可能依赖登录或动态加载，请换一个公开文章链接。',
                );
              } finally {
                await rm(temp, { recursive: true, force: true });
              }
            }
            if (extracted.content.length > 200000)
              throw fail(413, '正文太长，请选更短的文章或使用上传功能。');
            const meta = await persist(
              'articles',
              { ...fields, title: data.title || extracted.title },
              'article.md',
              Buffer.from(extracted.content),
              'text/plain; charset=utf-8',
            );
            json(res, 201, {
              item: meta,
              content: extracted.content,
              audioLinks: extracted.audioLinks,
              notice:
                '已提取网页文字，图片、交互题目和网站批改功能不会一同导入。',
            });
            return;
          }
          if (u.pathname === '/api/library/practice' && req.method === 'POST') {
            const d = await jsonBody(req),
              m = d.material;
            if (
              !m ||
              typeof m.id !== 'string' ||
              !['listening', 'reading', 'writing', 'speaking'].includes(
                m.skill,
              ) ||
              !validResourceRef(m.resourceRef) ||
              (sqliteCatalog &&
                (typeof d.operationId !== 'string' ||
                  !uuid.test(d.operationId))) ||
              !Array.isArray(d.answers) ||
              d.answers.length > 50
            )
              throw fail(400, '练习内容格式错误');
            const material = {
              id: text(m.id, 100, true),
              title: text(m.title, 200, true),
              skill: m.skill,
              body: text(m.body, 200000, true),
              label: text(m.label || '练习材料', 200),
              source: sourceUrl(m.source || ''),
              ...(m.resourceRef ? { resourceRef: m.resourceRef } : {}),
              questions: Array.isArray(m.questions)
                ? m.questions.slice(0, 50)
                : [],
              audioUrl:
                typeof m.audioUrl === 'string' &&
                m.audioUrl.startsWith('/api/library/items/audio/')
                  ? m.audioUrl
                  : null,
            };
            if (m.id === 'listening-centre-v1') {
              const audio = await persist(
                'audio',
                {
                  title: 'Community Centre — 原创合成听力',
                  source: '',
                  skill: 'listening',
                  operationId: d.operationId
                    ? childOperationId(d.operationId, 'audio')
                    : undefined,
                },
                'original.wav',
                await readFile(
                  resolve(staticDir, 'practice/community-centre.wav'),
                ),
                'audio/wav',
              );
              material.audioUrl = `/api/library/items/audio/${audio.id}/file`;
            }
            if (sqliteCatalog) {
              if (
                material.resourceRef?.kind === 'local-asset' &&
                !sqliteCatalog.exists(material.resourceRef.id)
              )
                throw fail(409, '练习来源资料不存在，请重新选择');
              for (const url of [material.audioUrl, d.recordingUrl]) {
                const linked =
                  typeof url === 'string' &&
                  /^\/api\/library\/items\/(?:audio|recordings)\/([^/]+)\/file$/.exec(
                    url,
                  );
                if (linked) {
                  const asset = sqliteCatalog.item(linked[1]);
                  if (asset.meta.repairRequired)
                    throw fail(409, '练习附件原文件缺失');
                }
              }
            }
            const attempt = {
              format: 'ielts-practice',
              version: 1,
              createdAt: sqliteCatalog
                ? sqliteCatalog.operationTimestamp(d.operationId)
                : new Date().toISOString(),
              material,
              answers: d.answers.map((v) => text(v, 5000)),
              response: text(d.response || '', 50000),
              notes: text(d.notes || '', 20000),
              recordingUrl:
                typeof d.recordingUrl === 'string' &&
                /^\/api\/library\/items\/recordings\/[a-f0-9-]+\/file$/.test(
                  d.recordingUrl,
                )
                  ? d.recordingUrl
                  : null,
            };
            const meta = await persist(
              'articles',
              {
                title: material.title + ' · 练习档案',
                source: material.source,
                skill: material.skill,
                summary: '材料、作答与笔记',
                operationId: d.operationId,
                createdAt: attempt.createdAt,
              },
              'practice.json',
              Buffer.from(JSON.stringify(attempt, null, 2)),
              'application/json; charset=utf-8',
            );
            json(res, 201, { item: meta, attempt });
            return;
          }
          if (u.pathname === '/api/library/text' && req.method === 'POST') {
            const d = await jsonBody(req);
            if (d.kind === 'articles') {
              const content = text(d.content, 1000000, true);
              json(
                res,
                201,
                await persist(
                  'articles',
                  d,
                  'article.md',
                  Buffer.from(content),
                  'text/plain; charset=utf-8',
                ),
              );
              return;
            }
            if (d.kind === 'vocabulary') {
              const word = text(d.title, 200, true),
                meaning = text(d.meaning, 5000, true),
                example = text(d.example || '', 10000);
              const content = JSON.stringify(
                { word, meaning, example },
                null,
                2,
              );
              json(
                res,
                201,
                await persist(
                  'vocabulary',
                  { ...d, summary: meaning.slice(0, 180) },
                  'word.json',
                  Buffer.from(content),
                  'application/json; charset=utf-8',
                ),
              );
              return;
            }
            throw fail(400, '不支持此文本分类');
          }
          if (u.pathname === '/api/library/upload' && req.method === 'POST') {
            const kind = u.searchParams.get('kind'),
              name = u.searchParams.get('name') || '',
              ext = extname(name).toLowerCase();
            const mime =
              kind === 'articles'
                ? {
                    '.txt': 'text/plain; charset=utf-8',
                    '.md': 'text/plain; charset=utf-8',
                    '.pdf': 'application/pdf',
                  }[ext]
                : ['audio', 'recordings'].includes(kind)
                  ? audioMime[ext]
                  : null;
            if (!mime) throw fail(400, '不支持此文件类型');
            const content = await body(req, 90 * 1024 * 1024);
            if (!content.length) throw fail(400, '不能保存空文件');
            const fields = {
              title: u.searchParams.get('title') || name,
              source: u.searchParams.get('source') || '',
              skill: u.searchParams.get('skill'),
              operationId: u.searchParams.get('operationId'),
              titleSource:
                !u.searchParams.get('title') ||
                u.searchParams.get('title') === name
                  ? 'filename'
                  : 'manual',
            };
            json(
              res,
              201,
              await persist(kind, fields, 'original' + ext, content, mime),
            );
            return;
          }
          const organizationRoute =
            /^\/api\/library\/items\/([^/]+)\/([^/]+)\/organization(\/suggestions)?$/.exec(
              u.pathname,
            );
          if (
            organizationRoute &&
            (req.method === 'PATCH' ||
              (req.method === 'POST' && organizationRoute[3]))
          ) {
            if (!sqliteCatalog)
              throw fail(
                409,
                '当前旧目录不支持资料整理，请使用独立 SQLite 资料目录',
              );
            const existing = await item(
              organizationRoute[1],
              organizationRoute[2],
            );
            if (organizationRoute[3]) {
              json(res, 200, {
                suggestions: sqliteCatalog.refreshSuggestions(
                  existing.meta.id,
                ),
              });
            } else {
              const data = await jsonBody(req);
              json(
                res,
                200,
                sqliteCatalog.saveOrganization(existing.meta.id, {
                  revision: data.revision,
                  remark: data.remark,
                  notes: data.notes,
                  tagIds: data.tagIds,
                  customTags: data.customTags,
                  placeIds: data.placeIds,
                }),
              );
            }
            return;
          }
          const editRoute =
            /^\/api\/library\/items\/([^/]+)\/([^/]+)(\/extract)?$/.exec(
              u.pathname,
            );
          if (
            editRoute &&
            (req.method === 'PATCH' || (req.method === 'POST' && editRoute[3]))
          ) {
            if (!sqliteCatalog)
              throw fail(
                409,
                '当前旧目录不支持编辑，请使用独立 SQLite 资料目录',
              );
            const existing = await item(editRoute[1], editRoute[2]);
            let meta;
            if (editRoute[3]) {
              if (!existing.meta.canExtract)
                throw fail(400, '此文件格式没有自动元数据提取入口');
              if (existing.meta.repairRequired)
                throw fail(409, '原文件缺失，请恢复后重试');
              const result = await metadataProbe(existing.target);
              meta = sqliteCatalog.recordExtraction(existing.meta.id, result);
            } else {
              const data = await jsonBody(req);
              if (!kinds.includes(data.kind))
                throw fail(400, '请选择有效资料类别');
              if (
                data.durationSeconds !== null &&
                (typeof data.durationSeconds !== 'number' ||
                  !Number.isFinite(data.durationSeconds) ||
                  data.durationSeconds < 0)
              )
                throw fail(400, '时长必须为空或非负秒数');
              const fields = {
                operationId: data.operationId,
                revision: data.revision,
                title: text(data.title, 200, true),
                summary: text(data.summary ?? '', 5000),
                source: sourceUrl(data.source),
                kind: data.kind,
                skill: data.skill,
                durationSeconds: data.durationSeconds,
              };
              if (data.content !== undefined) {
                text(data.content, 1000000, true);
                fields.content = data.content;
              }
              meta = sqliteCatalog.edit(existing.meta.id, fields);
            }
            const result = sqliteCatalog.item(meta.id);
            json(res, 200, {
              item: result.meta,
              organization: sqliteCatalog.organization(meta.id),
              content:
                !result.meta.repairRequired &&
                (result.meta.mime.startsWith('text/') ||
                  result.meta.mime.startsWith('application/json')) &&
                result.meta.size <= 2 * 1024 * 1024
                  ? await readFile(result.target, 'utf8')
                  : null,
            });
            return;
          }
          const match =
            /^\/api\/library\/items\/([^/]+)\/([^/]+)(\/file)?$/.exec(
              u.pathname,
            );
          if (match && ['GET', 'HEAD'].includes(req.method)) {
            const { meta, target } = await item(match[1], match[2]);
            if (meta.repairRequired) {
              if (match[3]) throw fail(409, '原文件缺失，请从备份恢复');
              json(res, 200, {
                item: meta,
                content: null,
                repairRequired: true,
                ...(sqliteCatalog
                  ? { organization: sqliteCatalog.organization(meta.id) }
                  : {}),
              });
              return;
            }
            if (match[3]) {
              await sendFile(
                req,
                res,
                target,
                meta.mime,
                u.searchParams.has('download') ||
                  meta.mime === 'application/pdf'
                  ? meta.title + extname(meta.filename)
                  : null,
              );
            } else {
              const textContent =
                (meta.mime.startsWith('text/') ||
                  meta.mime.startsWith('application/json')) &&
                meta.size <= 2 * 1024 * 1024
                  ? await readFile(target, 'utf8')
                  : null;
              json(res, 200, {
                item: meta,
                content: textContent,
                ...(sqliteCatalog
                  ? { organization: sqliteCatalog.organization(meta.id) }
                  : {}),
              });
            }
            return;
          }
          if (u.pathname === '/api/library/backup' && req.method === 'POST') {
            if (backupRunning) throw fail(409, '备份正在生成，请稍候');
            backupRunning = true;
            try {
              await backupHook?.('waiting');
              await waitForWrites();
              await backupHook?.('locked');
              const data = await jsonBody(req);
              let progressPath;
              if (data.progress) {
                let p;
                try {
                  p = parseProgress(JSON.stringify(data.progress));
                } catch (error) {
                  throw fail(400, error.message);
                }
                progressPath = `progress/${randomUUID()}.json`;
                await writeFile(
                  resolve(library, progressPath),
                  JSON.stringify(p, null, 2),
                  { flag: 'wx', mode: 0o600 },
                );
              }
              const id = randomUUID(),
                dest = resolve(library, 'backups', id + '.zip');
              await new Promise((ok, reject) => {
                const child = spawn(
                  'python3',
                  [
                    resolve(project, 'scripts/backup-library.py'),
                    library,
                    dest,
                    '--lock-fd',
                    '3',
                    ...(progressPath ? ['--progress', progressPath] : []),
                  ],
                  { stdio: ['ignore', 'pipe', 'pipe', directoryLock.fd] },
                );
                void backupHook?.('spawned', child);
                let error = '';
                child.stderr.on('data', (chunk) => {
                  error += chunk;
                });
                child.once('error', reject);
                child.once('exit', (code) =>
                  code === 0
                    ? ok()
                    : reject(
                        fail(
                          409,
                          error.trim().split('\n').at(-1) ||
                            '备份失败，请检查资料完整性',
                        ),
                      ),
                );
              });
              json(res, 201, {
                downloadUrl: `/api/library/backups/${id}`,
                path: dest,
              });
            } finally {
              backupRunning = false;
            }
            return;
          }
          const backup = /^\/api\/library\/backups\/([^/]+)$/.exec(u.pathname);
          if (
            backup &&
            ['GET', 'HEAD'].includes(req.method) &&
            uuid.test(backup[1])
          ) {
            await sendFile(
              req,
              res,
              resolve(library, 'backups', backup[1] + '.zip'),
              'application/zip',
              'ielts-study-library.zip',
            );
            return;
          }
          throw fail(404, '本地资料接口不存在');
        }
        if (!['GET', 'HEAD'].includes(req.method))
          throw fail(405, 'Method not allowed');
        const path = decodeURIComponent(u.pathname),
          target = resolve(
            staticDir,
            '.' + (path === '/' ? '/index.html' : path),
          );
        if (!target.startsWith(resolve(staticDir) + sep))
          throw fail(403, 'Invalid path');
        await sendFile(
          req,
          res,
          target,
          staticMime[extname(target)] || 'application/octet-stream',
          null,
        );
      } catch (e) {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        json(res, e.status || (e.code === 'ENOENT' ? 404 : 500), {
          error: e.status
            ? e.message
            : e.code === 'ENOENT'
              ? '文件不存在'
              : '本地保存失败，请检查目录权限与磁盘空间',
        });
      } finally {
        releaseWrite?.();
      }
    });
    // Storage-only edits in later tasks must use this same coordinator.
    server.withLibraryWrite = async (action) => {
      const release = reserveWrite();
      try {
        return await action();
      } finally {
        release();
      }
    };
    server.on('close', () => {
      sqliteCatalog?.close();
      directoryLock.close();
    });
    return server;
  } catch (error) {
    sqliteCatalog?.close();
    directoryLock.close();
    throw error;
  }
}
