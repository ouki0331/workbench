import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  mkdir,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLibraryServer } from './library-server.mjs';
const run = promisify(execFile);
test('local library persists all material types, survives restart, streams audio and exports a complete backup', async () => {
  const work = await mkdtemp(join(tmpdir(), 'ielts-library-test-')),
    library = join(work, 'library'),
    site = join(work, 'site');
  await mkdir(site);
  await writeFile(join(site, 'index.html'), 'test site');
  let server, base;
  const start = async () => {
    server = await createLibraryServer({
      libraryDir: library,
      staticDir: site,
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
    }
  };
  const post = async (path, data) => {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'X-IELTS-Local': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(r.status, 201, await r.clone().text());
    return r.json();
  };
  try {
    await start();
    const status = await (await fetch(base + '/api/library/status')).json();
    assert.equal(status.directory, await realpath(library));
    const article = await post('/api/library/text', {
      kind: 'articles',
      title: 'Reading practice',
      content: 'An original article.\n<script>keep as plain text</script>',
      source: 'https://example.org/article',
      skill: 'reading',
    });
    const word = await post('/api/library/text', {
      kind: 'vocabulary',
      title: 'resilient',
      meaning: '有韧性的',
      example: 'A resilient community.',
      source: '',
      skill: 'reading',
    });
    const wav = Buffer.alloc(16044);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24);
    wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    const audios = [];
    for (const kind of ['audio', 'recordings']) {
      const r = await fetch(
        base +
          '/api/library/upload?' +
          new URLSearchParams({
            kind,
            name: 'practice.wav',
            title: kind,
            skill: kind === 'audio' ? 'listening' : 'speaking',
          }),
        {
          method: 'POST',
          headers: { 'X-IELTS-Local': '1', 'Content-Type': 'audio/wav' },
          body: wav,
        },
      );
      assert.equal(r.status, 201);
      audios.push(await r.json());
    }
    assert.match(
      await readFile(
        join(library, 'articles', article.id, 'article.md'),
        'utf8',
      ),
      /original article/,
    );
    assert.equal(
      JSON.parse(
        await readFile(
          join(library, 'vocabulary', word.id, 'word.json'),
          'utf8',
        ),
      ).meaning,
      '有韧性的',
    );
    assert.deepEqual(
      await readFile(join(library, 'recordings', audios[1].id, 'original.wav')),
      wav,
    );
    const range = await fetch(
      base + `/api/library/items/audio/${audios[0].id}/file`,
      { headers: { Range: 'bytes=0-43' } },
    );
    assert.equal(range.status, 206);
    assert.deepEqual(
      Buffer.from(await range.arrayBuffer()),
      wav.subarray(0, 44),
    );
    const download = await fetch(
      base + `/api/library/items/articles/${article.id}/file?download=1`,
    );
    assert.match(download.headers.get('content-disposition'), /attachment/);
    await download.text();
    const badOrigin = await fetch(base + '/api/library/text', {
      method: 'POST',
      headers: {
        'X-IELTS-Local': '1',
        Origin: 'https://untrusted.example',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(badOrigin.status, 403);
    await badOrigin.text();
    const noHeader = await fetch(base + '/api/library/text', {
      method: 'POST',
      body: '{}',
    });
    assert.equal(noHeader.status, 403);
    await noHeader.text();
    for (const params of [
      'kind=audio&name=evil.html',
      'kind=recordings&name=empty.wav',
    ]) {
      const r = await fetch(base + '/api/library/upload?' + params, {
        method: 'POST',
        headers: { 'X-IELTS-Local': '1' },
        body: params.includes('empty') ? '' : '<html>',
      });
      assert.equal(r.status, 400);
      await r.text();
    }
    const missing = await fetch(base + '/api/library/items/articles/not-an-id');
    assert.equal(missing.status, 404);
    await missing.text();
    await stop();
    await start();
    const listing = await (await fetch(base + '/api/library/items')).json();
    assert.equal(listing.items.length, 4);
    assert.equal(listing.warnings.length, 0);
    const articleSearch = await (
      await fetch(base + '/api/library/search?q=original%20article')
    ).json();
    assert.equal(articleSearch.items[0].id, article.id);
    assert.match(articleSearch.items[0].excerpt, /original article/i);
    const wordSearch = await (
      await fetch(base + '/api/library/search?q=resilient')
    ).json();
    assert.equal(wordSearch.items[0].kind, 'vocabulary');
    const audioSearch = await (
      await fetch(base + '/api/library/search?q=recordings')
    ).json();
    assert.equal(audioSearch.items[0].kind, 'recordings');
    const reopened = await (
      await fetch(base + `/api/library/items/articles/${article.id}`)
    ).json();
    assert.match(reopened.content, /original article/);
    const backup = await post('/api/library/backup', {
      progress: {
        version: 1,
        profile: { target: 7, examDate: '' },
        sessions: [],
      },
    });
    assert.equal((await readdir(join(library, 'progress'))).length, 1);
    const check = await run('python3', [
      '-c',
      'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);n=z.namelist();assert len(n)==13,n;assert any(p.endswith("/.library-mode.json") for p in n);assert any(p.endswith("/backup-manifest.json") for p in n);assert not any("/backups/" in p for p in n);assert sum(p.endswith(".wav") for p in n)==2;assert any("/progress/" in p for p in n);assert z.testzip() is None;print("ZIP contents and CRC verified")',
      backup.path,
    ]);
    assert.match(check.stdout, /verified/);
    const zip = await fetch(base + backup.downloadUrl);
    assert.equal(zip.status, 200);
    assert.equal(zip.headers.get('content-type'), 'application/zip');
    await zip.arrayBuffer();
  } finally {
    await stop();
    await rm(work, { recursive: true, force: true });
  }
});
