import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createLibraryServer } from './library-server.mjs';
import { extractMediaMetadata } from './extract-media-metadata.mjs';
import { emptyProgress } from '../lib/progress.ts';
const run = promisify(execFile);
const textInput = () => ({
  operationId: randomUUID(),
  kind: 'articles',
  title: 'Original',
  skill: 'reading',
  content: '# Before\n原文',
  source: '',
});
const editInput = (item, extra = {}) => ({
  operationId: randomUUID(),
  revision: item.revision,
  title: item.title,
  summary: item.summary || '',
  source: item.source,
  kind: item.kind,
  skill: item.skill,
  durationSeconds: item.durationSeconds,
  ...extra,
});
const itemUrl = (item) => `/api/library/items/${item.kind}/${item.id}`;
async function setup(t, options = {}) {
  const work = await mkdtemp(join(tmpdir(), 'ielts-edit-'));
  const library = join(work, 'library'),
    databasePath = join(library, 'workbench.sqlite3');
  let server, base;
  const start = async () => {
    server = await createLibraryServer({
      libraryDir: library,
      databasePath,
      mode: 'sqlite',
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
  const request = async (path, data, method = 'POST', raw = false) => {
    const res = await fetch(
      base + path,
      data === undefined
        ? {}
        : {
            method,
            headers: { 'X-IELTS-Local': '1' },
            body: raw ? data : JSON.stringify(data),
          },
    );
    return { status: res.status, data: await res.json() };
  };
  const post = async (path, data, raw = false) => {
    const r = await request(path, data, 'POST', raw);
    assert.equal(r.status, 201, JSON.stringify(r));
    return r.data;
  };
  t.after(async () => {
    await stop();
    await rm(work, { recursive: true, force: true });
  });
  return {
    work,
    library,
    databasePath,
    start,
    stop,
    request,
    post,
    base: () => base,
  };
}
function upload(name, extra = {}) {
  return (
    '/api/library/upload?' +
    new URLSearchParams({
      operationId: randomUUID(),
      kind: 'audio',
      name,
      title: name,
      skill: 'listening',
      ...extra,
    })
  );
}

test('metadata and TXT/Markdown edits preserve identity, validation, revision, restart and backup consistency', async (t) => {
  const h = await setup(t);
  await h.start();
  const original = await h.post('/api/library/text', textInput());
  const input = editInput(original, {
    title: 'Updated title',
    summary: 'Manual summary',
    source: 'https://example.org/updated',
    kind: 'audio',
    skill: 'writing',
    content: '  # New Markdown\n保留首尾空白\n',
  });
  const edited = await h.request(itemUrl(original), input, 'PATCH');
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal(edited.data.item.id, original.id);
  assert.equal(edited.data.item.kind, 'audio');
  assert.equal(edited.data.item.editableContent, true);
  assert.equal(edited.data.content, input.content);
  assert.equal(edited.data.item.subjectId, 'subject-ielts-writing');
  assert.equal(edited.data.item.titleSource, 'manual');
  assert.equal(edited.data.item.revision, original.revision + 1);
  assert.equal(
    (await h.request(itemUrl(original), input, 'PATCH')).status,
    200,
  );
  assert.equal(
    (
      await h.request(
        itemUrl(original),
        editInput(original, { title: 'stale' }),
        'PATCH',
      )
    ).status,
    409,
  );
  for (const extra of [
    { title: '' },
    { source: 'http://' },
    { source: 'javascript:alert(1)' },
    { kind: 'bad' },
    { skill: 'bad' },
    { durationSeconds: -1 },
    { content: '' },
  ]) {
    assert.equal(
      (
        await h.request(
          itemUrl(original),
          editInput(edited.data.item, extra),
          'PATCH',
        )
      ).status,
      400,
    );
  }
  assert.deepEqual(await readdir(join(h.library, 'articles', original.id)), [
    edited.data.item.filename,
  ]);
  const pdf = await h.post(
    upload('paper.pdf', { kind: 'articles', skill: 'reading' }),
    Buffer.from('%PDF sample'),
    true,
  );
  assert.equal(pdf.editableContent, false);
  assert.equal(
    (
      await h.request(
        itemUrl(pdf),
        editInput(pdf, { content: 'not allowed' }),
        'PATCH',
      )
    ).status,
    400,
  );
  const renamed = await h.request(
    itemUrl(pdf),
    editInput(pdf, { title: 'PDF title', kind: 'recordings' }),
    'PATCH',
  );
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.item.mime, 'application/pdf');
  assert.equal(renamed.data.content, null);
  await h.stop();
  await h.start();
  assert.deepEqual((await h.request(itemUrl(original))).data, edited.data);
  assert.equal(
    await (await fetch(h.base() + itemUrl(original) + '/file')).text(),
    input.content,
  );
  const backup = await h.post('/api/library/backup', {
    progress: emptyProgress,
  });
  const restored = join(h.work, 'restored');
  await run('python3', ['scripts/restore-library.py', backup.path, restored]);
  const db = new DatabaseSync(join(restored, 'workbench.sqlite3'));
  assert.equal(
    db.prepare('SELECT body_text FROM resources WHERE id=?').get(original.id)
      .body_text,
    input.content,
  );
  const path = db
    .prepare('SELECT relative_path FROM resource_files WHERE resource_id=?')
    .get(original.id).relative_path;
  assert.equal(await readFile(join(restored, path), 'utf8'), input.content);
  db.close();
});

test('four audio containers with/without tags extract metadata; manual values survive later extraction', async (t) => {
  const h = await setup(t);
  await h.start();
  for (const ext of ['mp3', 'm4a', 'wav', 'webm']) {
    for (const tagged of [false, true]) {
      const name = `fixture-${tagged ? 'tagged' : 'plain'}.${ext}`,
        path = join(h.work, name);
      await run('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=0.3',
        ...(tagged
          ? [
              '-metadata',
              'title=Embedded title',
              '-metadata',
              'artist=Fixture artist',
            ]
          : []),
        '-y',
        path,
      ]);
      const bytes = await readFile(path);
      const item = await h.post(upload(name), bytes, true);
      assert.equal(item.metadataExtractStatus, 'success');
      assert.ok(item.durationSeconds > 0 && item.durationSeconds < 1);
      assert.equal(item.durationSource, 'automatic');
      assert.ok(item.metadataExtractedAt);
      assert.equal(item.title, tagged ? 'Embedded title' : name);
      assert.equal(item.titleSource, tagged ? 'embedded' : 'filename');
      assert.equal(item.editableContent, false);
      assert.equal(item.canExtract, true);
      const manual = await h.request(
        itemUrl(item),
        editInput(item, { title: 'My corrected title', durationSeconds: 12.5 }),
        'PATCH',
      );
      assert.equal(manual.status, 200);
      assert.equal(manual.data.item.durationSource, 'manual');
      const reapplied = await h.request(itemUrl(item) + '/extract', {});
      assert.equal(reapplied.status, 200);
      assert.equal(reapplied.data.item.title, 'My corrected title');
      assert.equal(reapplied.data.item.durationSeconds, 12.5);
      assert.equal(
        reapplied.data.item.durationUpdatedAt,
        manual.data.item.durationUpdatedAt,
      );
      assert.equal(reapplied.data.item.titleSource, 'manual');
      if (tagged)
        assert.equal(
          reapplied.data.item.extractedMetadata.format.tags.title,
          'Embedded title',
        );
    }
  }
  const broken = await h.post(
    upload('broken.wav'),
    Buffer.from('not an audio container'),
    true,
  );
  assert.equal(broken.metadataExtractStatus, 'failed');
  assert.equal(broken.title, 'broken.wav');
  assert.equal(broken.durationSeconds, null);
  assert.equal(
    (
      await h.request(
        itemUrl(broken),
        editInput(broken, { durationSeconds: 5 }),
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await extractMediaMetadata(
        join(h.work, 'missing.wav'),
        '/no-such-ffprobe',
      )
    ).status,
    'failed',
  );
});

test('failed edit compensation leaves old content readable and same-operation retry succeeds', async (t) => {
  for (const point of [
    'edit-before-file',
    'edit-after-file',
    'edit-before-commit',
    'edit-after-commit',
  ]) {
    let inject = true;
    const h = await setup(t, {
      fault(stage) {
        if (inject && stage === point) throw Error('injected edit failure');
      },
    });
    await h.start();
    const original = await h.post('/api/library/text', textInput());
    const input = editInput(original, { content: 'Changed safely' });
    assert.equal(
      (await h.request(itemUrl(original), input, 'PATCH')).status,
      500,
    );
    const detail = await h.request(itemUrl(original));
    assert.equal(
      detail.data.content,
      point === 'edit-after-commit' ? input.content : '# Before\n原文',
    );
    inject = false;
    assert.equal(
      (await h.request(itemUrl(original), input, 'PATCH')).status,
      200,
    );
    await h.stop();
    await h.start();
    assert.equal(
      (await h.request(itemUrl(original))).data.content,
      input.content,
    );
    assert.equal(
      (await readdir(join(h.library, 'articles', original.id))).length,
      1,
    );
  }
});

test('killed edit processes recover a complete old or new file and retry never duplicates resources', async (t) => {
  for (const point of [
    'edit-before-file',
    'edit-after-file',
    'edit-before-commit',
    'edit-after-commit',
  ]) {
    const h = await setup(t);
    await h.start();
    const item = await h.post('/api/library/text', textInput());
    await h.stop();
    const worker = spawn(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
      import { createLibraryServer } from './scripts/library-server.mjs';
      const server = await createLibraryServer({ libraryDir: process.env.IELTS_LIBRARY_DIR, databasePath: process.env.IELTS_DB_PATH, mode:'sqlite', fault(stage) { if(stage === '${point}') process.kill(process.pid, 'SIGKILL'); } });
      server.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));
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
    const port = await new Promise((ok, no) => {
      let out = '';
      worker.stdout.on('data', (chunk) => {
        out += chunk;
        const m = /PORT=(\d+)/.exec(out);
        if (m) ok(Number(m[1]));
      });
      worker.once('error', no);
    });
    const input = editInput(item, { content: 'Recovered edit' });
    await assert.rejects(
      fetch(`http://127.0.0.1:${port}` + itemUrl(item), {
        method: 'PATCH',
        headers: { 'X-IELTS-Local': '1' },
        body: JSON.stringify(input),
      }),
    );
    assert.equal((await exited).signal, 'SIGKILL');
    await h.start();
    assert.equal(
      (await h.request(itemUrl(item))).data.content,
      point === 'edit-after-commit' ? input.content : '# Before\n原文',
    );
    assert.equal((await h.request(itemUrl(item), input, 'PATCH')).status, 200);
    assert.equal((await h.request('/api/library/items')).data.items.length, 1);
    assert.equal(
      (await readdir(join(h.library, 'articles', item.id))).length,
      1,
    );
  }
});

test('actual editor and extraction requests cannot modify a catalog held for backup', async (t) => {
  let unlock, locked;
  const held = new Promise((ok) => {
    locked = ok;
  });
  const release = new Promise((ok) => {
    unlock = ok;
  });
  const h = await setup(t, {
    backupHook: async (stage) => {
      if (stage === 'locked') {
        locked();
        await release;
      }
    },
  });
  await h.start();
  const item = await h.post('/api/library/text', textInput());
  const backup = h.post('/api/library/backup', { progress: emptyProgress });
  await held;
  assert.equal(
    (
      await h.request(
        itemUrl(item),
        editInput(item, { title: 'Blocked' }),
        'PATCH',
      )
    ).status,
    409,
  );
  assert.equal((await h.request(itemUrl(item) + '/extract', {})).status, 409);
  unlock();
  const result = await backup;
  assert.equal(
    (
      await h.request(
        itemUrl(item),
        editInput(item, { title: 'Allowed' }),
        'PATCH',
      )
    ).status,
    200,
  );
  const restored = join(h.work, 'restored');
  await run('python3', ['scripts/restore-library.py', result.path, restored]);
  const db = new DatabaseSync(join(restored, 'workbench.sqlite3'));
  assert.equal(
    db.prepare('SELECT title FROM resources WHERE id=?').get(item.id).title,
    'Original',
  );
  db.close();
});
