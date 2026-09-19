import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validatePublicUrl, publicIPv4, fetchPublic } from './public-fetch.mjs';
import { createLibraryServer, mergeCatalog } from './library-server.mjs';
const run = promisify(execFile);
test('Catalog keeps every topic when one live query fails', () => {
  const merged = mergeCatalog(
    [{ id: 'live-politics', topic: 'international-politics' }],
    [{ id: 'cached-economy', topic: 'economy-finance' }],
  );
  assert.deepEqual(
    merged.items.map((item) => item.id),
    ['live-politics', 'cached-economy'],
  );
  assert.deepEqual(merged.staleTopics, ['economy-finance']);
});
test('URL import rejects local addresses and unsafe URLs before network access', async () => {
  for (const u of [
    'http://example.org',
    'https://127.0.0.1',
    'https://[::1]',
    'https://localhost',
    'https://server.local',
    'https://name:password@example.com',
    'https://example.org:8443',
  ]) {
    assert.throws(() => validatePublicUrl(u));
    await assert.rejects(() => fetchPublic(u));
  }
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])
    assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4('8.8.8.8'), true);
  assert.equal(
    validatePublicUrl('https://example.org/article').hostname,
    'example.org',
  );
});
test('Article extraction keeps readable text, removes executable content and discovers audio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ielts-extract-'));
  try {
    const file = join(dir, 'page.html');
    await writeFile(
      file,
      `<html><head><title>Practice article</title><script>DO_NOT_KEEP_THIS</script></head><body><nav>NO_NAV</nav><article><h1>A public article</h1><p>${'People learn through regular reading and careful practice. '.repeat(10)}</p><audio controls><source src="/audio/lesson.mp3"></audio></article><footer>NO_FOOTER</footer></body></html>`,
    );
    const { stdout } = await run('python3', [
      resolve('scripts/extract-article.py'),
      file,
      'https://example.org/article',
    ]);
    const d = JSON.parse(stdout);
    assert.equal(d.title, 'Practice article');
    assert.match(d.content, /regular reading/);
    assert.doesNotMatch(d.content, /DO_NOT_KEEP_THIS|NO_NAV|NO_FOOTER/);
    assert.deepEqual(d.audioLinks, ['https://example.org/audio/lesson.mp3']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('Practice saving includes actual listening audio, complete responses and reloadable archives', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ielts-practice-'));
  let server;
  try {
    const site = join(dir, 'site');
    await mkdir(join(site, 'practice'), { recursive: true });
    const library = join(dir, 'library');
    await mkdir(library, { recursive: true });
    await writeFile(
      join(library, 'resource-catalog.json'),
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 'simplewiki:International_relations',
            title: 'International relations',
            topic: 'international-politics',
            topicLabel: '国际政治',
            provider: 'Simple English Wikipedia',
            description: 'Relations between countries',
            url: 'https://simple.wikipedia.org/wiki/International_relations',
          },
          {
            id: 'simplewiki:Economy',
            title: 'Economy',
            topic: 'economy-finance',
            topicLabel: '经济金融',
            provider: 'Simple English Wikipedia',
            description: 'How goods and services are produced',
            url: 'https://simple.wikipedia.org/wiki/Economy',
          },
        ],
      }),
    );
    await copyFile(
      'public/practice/community-centre.wav',
      join(site, 'practice/community-centre.wav'),
    );
    server = await createLibraryServer({
      libraryDir: library,
      staticDir: site,
    });
    await new Promise((ok, no) => {
      server.once('error', no);
      server.listen(0, '127.0.0.1', ok);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const catalog = await (
      await fetch(base + '/api/library/catalog?topic=economy-finance')
    ).json();
    assert.equal(catalog.stale, false);
    assert.deepEqual(
      catalog.items.map((entry) => entry.title),
      ['Economy'],
    );
    const r = await fetch(base + '/api/library/practice', {
      method: 'POST',
      headers: { 'X-IELTS-Local': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: {
          id: 'listening-centre-v1',
          title: 'Listening practice',
          skill: 'listening',
          body: 'Original transcript',
          label: 'Synthetic original practice',
          source: '',
          questions: [],
        },
        answers: ['four'],
        response: 'My answer',
        notes: 'Review this lesson',
      }),
    });
    assert.equal(r.status, 201, await r.clone().text());
    const d = await r.json();
    assert.equal(d.attempt.response, 'My answer');
    assert.match(d.attempt.material.audioUrl, /\/api\/library\/items\/audio\//);
    const audio = await fetch(base + d.attempt.material.audioUrl);
    const bytes = Buffer.from(await audio.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.ok(bytes.length > 100000);
    const persisted = JSON.parse(
      await readFile(
        join(dir, 'library', 'articles', d.item.id, 'practice.json'),
        'utf8',
      ),
    );
    assert.equal(persisted.notes, 'Review this lesson');
    assert.equal(persisted.material.body, 'Original transcript');
    const listing = await (await fetch(base + '/api/library/items')).json();
    assert.equal(listing.items.length, 2);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
    }
    await rm(dir, { recursive: true, force: true });
  }
});
