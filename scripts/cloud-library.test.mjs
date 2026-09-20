import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import {
  CloudLibraryError,
  createCloudLibrary,
  createCloudLibraryRoute,
} from '../lib/cloud-library.ts';

const root = new URL('..', import.meta.url).pathname;

async function setup() {
  const mf = new Miniflare({
    compatibilityDate: '2026-05-15',
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: ['DB'],
    r2Buckets: ['FILES'],
  });
  const bindings = await mf.getBindings();
  const migrations = (await readdir(join(root, 'database/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of migrations)
    await executeSqlFile(bindings.DB, join(root, 'database/migrations', name));
  await executeSqlFile(
    bindings.DB,
    join(root, 'database/seeds/001_core_taxonomy.sql'),
  );
  return { mf, bindings };
}

async function executeSqlFile(db, path) {
  const sql = await readFile(path, 'utf8');
  let statement = '';
  let trigger = false;
  for (const sourceLine of sql.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('--')) continue;
    statement += (statement ? '\n' : '') + sourceLine;
    if (/^CREATE\s+TRIGGER\b/i.test(statement.trim())) trigger = true;
    if ((trigger && /^END;$/i.test(line)) || (!trigger && line.endsWith(';'))) {
      await db.prepare(statement).run();
      statement = '';
      trigger = false;
    }
  }
  if (statement.trim()) await db.prepare(statement).run();
}

function article(overrides = {}) {
  return {
    kind: 'articles',
    title: 'Cloud article',
    content: '# Heading\n\nA resilient cloud text.',
    source: 'https://example.com/article',
    skill: 'reading',
    operationId: crypto.randomUUID(),
    ...overrides,
  };
}

async function rejectsStatus(run, status) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof CloudLibraryError);
    assert.equal(error.status, status);
    return true;
  });
}

void test('D1 and R2 preserve text save, list, detail, range, edit and retry semantics', async (t) => {
  const { mf, bindings } = await setup();
  t.after(() => mf.dispose());
  const library = createCloudLibrary(bindings);
  const input = article();

  const saved = await library.saveText(input);
  assert.equal(saved.kind, 'articles');
  assert.equal(saved.revision, 0);
  assert.equal((await library.saveText(input)).id, saved.id);
  await rejectsStatus(
    () => library.saveText({ ...input, content: 'changed retry' }),
    409,
  );

  assert.deepEqual(
    (await library.list()).map((item) => item.id),
    [saved.id],
  );
  const opened = await library.detail('articles', saved.id);
  assert.equal(opened.content, input.content);
  assert.equal(opened.item.editableContent, true);

  const full = await library.file(
    'articles',
    saved.id,
    new Request(
      `https://local.test/api/library/items/articles/${saved.id}/file`,
    ),
  );
  assert.equal(full.status, 200);
  assert.equal(await full.text(), input.content);
  const prefix = await library.file(
    'articles',
    saved.id,
    new Request(
      `https://local.test/api/library/items/articles/${saved.id}/file`,
      {
        headers: { Range: 'bytes=0-8' },
      },
    ),
  );
  assert.equal(prefix.status, 206);
  assert.equal(prefix.headers.get('content-range'), `bytes 0-8/${saved.size}`);
  assert.equal(await prefix.text(), input.content.slice(0, 9));
  const suffix = await library.file(
    'articles',
    saved.id,
    new Request(
      `https://local.test/api/library/items/articles/${saved.id}/file`,
      {
        headers: { Range: 'bytes=-5' },
      },
    ),
  );
  assert.equal(await suffix.text(), input.content.slice(-5));
  await rejectsStatus(
    () =>
      library.file(
        'articles',
        saved.id,
        new Request(`https://local.test/file`, {
          headers: { Range: `bytes=${saved.size}-` },
        }),
      ),
    416,
  );

  const editInput = {
    operationId: crypto.randomUUID(),
    revision: saved.revision,
    title: 'Edited cloud article',
    summary: 'Edited summary',
    source: input.source,
    kind: 'articles',
    skill: 'writing',
    durationSeconds: null,
    content: '# Updated\n\nThe cloud copy changed.',
  };
  const edited = await library.edit('articles', saved.id, editInput);
  assert.equal(edited.item.revision, 1);
  assert.equal(edited.item.skill, 'writing');
  assert.equal(edited.content, editInput.content);
  assert.equal(
    (await library.edit('articles', saved.id, editInput)).item.revision,
    1,
  );
  await rejectsStatus(
    () =>
      library.edit('articles', saved.id, {
        ...editInput,
        operationId: crypto.randomUUID(),
        title: 'Stale edit',
      }),
    409,
  );

  const reopened = await createCloudLibrary(bindings).detail(
    'articles',
    saved.id,
  );
  assert.equal(reopened.item.title, editInput.title);
  assert.equal(reopened.content, editInput.content);

  const concurrentSource = await library.saveText(
    article({ operationId: crypto.randomUUID(), title: 'Concurrent source' }),
  );
  const editBase = {
    revision: concurrentSource.revision,
    summary: '',
    source: input.source,
    kind: 'articles',
    skill: 'reading',
    durationSeconds: null,
  };
  const concurrent = await Promise.allSettled([
    library.edit('articles', concurrentSource.id, {
      ...editBase,
      operationId: crypto.randomUUID(),
      title: 'Concurrent winner A',
    }),
    library.edit('articles', concurrentSource.id, {
      ...editBase,
      operationId: crypto.randomUUID(),
      title: 'Concurrent winner B',
    }),
  ]);
  assert.equal(
    concurrent.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const rejected = concurrent.find((result) => result.status === 'rejected');
  assert.equal(rejected?.reason.status, 409);
  assert.equal(
    (await library.detail('articles', concurrentSource.id)).item.revision,
    1,
  );
});

void test('a failed D1 commit leaves no visible resource and the same operation converges', async (t) => {
  const { mf, bindings } = await setup();
  t.after(() => mf.dispose());
  let failBatch = true;
  const interrupted = createCloudLibrary({
    DB: {
      prepare: (...args) => bindings.DB.prepare(...args),
      batch: (...args) => {
        if (failBatch) {
          failBatch = false;
          throw new Error('simulated commit failure');
        }
        return bindings.DB.batch(...args);
      },
    },
    FILES: bindings.FILES,
  });
  const input = article();
  await assert.rejects(() => interrupted.saveText(input), /simulated/);
  assert.equal((await createCloudLibrary(bindings).list()).length, 0);
  const pending = await bindings.DB.prepare(
    "SELECT resource_id FROM resource_writes WHERE operation_id=? AND state='pending'",
  )
    .bind(input.operationId)
    .first();
  assert.ok(pending?.resource_id);
  const objects = await bindings.FILES.list({
    prefix: `resources/${pending.resource_id}/`,
  });
  assert.equal(objects.objects.length, 1);

  const recovered = await createCloudLibrary(bindings).saveText(input);
  assert.equal(recovered.id, pending.resource_id);
  assert.equal((await createCloudLibrary(bindings).list()).length, 1);
});

void test('UTF-8 byte limits keep every accepted text body reopenable', async (t) => {
  const { mf, bindings } = await setup();
  t.after(() => mf.dispose());
  const library = createCloudLibrary(bindings);
  const limit = 2 * 1024 * 1024;
  const accepted = 'a'.repeat(limit);
  const saved = await library.saveText(
    article({
      content: accepted,
      source: '',
      operationId: crypto.randomUUID(),
    }),
  );
  assert.equal((await library.detail('articles', saved.id)).content, accepted);

  const tooLargeInUtf8 = '界'.repeat(Math.floor(limit / 3) + 1);
  assert.ok(tooLargeInUtf8.length < 1_000_000);
  await rejectsStatus(
    () =>
      library.saveText(
        article({
          content: tooLargeInUtf8,
          source: '',
          operationId: crypto.randomUUID(),
        }),
      ),
    400,
  );
});

void test('HTTP route preserves same-origin writes and rejects explicit cross-site writes', async (t) => {
  const { mf, bindings } = await setup();
  t.after(() => mf.dispose());
  const handle = createCloudLibraryRoute(bindings);
  const context = (path) => ({ params: Promise.resolve({ path }) });
  const request = (headers = {}) =>
    new Request('https://workbench.example/api/library/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(article({ operationId: crypto.randomUUID() })),
    });

  const crossSite = await handle(
    request({ Origin: 'https://attacker.example' }),
    context(['text']),
  );
  assert.equal(crossSite.status, 403);
  assert.match((await crossSite.json()).error, /跨站/);

  const fetchMetadataCrossSite = await handle(
    request({ 'Sec-Fetch-Site': 'cross-site' }),
    context(['text']),
  );
  assert.equal(fetchMetadataCrossSite.status, 403);

  const sameOrigin = await handle(
    request({
      Origin: 'https://workbench.example',
      'Sec-Fetch-Site': 'same-origin',
    }),
    context(['text']),
  );
  assert.equal(sameOrigin.status, 201);

  const trustedScript = await handle(request(), context(['text']));
  assert.equal(trustedScript.status, 201);

  const unavailable = await createCloudLibraryRoute({})(
    new Request('https://workbench.example/api/library/status'),
    context(['status']),
  );
  assert.equal(unavailable.status, 503);
});
