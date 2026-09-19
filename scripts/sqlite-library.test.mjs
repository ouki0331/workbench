import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createLibraryServer } from './library-server.mjs';
import { initializeDatabase } from './init-database.mjs';

const fixture = (extra = {}) => ({
  kind: 'articles',
  title: '文本测试',
  content: '# Markdown\n国际金融新闻 and a second line.',
  skill: 'reading',
  source: '',
  operationId: randomUUID(),
  ...extra,
});
async function harness(t, options = {}) {
  const work = await mkdtemp(join(tmpdir(), 'ielts-sqlite-test-'));
  const library = join(work, 'library');
  const databasePath = join(library, 'workbench.sqlite3');
  let server, base;
  const stop = async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise((ok) => server.close(ok));
    server = null;
  };
  const start = async (extra = {}) => {
    server = await createLibraryServer({
      libraryDir: library,
      databasePath,
      mode: 'sqlite',
      ...options,
      ...extra,
    });
    await new Promise((ok, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', ok);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const request = async (path, data) => {
    const response = await fetch(
      base + path,
      data === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
              'X-IELTS-Local': '1',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          },
    );
    return { status: response.status, data: await response.json() };
  };
  t.after(async () => {
    await stop();
    await rm(work, { recursive: true, force: true });
  });
  return { library, databasePath, start, stop, request };
}

test('SQLite text flow: repeated sources, ownership, idempotency, restart and missing file', async (t) => {
  const h = await harness(t);
  await h.start();
  assert.equal((await h.request('/api/library/status')).data.mode, 'sqlite');
  const inputs = [
    fixture(),
    fixture({ source: '   ', skill: 'writing' }),
    fixture({ source: 'https://example.com/same' }),
    fixture({ source: 'https://example.com/same' }),
  ];
  const saved = [];
  for (const input of inputs) {
    const result = await h.request('/api/library/text', input);
    assert.equal(result.status, 201, JSON.stringify(result));
    assert.equal(result.data.ownerUserId, 'user-local-default');
    assert.equal(result.data.subjectId, `subject-ielts-${input.skill}`);
    assert.equal(result.data.moduleId, 'module-ielts');
    saved.push(result.data);
  }
  const retry = await h.request('/api/library/text', inputs[0]);
  assert.equal(retry.data.id, saved[0].id);
  assert.equal(
    (await h.request('/api/library/text', { ...inputs[0], content: 'changed' }))
      .status,
    409,
  );
  for (const extra of [
    { skill: 'bad' },
    { moduleId: 'wrong' },
    { subjectId: 'wrong' },
    { ownerUserId: 'wrong' },
    { title: '' },
  ])
    assert.equal(
      (await h.request('/api/library/text', fixture(extra))).status,
      400,
    );
  const db = new DatabaseSync(h.databasePath);
  assert.equal(
    db
      .prepare('SELECT COUNT(*) AS n FROM resources WHERE source_url IS NULL')
      .get().n,
    2,
  );
  db.prepare(
    "UPDATE subjects SET status='archived' WHERE key='speaking'",
  ).run();
  assert.equal(
    (await h.request('/api/library/text', fixture({ skill: 'speaking' })))
      .status,
    400,
  );
  db.prepare(
    "UPDATE users SET status='disabled' WHERE id='user-local-default'",
  ).run();
  assert.equal((await h.request('/api/library/text', fixture())).status, 400);
  db.prepare(
    "UPDATE users SET status='active' WHERE id='user-local-default'",
  ).run();
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
  const phantom = join(h.library, 'articles', randomUUID());
  await mkdir(phantom);
  await writeFile(
    join(phantom, 'metadata.json'),
    JSON.stringify({ id: phantom, title: 'not in SQLite' }),
  );
  assert.equal((await h.request('/api/library/items')).data.items.length, 4);
  assert.equal(
    (await h.request('/api/library/search?q=金融')).data.items.length,
    4,
  );
  await h.stop();
  await h.start();
  for (let i = 0; i < saved.length; i++) {
    const result = await h.request(
      `/api/library/items/articles/${saved[i].id}`,
    );
    assert.equal(result.data.content, inputs[i].content);
    assert.deepEqual(result.data.item, saved[i]);
    assert.equal(
      (await readdir(join(h.library, 'articles', saved[i].id))).includes(
        'metadata.json',
      ),
      false,
    );
  }
  await rm(join(h.library, 'articles', saved[0].id, 'article.md'));
  const missing = await h.request(`/api/library/items/articles/${saved[0].id}`);
  assert.equal(missing.status, 200);
  assert.equal(missing.data.item.repairRequired, true);
  assert.equal(missing.data.content, null);
  assert.equal(
    (await h.request(`/api/library/items/articles/${saved[0].id}/file`)).status,
    409,
  );
});

test('exception compensation before file and around DB commit; retry keeps stable ID', async (t) => {
  for (const point of [
    'before-file',
    'after-file',
    'before-commit',
    'after-commit',
  ]) {
    let inject = true;
    const h = await harness(t, {
      fault: (stage) => {
        if (inject && stage === point) throw Error('injected failure');
      },
    });
    await h.start();
    const input = fixture();
    assert.equal((await h.request('/api/library/text', input)).status, 500);
    const db = new DatabaseSync(h.databasePath);
    const op = db.prepare('SELECT * FROM resource_writes').get();
    db.close();
    const items = (await h.request('/api/library/items')).data.items;
    assert.equal(items.length, point === 'after-commit' ? 1 : 0);
    assert.equal(
      (await readdir(join(h.library, 'articles'))).length,
      items.length,
    );
    inject = false;
    const retry = await h.request('/api/library/text', input);
    assert.equal(retry.status, 201);
    assert.equal(retry.data.id, op.resource_id);
    await h.stop();
    await h.start();
    assert.equal((await h.request('/api/library/items')).data.items.length, 1);
  }
});

test('process kill at each save window recovers without a ghost or duplicate', async (t) => {
  for (const point of [
    'before-file',
    'after-file',
    'before-commit',
    'after-commit',
  ]) {
    const h = await harness(t);
    const input = fixture();
    const worker = spawn(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
      import { createLibraryServer } from './scripts/library-server.mjs';
      const server = await createLibraryServer({ libraryDir: process.env.IELTS_LIBRARY_DIR, databasePath: process.env.IELTS_DB_PATH, mode:'sqlite', fault(stage) { if(stage === '${point}') process.kill(process.pid, 'SIGKILL'); } });
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
    const exit = new Promise((ok) =>
      worker.once('exit', (code, signal) => ok({ code, signal })),
    );
    const port = await new Promise((ok, reject) => {
      let output = '';
      worker.stdout.on('data', (chunk) => {
        output += chunk;
        const m = /PORT=(\d+)/.exec(output);
        if (m) ok(Number(m[1]));
      });
      worker.once('error', reject);
      worker.once('exit', () => reject(Error('worker exited before listen')));
    });
    await assert.rejects(
      fetch(`http://127.0.0.1:${port}/api/library/text`, {
        method: 'POST',
        headers: { 'X-IELTS-Local': '1' },
        body: JSON.stringify(input),
      }),
    );
    assert.equal((await exit).signal, 'SIGKILL');
    await h.start();
    const db = new DatabaseSync(h.databasePath);
    const op = db.prepare('SELECT * FROM resource_writes').get();
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db.prepare('PRAGMA integrity_check').get().integrity_check,
      'ok',
    );
    db.close();
    assert.equal(
      (await h.request('/api/library/items')).data.items.length,
      point === 'after-commit' ? 1 : 0,
    );
    const retry = await h.request('/api/library/text', input);
    assert.equal(retry.status, 201);
    assert.equal(retry.data.id, op.resource_id);
    assert.equal(
      (await h.request(`/api/library/items/articles/${op.resource_id}`)).data
        .content,
      input.content,
    );
    assert.equal((await h.request('/api/library/items')).data.items.length, 1);
    assert.equal(
      (await readdir(h.library)).some((name) => name.startsWith('.incoming-')),
      false,
    );
  }
});

test('007 upgrades synthetic 001–006 database, retaining IDs and ownership', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'ielts-upgrade-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'workbench.sqlite3');
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, name TEXT)',
  );
  for (const filename of (await readdir('database/migrations'))
    .filter((name) => name.endsWith('.sql') && name < '007')
    .sort()) {
    db.exec(await readFile(join('database/migrations', filename), 'utf8'));
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(
      filename.split('_')[0],
      filename,
    );
  }
  const id = randomUUID();
  db.prepare(
    "INSERT INTO resources(id,kind,title,source_url,owner_user_id) VALUES (?,'articles','before','','user-local-default')",
  ).run(id);
  db.prepare(
    "INSERT INTO resource_subjects(resource_id,subject_id) VALUES (?,'subject-ielts-reading')",
  ).run(id);
  db.close();
  initializeDatabase(path);
  initializeDatabase(path);
  const upgraded = new DatabaseSync(path);
  assert.equal(
    upgraded.prepare('SELECT source_url FROM resources WHERE id=?').get(id)
      .source_url,
    null,
  );
  assert.equal(
    upgraded.prepare('SELECT owner_user_id FROM resources WHERE id=?').get(id)
      .owner_user_id,
    'user-local-default',
  );
  assert.equal(
    upgraded
      .prepare('SELECT subject_id FROM resource_subjects WHERE resource_id=?')
      .get(id).subject_id,
    'subject-ielts-reading',
  );
  for (let i = 0; i < 2; i++)
    upgraded
      .prepare(
        "INSERT INTO resources(id,kind,title,source_url) VALUES (?,'articles','duplicate','https://example.com')",
      )
      .run(randomUUID());
  assert.equal(
    upgraded.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,
    10,
  );
  assert.deepEqual(upgraded.prepare('PRAGMA foreign_key_check').all(), []);
  upgraded.close();
});

test('directory modes reject mixing, default directory and conflicting DB paths', async (t) => {
  const h = await harness(t);
  await h.start();
  await h.stop();
  await assert.rejects(
    createLibraryServer({ libraryDir: h.library, mode: 'legacy' }),
    /mode does not match/,
  );
  await assert.rejects(
    createLibraryServer({
      libraryDir: h.library,
      mode: 'sqlite',
      databasePath: join(h.library, 'other.sqlite3'),
    }),
    /isolated/,
  );
  const legacy = join(h.library, 'legacy');
  await mkdir(legacy);
  await writeFile(join(legacy, 'manifest.json'), '{}');
  await assert.rejects(
    createLibraryServer({
      libraryDir: legacy,
      mode: 'sqlite',
      databasePath: join(legacy, 'workbench.sqlite3'),
    }),
    /empty directory/,
  );
});

test('real filesystem and SQLite write errors preserve retryable input without catalog ghosts', async (t) => {
  let blockFile = true;
  const h = await harness(t, {
    fault(stage) {
      if (blockFile && stage === 'before-file') {
        const db = new DatabaseSync(h.databasePath);
        const op = db
          .prepare(
            "SELECT resource_id FROM resource_writes WHERE state='pending'",
          )
          .get();
        db.close();
        writeFileSync(
          join(h.library, '.incoming-' + op.resource_id),
          'blocks directory creation',
        );
      }
    },
  });
  await h.start();
  const input = fixture();
  assert.equal((await h.request('/api/library/text', input)).status, 500);
  assert.equal((await h.request('/api/library/items')).data.items.length, 0);
  blockFile = false;
  const db = new DatabaseSync(h.databasePath);
  db.exec(
    "CREATE TRIGGER fail_insert BEFORE INSERT ON resources BEGIN SELECT RAISE(ABORT, 'test database write failure'); END",
  );
  assert.equal((await h.request('/api/library/text', input)).status, 500);
  assert.equal((await h.request('/api/library/items')).data.items.length, 0);
  assert.equal((await readdir(join(h.library, 'articles'))).length, 0);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM resource_subjects').get().n,
    0,
  );
  db.exec('DROP TRIGGER fail_insert');
  db.close();
  assert.equal((await h.request('/api/library/text', input)).status, 201);
  assert.equal((await h.request('/api/library/items')).data.items.length, 1);
});
