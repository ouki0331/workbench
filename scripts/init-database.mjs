import { DatabaseSync } from 'node:sqlite';
import { lockDatabaseDirectory } from './library-lock.mjs';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libraryRoot = resolve(
  process.env.IELTS_LIBRARY_DIR ??
    resolve(projectRoot, '..', 'ielts-study-library'),
);
const databasePath = resolve(
  process.env.IELTS_DB_PATH ?? resolve(libraryRoot, 'workbench.sqlite3'),
);
const migrationsDirectory = resolve(projectRoot, 'database', 'migrations');
const seedsDirectory = resolve(projectRoot, 'database', 'seeds');
const placeDataPath = resolve(
  projectRoot,
  'database',
  'data',
  'places-cldr-48.2.json',
);
const placeDataSha256 =
  '746119f7df052ac173a27676e6e0a29f602019582112a08899e308d52c8611a9';

function loadPlaceData(database) {
  const bytes = readFileSync(placeDataPath);
  if (createHash('sha256').update(bytes).digest('hex') !== placeDataSha256)
    throw Error('CLDR place data checksum does not match the reviewed snapshot');
  const data = JSON.parse(bytes);
  if (data.sources?.redistributed_data?.version !== '48.2')
    throw Error('Unexpected CLDR place data version');
  const byId = new Map(data.places.map((place) => [place.id, place]));
  const depth = (place) =>
    place.parent_id ? 1 + depth(byId.get(place.parent_id)) : 0;
  const insert = database.prepare(`INSERT INTO places
    (id,kind,code_scheme,code,parent_id,name_en,name_ja,name_zh_cn,name_zh_tw,
      is_active,m49_code,iso_alpha2,iso_alpha3,data_source,data_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,code_scheme=excluded.code_scheme,
      code=excluded.code,parent_id=excluded.parent_id,name_en=excluded.name_en,
      name_ja=excluded.name_ja,name_zh_cn=excluded.name_zh_cn,
      name_zh_tw=excluded.name_zh_tw,is_active=excluded.is_active,
      m49_code=excluded.m49_code,iso_alpha2=excluded.iso_alpha2,
      iso_alpha3=excluded.iso_alpha3,data_source=excluded.data_source,
      data_version=excluded.data_version`);
  for (const place of [...data.places].sort((a, b) => depth(a) - depth(b)))
    insert.run(
      place.id,
      place.kind,
      'UN-M49',
      place.m49_code,
      place.parent_id,
      place.names.en,
      place.names.ja,
      place.names['zh-CN'],
      place.names['zh-TW'],
      place.is_active ? 1 : 0,
      place.m49_code,
      place.iso_alpha2,
      place.iso_alpha3,
      'Unicode CLDR',
      '48.2',
    );
  database
    .prepare(`INSERT INTO place_datasets(id,source,version,license,sha256)
      VALUES ('cldr-places','Unicode CLDR','48.2','Unicode-3.0',?)
      ON CONFLICT(id) DO UPDATE SET source=excluded.source,version=excluded.version,
      license=excluded.license,sha256=excluded.sha256`)
    .run(placeDataSha256);
}

export function initializeDatabase(databasePath, lock) {
  const ownLock = lock ? null : lockDatabaseDirectory(databasePath);
  try {
    mkdirSync(dirname(databasePath), { recursive: true });

    const database = new DatabaseSync(databasePath);

    try {
      database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

      const applied = new Set(
        database
          .prepare('SELECT version FROM schema_migrations')
          .all()
          .map((row) => row.version),
      );

      for (const filename of readdirSync(migrationsDirectory)
        .filter((name) => name.endsWith('.sql'))
        .sort()) {
        const version = filename.split('_', 1)[0];
        if (applied.has(version)) continue;

        const sql = readFileSync(
          resolve(migrationsDirectory, filename),
          'utf8',
        );
        database.exec('BEGIN IMMEDIATE');
        try {
          database.exec(sql);
          database
            .prepare(
              'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            )
            .run(version, filename);
          database.exec('COMMIT');
          console.log(`Applied migration ${filename}`);
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      }

      for (const filename of readdirSync(seedsDirectory)
        .filter((name) => name.endsWith('.sql'))
        .sort()) {
        database.exec(readFileSync(resolve(seedsDirectory, filename), 'utf8'));
        console.log(`Applied seed ${filename}`);
      }
      loadPlaceData(database);
      console.log('Applied place data Unicode CLDR 48.2');

      const summary = database
        .prepare(`
      SELECT
        (SELECT COUNT(*) FROM schema_migrations) AS migrations,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM learning_modules) AS modules,
        (SELECT COUNT(*) FROM subjects) AS subjects,
        (SELECT COUNT(*) FROM tag_groups) AS tag_groups,
        (SELECT COUNT(*) FROM tags) AS tags,
        (SELECT COUNT(*) FROM places) AS places
    `)
        .get();
      console.log(`Database ready: ${databasePath}`);
      console.log(JSON.stringify(summary));
    } finally {
      database.close();
    }
  } finally {
    ownLock?.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  initializeDatabase(databasePath);
