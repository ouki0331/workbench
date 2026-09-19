import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createLibraryServer } from './library-server.mjs';
const run = promisify(execFile);

async function setup(t, options = {}) {
  const work = await mkdtemp(join(tmpdir(), 'ielts-organize-'));
  const library = join(work, 'library');
  const server = await createLibraryServer({
    libraryDir: library,
    databasePath: join(library, 'workbench.sqlite3'),
    mode: 'sqlite',
    ...options,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, data, method = 'POST') => {
    const response = await fetch(
      base + path,
      data === undefined
        ? {}
        : {
            method,
            headers: { 'X-IELTS-Local': '1' },
            body: JSON.stringify(data),
          },
    );
    return { status: response.status, data: await response.json() };
  };
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(work, { recursive: true, force: true });
  });
  const item = (
    await request('/api/library/text', {
      operationId: randomUUID(),
      kind: 'articles',
      title: 'Financial technology report',
      content: '# Fixture',
      source: '',
      skill: 'reading',
    })
  ).data;
  const url = `/api/library/items/${item.kind}/${item.id}`;
  return { work, library, item, url, request };
}

test('remark and twenty notes retain order, independent timestamps, safe raw markdown and backup restore', async (t) => {
  const h = await setup(t);
  const detail = await h.request(h.url);
  const notes = Array.from({ length: 20 }, (_, index) => ({
    id: randomUUID(),
    title: `Note ${index + 1}`,
    bodyMarkdown:
      index === 0 ? '<img src=x onerror=alert(1)>\n# Safe text' : `Body ${index}`,
  }));
  const saved = await h.request(
    h.url + '/organization',
    {
      revision: detail.data.organization.revision,
      remark: '# Source remark',
      notes,
      tagIds: [],
      customTags: [],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.equal(saved.data.organization.notes.length, 20);
  assert.deepEqual(
    saved.data.organization.notes.map((note) => note.title),
    notes.map((note) => note.title),
  );
  assert.equal(saved.data.organization.notes[0].bodyMarkdown, notes[0].bodyMarkdown);
  const noteTimes = saved.data.organization.notes.map((note) => note.updatedAt);
  const remarkTime = saved.data.organization.remarkUpdatedAt;
  const reordered = [...saved.data.organization.notes];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const second = await h.request(
    h.url + '/organization',
    {
      revision: saved.data.organization.revision,
      remark: '# Source remark changed',
      notes: reordered,
      tagIds: [],
      customTags: [],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(second.status, 200);
  assert.notEqual(second.data.organization.remarkUpdatedAt, remarkTime);
  assert.equal(second.data.item.updatedAt, detail.data.item.updatedAt);
  assert.deepEqual(
    second.data.organization.notes.map((note) => note.updatedAt).sort(),
    noteTimes.sort(),
  );
  assert.equal(second.data.organization.notes[0].title, 'Note 2');
  const backup = await h.request('/api/library/backup', {});
  assert.equal(backup.status, 201);
  const restored = join(h.work, 'restored');
  await run('python3', [
    'scripts/restore-library.py',
    backup.data.path,
    restored,
  ]);
  const restoredDb = new DatabaseSync(join(restored, 'workbench.sqlite3'));
  assert.equal(
    restoredDb
      .prepare('SELECT remark_markdown FROM resources WHERE id=?')
      .get(h.item.id).remark_markdown,
    '# Source remark changed',
  );
  assert.equal(
    restoredDb
      .prepare('SELECT COUNT(*) AS count FROM resource_notes WHERE resource_id=?')
      .get(h.item.id).count,
    20,
  );
  restoredDb.close();
});

test('CLDR snapshot hash, mappings, parent graph and preserved seed IDs match the initialized catalog', async (t) => {
  const h = await setup(t);
  const bytes = await readFile('database/data/places-cldr-48.2.json');
  const snapshot = JSON.parse(bytes);
  const db = new DatabaseSync(join(h.library, 'workbench.sqlite3'));
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM places').get().count,
    snapshot.places.length,
  );
  for (const place of snapshot.places) {
    const row = db
      .prepare(`SELECT parent_id, m49_code, iso_alpha2, iso_alpha3,
        data_source, data_version FROM places WHERE id=?`)
      .get(place.id);
    assert.ok(row, place.id);
    assert.equal(row.parent_id, place.parent_id);
    assert.equal(row.m49_code, place.m49_code);
    assert.equal(row.iso_alpha2, place.iso_alpha2);
    assert.equal(row.iso_alpha3, place.iso_alpha3);
    assert.equal(row.data_source, 'Unicode CLDR');
    assert.equal(row.data_version, '48.2');
    const seen = new Set([place.id]);
    let parent = row.parent_id;
    while (parent) {
      assert.ok(!seen.has(parent), `cycle at ${place.id}`);
      seen.add(parent);
      parent = db.prepare('SELECT parent_id FROM places WHERE id=?').get(parent)
        ?.parent_id;
    }
  }
  for (const id of [
    'place-world',
    'place-africa',
    'place-americas',
    'place-asia',
    'place-europe',
    'place-oceania',
  ])
    assert.ok(db.prepare('SELECT id FROM places WHERE id=?').get(id));
  assert.equal(
    db.prepare("SELECT sha256 FROM place_datasets WHERE id='cldr-places'").get()
      .sha256,
    '746119f7df052ac173a27676e6e0a29f602019582112a08899e308d52c8611a9',
  );
  db.close();
});

test('custom tags validate names/colors, inactive tags retain history, and suggestions require confirmation', async (t) => {
  const h = await setup(t);
  const detail = await h.request(h.url);
  const conflict = await h.request(
    h.url + '/organization',
    {
      revision: detail.data.organization.revision,
      remark: '',
      notes: [],
      tagIds: [],
      customTags: [{ name: '金融', color: 'navy' }],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(conflict.status, 409);
  const invalidColor = await h.request(
    h.url + '/organization',
    {
      revision: detail.data.organization.revision,
      remark: '',
      notes: [],
      tagIds: [],
      customTags: [{ name: '重点', color: 'terracotta' }],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(invalidColor.status, 400);
  const suggested = await h.request(h.url + '/organization/suggestions', {});
  assert.equal(suggested.status, 200);
  assert.ok(suggested.data.suggestions.some((entry) => entry.tagId === 'topic-finance'));
  const db = new DatabaseSync(join(h.library, 'workbench.sqlite3'));
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS count FROM resource_tags WHERE resource_id=? AND tag_id='topic-finance'")
      .get(h.item.id).count,
    0,
  );
  const accepted = await h.request(
    h.url + '/organization',
    {
      revision: detail.data.organization.revision,
      remark: '',
      notes: [],
      tagIds: ['topic-finance'],
      customTags: [{ name: '本周重点', color: 'navy' }],
      placeIds: ['place-europe'],
    },
    'PATCH',
  );
  assert.equal(accepted.status, 200, JSON.stringify(accepted));
  assert.ok(accepted.data.organization.assignedTagIds.includes('topic-finance'));
  assert.ok(
    accepted.data.organization.assignedTagIds.some((id) => id !== 'topic-finance'),
  );
  assert.deepEqual(accepted.data.organization.assignedPlaceIds, ['place-europe']);
  db.prepare("UPDATE tags SET is_active=0 WHERE id='topic-finance'").run();
  const retained = await h.request(h.url);
  assert.ok(retained.data.organization.assignedTagIds.includes('topic-finance'));
  const removed = await h.request(
    h.url + '/organization',
    {
      revision: retained.data.organization.revision,
      remark: '',
      notes: [],
      tagIds: retained.data.organization.assignedTagIds.filter(
        (id) => id !== 'topic-finance',
      ),
      customTags: [],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(removed.status, 200);
  const cannotReassign = await h.request(
    h.url + '/organization',
    {
      revision: removed.data.organization.revision,
      remark: '',
      notes: [],
      tagIds: [...removed.data.organization.assignedTagIds, 'topic-finance'],
      customTags: [],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(cannotReassign.status, 400);
  db.close();
});

test('organization writes are rejected while backup owns the write coordinator', async (t) => {
  let releaseBackup;
  let backupLocked;
  const locked = new Promise((resolve) => {
    backupLocked = resolve;
  });
  const release = new Promise((resolve) => {
    releaseBackup = resolve;
  });
  const h = await setup(t, {
    backupHook: async (stage) => {
      if (stage === 'locked') {
        backupLocked();
        await release;
      }
    },
  });
  const detail = await h.request(h.url);
  const backup = h.request('/api/library/backup', {});
  await locked;
  const blocked = await h.request(
    h.url + '/organization',
    {
      revision: detail.data.organization.revision,
      remark: 'kept in the client',
      notes: [],
      tagIds: [],
      customTags: [],
      placeIds: [],
    },
    'PATCH',
  );
  assert.equal(blocked.status, 409);
  releaseBackup();
  assert.equal((await backup).status, 201);
});
