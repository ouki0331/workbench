import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'dist/server/wrangler.json');
const wranglerPath = join(root, 'node_modules/.bin/wrangler');
const seedPath = join(root, 'database/seeds/001_core_taxonomy.sql');
const persistence = await mkdtemp(join(tmpdir(), 'ielts-d1-smoke-'));

function wrangler(args) {
  return execFileSync(wranglerPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', WRANGLER_WRITE_LOGS: 'false' },
  });
}

try {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const binding = config.d1_databases?.find((value) => value.binding === 'DB');
  assert.ok(binding, 'dist/server/wrangler.json must contain the DB binding');
  const migrationsPath = resolve(dirname(configPath), binding.migrations_dir);
  await access(migrationsPath);
  const migrations = (await readdir(migrationsPath))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  assert.deepEqual(migrations, [
    '001_resource_catalog.sql',
    '002_allow_shared_external_tag_ids.sql',
    '003_correct_topic_external_mappings.sql',
    '004_users_modules_metadata_notes_and_views.sql',
    '005_split_prose_and_personal_essay.sql',
    '006_replace_personal_note_with_remark.sql',
    '007_resource_sources_and_writes.sql',
    '008_general_library_writes.sql',
    '009_resource_edit_operations.sql',
    '010_resource_organization.sql',
  ]);

  wrangler([
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    configPath,
    '--persist-to',
    persistence,
  ]);
  wrangler([
    'd1',
    'execute',
    'DB',
    '--local',
    '--config',
    configPath,
    '--persist-to',
    persistence,
    '--file',
    seedPath,
    '--yes',
  ]);
  const output = wrangler([
    'd1',
    'execute',
    'DB',
    '--local',
    '--config',
    configPath,
    '--persist-to',
    persistence,
    '--command',
    `SELECT
      (SELECT COUNT(*) FROM d1_migrations) AS migration_count,
      (SELECT COUNT(*) FROM tags) AS tag_count,
      (SELECT COUNT(*) FROM places) AS place_count`,
    '--json',
  ]);
  const rows = JSON.parse(output);
  const result = rows[0]?.results?.[0];
  assert.equal(result?.migration_count, 10);
  assert.ok(result?.tag_count >= 62);
  assert.equal(result?.place_count, 6);
  console.log(
    'Wrangler applied migrations 001-010 and the core seed to a fresh local D1.',
  );
} finally {
  await rm(persistence, { recursive: true, force: true });
}
