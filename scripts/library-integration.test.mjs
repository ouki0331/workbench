import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createLibraryServer } from './library-server.mjs';
import { emptyProgress, parseProgress } from '../lib/progress.ts';
const run = promisify(execFile);
const deferred = () => {
  let resolve;
  const promise = new Promise((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
};
const article = (extra = {}) => ({
  operationId: randomUUID(),
  kind: 'articles',
  title: '素材正文',
  skill: 'reading',
  source: 'https://example.org/article',
  content: 'Stable original content. 国际金融新闻。',
  ...extra,
});
async function setup(t, options = {}, existing) {
  const work = existing || (await mkdtemp(join(tmpdir(), 'ielts-dev002-')));
  const library = existing || join(work, 'library');
  const databasePath = join(library, 'workbench.sqlite3');
  let server, base;
  const start = async () => {
    server = await createLibraryServer({
      libraryDir: library,
      databasePath,
      mode: 'sqlite',
      staticDir: resolve('public'),
      ...options,
    });
    await new Promise((ok, no) => {
      server.once('error', no);
      server.listen(0, '127.0.0.1', ok);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
      server = null;
    }
  };
  const request = async (path, data, raw = false) => {
    const response = await fetch(
      base + path,
      data === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
              'X-IELTS-Local': '1',
              'Content-Type': raw
                ? 'application/octet-stream'
                : 'application/json',
            },
            body: raw ? data : JSON.stringify(data),
          },
    );
    return { status: response.status, data: await response.json() };
  };
  const post = async (path, data, raw = false) => {
    const result = await request(path, data, raw);
    assert.equal(result.status, 201, JSON.stringify(result));
    return result.data;
  };
  t.after(async () => {
    await stop();
    if (!existing) await rm(work, { recursive: true, force: true });
  });
  return {
    library,
    databasePath,
    work,
    start,
    stop,
    request,
    post,
    base: () => base,
    server: () => server,
  };
}
function uploadQuery(kind, name, extra = {}) {
  return (
    '/api/library/upload?' +
    new URLSearchParams({
      kind,
      name,
      title: name,
      skill:
        kind === 'recordings'
          ? 'speaking'
          : kind === 'audio'
            ? 'listening'
            : 'reading',
      operationId: randomUUID(),
      ...extra,
    })
  );
}
function practice(material, extra = {}) {
  return {
    operationId: randomUUID(),
    material,
    answers: ['an answer'],
    response: 'My response',
    notes: 'A note',
    ...extra,
  };
}
function progressFor(id) {
  const refs = [
    { kind: 'local-asset', id },
    { kind: 'builtin', id: 'reading-trade-rules-v1' },
    { kind: 'external', id: 'https://example.org/original' },
    { kind: 'vocabulary', id: 'resilient' },
    null,
  ];
  return {
    ...emptyProgress,
    sessions: [
      {
        id: 'session',
        date: '2026-09-19',
        skill: 'reading',
        minutes: 10,
        score: null,
        note: 'retained note',
      },
    ],
    activities: refs.map((ref, i) => ({
      id: 'event-' + i,
      date: '2026-09-19',
      at: '2026-09-19T03:00:00Z',
      moduleId: 'ielts',
      subjectId: 'reading',
      kind: 'article-opened',
      resourceId: ref?.id || 'old-unknown',
      ...(ref ? { resourceRef: ref } : {}),
      label: 'Source ' + i,
      seconds: 0,
    })),
    reviews: {
      cards: [
        {
          id: 'card',
          sourceId: id,
          resourceRef: { kind: 'local-asset', id },
          sourceKind: 'practice',
          front: 'Question',
          back: 'Answer',
          context: 'Context',
          createdDate: '2026-09-19',
          dueDate: '2026-09-20',
          intervalDays: 1,
          ease: 2.5,
          repetitions: 1,
          lapses: 0,
          lastReviewedDate: '2026-09-19',
        },
      ],
      events: [
        {
          id: 'review',
          cardId: 'card',
          date: '2026-09-19',
          rating: 'good',
          intervalDays: 1,
        },
      ],
    },
  };
}

test('all SQLite save entrances share stable assets, bytes and practice retries across restart', async (t) => {
  const h = await setup(t, {
    fetchResource: async (url) => {
      if (url.endsWith('/offline')) throw Error('network unavailable');
      return {
        url,
        mime: url.endsWith('.wav') ? 'audio/wav' : 'text/plain',
        body: Buffer.from(
          url.endsWith('.wav')
            ? [0, 255, 1, 254]
            : 'An imported public article.',
        ),
      };
    },
  });
  await h.start();
  const saved = [];
  const text = await h.post('/api/library/text', article());
  saved.push(text);
  const word = await h.post('/api/library/text', {
    operationId: randomUUID(),
    kind: 'vocabulary',
    title: 'resilient',
    meaning: '有韧性',
    example: 'A resilient community.',
    skill: 'vocabulary',
  });
  saved.push(word);
  for (const [kind, name, bytes] of [
    ['articles', 'text.txt', Buffer.from('TXT正文')],
    ['articles', 'markdown.md', Buffer.from('# MD正文')],
    ['articles', 'paper.pdf', Buffer.from('%PDF-1.4\nfixture')],
    ['audio', 'sample.wav', Buffer.from([0, 255, 128, 42])],
    ['recordings', 'voice.webm', Buffer.from([0, 254, 129, 43])],
  ]) {
    const path = uploadQuery(kind, name);
    const item = await h.post(path, bytes, true);
    saved.push(item);
    assert.equal((await h.post(path, bytes, true)).id, item.id);
    assert.equal(
      (await h.request(path, Buffer.from([0xfe]), true)).status,
      409,
    );
    const download = await fetch(
      h.base() + `/api/library/items/${kind}/${item.id}/file`,
    );
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  }
  for (const url of [
    'https://example.org/text',
    'https://example.org/sample.wav',
  ]) {
    const input = { url, skill: 'reading', operationId: randomUUID() };
    const imported = await h.post('/api/library/import-url', input);
    saved.push(imported.item);
    assert.equal(
      (await h.post('/api/library/import-url', input)).item.id,
      imported.item.id,
    );
  }
  assert.equal(
    (
      await h.request('/api/library/import-url', {
        url: 'https://example.org/offline',
        skill: 'reading',
        operationId: randomUUID(),
      })
    ).status,
    400,
  );
  const material = {
    id: text.id,
    title: 'Reusable material',
    skill: 'reading',
    source: text.source,
    body: 'Original study body',
    resourceRef: text.resourceRef,
    questions: [],
  };
  const input = practice(material);
  const first = await h.post('/api/library/practice', input);
  saved.push(first.item);
  const again = await h.post('/api/library/practice', input);
  assert.deepEqual(again, first);
  const second = await h.post('/api/library/practice', practice(material));
  saved.push(second.item);
  assert.notEqual(first.item.id, second.item.id);
  const builtin = practice({
    ...material,
    id: 'listening-centre-v1',
    skill: 'listening',
    resourceRef: { kind: 'builtin', id: 'listening-centre-v1' },
  });
  const builtinResult = await h.post('/api/library/practice', builtin);
  saved.push(builtinResult.item);
  assert.deepEqual(
    await h.post('/api/library/practice', builtin),
    builtinResult,
  );
  assert.equal(
    (await h.request('/api/library/items')).data.items.length,
    saved.length + 1,
  ); // one stable built-in audio child
  assert.equal(
    (
      await h.request(
        '/api/library/practice',
        practice({
          ...material,
          resourceRef: { kind: 'local-asset', id: randomUUID() },
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await h.request(
        '/api/library/practice',
        practice({ ...material, resourceRef: { kind: 'invalid', id: 'bad' } }),
      )
    ).status,
    400,
  );
  await h.stop();
  await h.start();
  for (const item of saved) {
    const result = await h.request(
      `/api/library/items/${item.kind}/${item.id}`,
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.item, item);
  }
  assert.deepEqual(await h.post('/api/library/practice', input), first);
  const db = new DatabaseSync(h.databasePath);
  await h
    .server()
    .withLibraryWrite(() =>
      db
        .prepare("UPDATE resources SET kind='vocabulary' WHERE id=?")
        .run(text.id),
    );
  db.close();
  assert.equal(
    (await h.request(`/api/library/items/articles/${text.id}`)).data.item.kind,
    'vocabulary',
  );
  assert.equal(
    await (
      await fetch(h.base() + `/api/library/items/articles/${text.id}/file`)
    ).text(),
    article().content,
  );
});

test('SQLite backup verifies DB/files/five reference classes and restores explicit progress with stable playback', async (t) => {
  const h = await setup(t);
  await h.start();
  const source = await h.post('/api/library/text', article());
  const audio = await h.post(
    uploadQuery('audio', 'sample.wav'),
    await readFile('public/practice/community-centre.wav'),
    true,
  );
  const recording = await h.post(
    uploadQuery('recordings', 'voice.wav'),
    await readFile('public/practice/community-centre.wav'),
    true,
  );
  const archived = await h.post(
    '/api/library/practice',
    practice(
      {
        id: source.id,
        title: 'Archived study',
        skill: 'listening',
        source: source.source,
        body: 'Body',
        questions: [],
        resourceRef: source.resourceRef,
        audioUrl: `/api/library/items/audio/${audio.id}/file`,
      },
      { recordingUrl: `/api/library/items/recordings/${recording.id}/file` },
    ),
  );
  const progress = progressFor(archived.item.id);
  const result = await h.post('/api/library/backup', { progress });
  const restored = join(h.work, 'restored');
  await run('python3', ['scripts/restore-library.py', result.path, restored]);
  const manifest = JSON.parse(
    await readFile(join(restored, 'backup-manifest.json'), 'utf8'),
  );
  assert.equal(manifest.mode, 'sqlite');
  assert.equal(manifest.schemaVersions.at(-1), '010');
  assert.ok(manifest.files.some((f) => f.path === '.library-mode.json'));
  for (const kind of [
    'local-asset',
    'builtin',
    'external',
    'vocabulary',
    'legacy',
  ])
    assert.ok(manifest.references.some((ref) => ref.kind === kind));
  assert.equal(
    manifest.references.find((ref) => ref.kind === 'legacy').status,
    'unresolved',
  );
  const recoveredProgress = parseProgress(
    await readFile(join(restored, manifest.progress.path), 'utf8'),
  );
  assert.deepEqual(recoveredProgress, parseProgress(JSON.stringify(progress)));
  const r = await setup(t, {}, restored);
  await r.start();
  const cardSource = await r.request(
    `/api/library/items/articles/${recoveredProgress.reviews.cards[0].resourceRef.id}`,
  );
  const attempt = JSON.parse(cardSource.data.content);
  assert.equal(attempt.material.resourceRef.id, source.id);
  for (const url of [attempt.material.audioUrl, attempt.recordingUrl]) {
    const playback = await fetch(r.base() + url, {
      headers: { Range: 'bytes=0-43' },
    });
    assert.equal(playback.status, 206);
    assert.equal((await playback.arrayBuffer()).byteLength, 44);
  }
  await r.stop();
  await assert.rejects(
    run('python3', ['scripts/restore-library.py', result.path, restored]),
    /不会覆盖/,
  );
  const corrupted = join(h.work, 'corrupted.zip');
  await run('python3', [
    '-c',
    "import sys,zipfile; a=zipfile.ZipFile(sys.argv[1]); b=zipfile.ZipFile(sys.argv[2],'w'); [(b.writestr(n,b'wrong' if n.endswith('article.md') else a.read(n))) for n in a.namelist()]; b.close()",
    result.path,
    corrupted,
  ]);
  await assert.rejects(
    run('python3', [
      'scripts/restore-library.py',
      corrupted,
      join(h.work, 'bad'),
    ]),
    /校验失败/,
  );
  const traversal = join(h.work, 'traversal.zip');
  await run('python3', [
    '-c',
    "import sys,zipfile; a=zipfile.ZipFile(sys.argv[1],'w'); a.writestr('ielts-study-library/../escape','x');a.close()",
    traversal,
  ]);
  await assert.rejects(
    run('python3', [
      'scripts/restore-library.py',
      traversal,
      join(h.work, 'escape-target'),
    ]),
    /路径无效/,
  );
});

test('backup drains accepted writes and rejects saves and synthetic edits/deletes while locked', async (t) => {
  const fetching = deferred(),
    finishFetch = deferred(),
    waiting = deferred(),
    locked = deferred(),
    release = deferred();
  const h = await setup(t, {
    fetchResource: async (url) => {
      fetching.resolve();
      await finishFetch.promise;
      return {
        url,
        mime: 'text/plain',
        body: Buffer.from('accepted before backup'),
      };
    },
    backupHook: async (stage) => {
      if (stage === 'waiting') waiting.resolve();
      if (stage === 'locked') {
        locked.resolve();
        await release.promise;
      }
    },
  });
  await h.start();
  const existing = await h.post('/api/library/text', article());
  const inFlight = h.post('/api/library/import-url', {
    operationId: randomUUID(),
    url: 'https://example.org/slow',
    skill: 'reading',
  });
  await fetching.promise;
  const saving = h.post('/api/library/backup', { progress: emptyProgress });
  await waiting.promise;
  assert.equal((await h.request('/api/library/text', article())).status, 409);
  finishFetch.resolve();
  const imported = await inFlight;
  await locked.promise;
  const db = new DatabaseSync(h.databasePath);
  db.exec('PRAGMA foreign_keys=ON');
  await assert.rejects(
    h
      .server()
      .withLibraryWrite(() =>
        db
          .prepare("UPDATE resources SET title='changed' WHERE id=?")
          .run(existing.id),
      ),
    /正在备份/,
  );
  await assert.rejects(
    h
      .server()
      .withLibraryWrite(() =>
        db.prepare('DELETE FROM resources WHERE id=?').run(existing.id),
      ),
    /正在备份/,
  );
  assert.equal((await h.request('/api/library/items')).status, 200);
  release.resolve();
  const backup = await saving;
  await h
    .server()
    .withLibraryWrite(() =>
      db
        .prepare("UPDATE resources SET title='changed after backup' WHERE id=?")
        .run(existing.id),
    );
  await h.server().withLibraryWrite(async () => {
    db.prepare('DELETE FROM resources WHERE id=?').run(imported.item.id);
    await rm(join(h.library, 'articles', imported.item.id), {
      recursive: true,
    });
  });
  db.close();
  const restored = join(h.work, 'at-backup');
  await run('python3', ['scripts/restore-library.py', backup.path, restored]);
  const snapshot = new DatabaseSync(join(restored, 'workbench.sqlite3'));
  assert.equal(
    snapshot.prepare('SELECT title FROM resources WHERE id=?').get(existing.id)
      .title,
    existing.title,
  );
  assert.equal(
    snapshot.prepare('SELECT COUNT(*) AS n FROM resources').get().n,
    2,
  );
  snapshot.close();
  assert.equal((await h.request('/api/library/items')).data.items.length, 1);
});

test('failed integrity, missing local refs and child crashes never publish a success ZIP; retry and locks recover', async (t) => {
  let killBackup = false;
  const h = await setup(t, {
    backupHook(stage, child) {
      if (stage === 'spawned' && killBackup) child.kill('SIGKILL');
    },
  });
  await h.start();
  const source = await h.post('/api/library/text', article());
  const path = join(h.library, 'articles', source.id, source.filename);
  const original = await readFile(path);
  await writeFile(path, 'corrupted');
  assert.equal(
    (await h.request('/api/library/backup', { progress: emptyProgress }))
      .status,
    409,
  );
  await rm(path);
  assert.equal(
    (await h.request('/api/library/backup', { progress: emptyProgress }))
      .status,
    409,
  );
  assert.equal((await readdir(join(h.library, 'backups'))).length, 0);
  await writeFile(path, original);
  assert.equal(
    (
      await h.request('/api/library/backup', {
        progress: progressFor(randomUUID()),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await h.request('/api/library/backup', {
        progress: { version: 1, profile: {}, sessions: [] },
      })
    ).status,
    400,
  );
  killBackup = true;
  assert.equal(
    (await h.request('/api/library/backup', { progress: emptyProgress }))
      .status,
    409,
  );
  killBackup = false;
  await h.post('/api/library/backup', { progress: emptyProgress });
  await assert.rejects(
    createLibraryServer({
      libraryDir: h.library,
      databasePath: h.databasePath,
      mode: 'sqlite',
    }),
    /另一服务/,
  );
  await assert.rejects(
    run(process.execPath, ['scripts/init-database.mjs'], {
      env: {
        ...process.env,
        IELTS_LIBRARY_DIR: h.library,
        IELTS_DB_PATH: h.databasePath,
      },
    }),
    /另一服务/,
  );
  await assert.rejects(
    run('python3', [
      'scripts/backup-library.py',
      h.library,
      join(h.work, 'offline.zip'),
    ]),
    /服务正在运行/,
  );
  await h.stop();
  await run('python3', [
    'scripts/backup-library.py',
    h.library,
    join(h.work, 'offline.zip'),
  ]);
  await h.start();
  await h.post('/api/library/text', article());
});

test('a live backup child retains ownership after its server is killed; final descriptor release allows restart', async (t) => {
  const h = await setup(t);
  const listening = deferred(),
    spawnedBackup = deferred();
  let backupPid;
  const worker = spawn(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
    import { createLibraryServer } from './scripts/library-server.mjs';
    const server = await createLibraryServer({ libraryDir: process.env.IELTS_LIBRARY_DIR, databasePath: process.env.IELTS_DB_PATH, mode:'sqlite', backupHook(stage, child) {
      if(stage === 'spawned') { child.kill('SIGSTOP'); console.log('BACKUP_PID=' + child.pid); }
    } });
    server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port));
  `,
    ],
    {
      cwd: resolve('.'),
      env: {
        ...process.env,
        IELTS_LIBRARY_DIR: h.library,
        IELTS_DB_PATH: h.databasePath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const exited = new Promise((ok) =>
    worker.once('exit', (code, signal) => ok({ code, signal })),
  );
  let output = '';
  worker.stdout.on('data', (chunk) => {
    output += chunk;
    const port = /PORT=(\d+)/.exec(output);
    if (port) listening.resolve(Number(port[1]));
    const pid = /BACKUP_PID=(\d+)/.exec(output);
    if (pid) {
      backupPid = Number(pid[1]);
      spawnedBackup.resolve();
    }
  });
  t.after(() => {
    worker.kill('SIGKILL');
    if (backupPid) {
      try {
        process.kill(backupPid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  });
  const port = await listening.promise;
  const pending = fetch(`http://127.0.0.1:${port}/api/library/backup`, {
    method: 'POST',
    headers: { 'X-IELTS-Local': '1' },
    body: JSON.stringify({ progress: emptyProgress }),
  }).catch((error) => error);
  await spawnedBackup.promise;
  worker.kill('SIGKILL');
  assert.equal((await exited).signal, 'SIGKILL');
  assert.ok((await pending) instanceof Error);
  await assert.rejects(
    createLibraryServer({
      libraryDir: h.library,
      databasePath: h.databasePath,
      mode: 'sqlite',
    }),
    /另一服务/,
  );
  process.kill(backupPid, 'SIGKILL');
  backupPid = null;
  assert.equal(
    (await readdir(join(h.library, 'backups'))).filter((name) =>
      name.endsWith('.zip'),
    ).length,
    0,
  );
  await h.start();
  await h.post('/api/library/text', article());
  await h.post('/api/library/backup', { progress: emptyProgress });
});
