import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpile(
  readFileSync(new URL('../lib/progress.ts', import.meta.url), 'utf8'),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
);
const { parseProgress, emptyProgress } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const record = {
  id: 'test-one',
  date: '2026-09-13',
  skill: 'reading',
  minutes: 25,
  score: 6.5,
  note: '复盘 <script> example',
};
const sample = { ...emptyProgress, sessions: [record] };
assert.deepEqual(parseProgress(JSON.stringify(sample)), sample);
assert.deepEqual(
  parseProgress(
    JSON.stringify({ version: 1, profile: sample.profile, sessions: [record] }),
  ).reviews,
  { cards: [], events: [] },
);
assert.deepEqual(
  parseProgress(
    JSON.stringify({ version: 1, profile: sample.profile, sessions: [record] }),
  ).assessments,
  [],
);
assert.deepEqual(
  parseProgress(
    JSON.stringify({ version: 1, profile: sample.profile, sessions: [record] }),
  ).activities,
  [],
);
const activity = {
  id: 'activity-one',
  date: '2026-09-13',
  at: '2026-09-13T12:00:00.000Z',
  moduleId: 'ielts',
  subjectId: 'english',
  kind: 'word-known',
  resourceId: 'inflation',
  label: 'inflation',
  seconds: 0,
};
assert.deepEqual(
  parseProgress(JSON.stringify({ ...sample, activities: [activity] }))
    .activities,
  [{ ...activity, resourceRef: { kind: 'vocabulary', id: 'inflation' } }],
);
for (const invalid of [
  { ...sample, version: 2 },
  { ...sample, profile: { target: 10, examDate: '' } },
  { ...sample, sessions: [record, record] },
  { ...sample, sessions: [{ ...record, minutes: -1 }] },
  { ...sample, sessions: [{ ...record, score: 6.2 }] },
  { ...sample, sessions: [{ ...record, date: '2026-02-30' }] },
  { ...sample, sessions: [{ ...record, skill: 'unknown' }] },
  {
    ...sample,
    reviews: {
      cards: [{ id: 'broken-card', front: '', dueDate: 'not-a-date' }],
      events: [],
    },
  },
  {
    ...sample,
    assessments: [
      {
        id: 'bad',
        date: '2026-09-14',
        correct: 5,
        total: 8,
        estimatedBand: 4.2,
        answers: Array(8).fill(1),
      },
    ],
  },
  { ...sample, activities: [{ ...activity, seconds: -1 }] },
])
  assert.throws(() => parseProgress(JSON.stringify(invalid)));
assert.throws(() => parseProgress('{broken'));
const legacyActivity = {
  ...activity,
  kind: 'article-opened',
  resourceId: '5b3d60b8-1f6d-4b94-9957-7006022ec88d',
};
const legacy = parseProgress(
  JSON.stringify({ ...sample, activities: [legacyActivity] }),
);
assert.deepEqual(legacy.activities[0].resourceRef, {
  kind: 'legacy',
  id: legacyActivity.resourceId,
});
assert.equal(legacy.activities[0].resourceId, legacyActivity.resourceId);
const legacyUrl = parseProgress(
  JSON.stringify({
    ...sample,
    activities: [
      { ...legacyActivity, resourceId: 'https://example.org/source' },
    ],
  }),
);
assert.equal(legacyUrl.activities[0].resourceRef.kind, 'legacy');
const card = {
  id: 'practice:example:0',
  sourceId: 'example',
  sourceKind: 'practice',
  front: 'Question',
  back: 'Answer',
  context: '',
  createdDate: '2026-09-13',
  dueDate: '2026-09-13',
  intervalDays: 0,
  ease: 2.5,
  repetitions: 0,
  lapses: 0,
  lastReviewedDate: null,
};
const oldCard = parseProgress(
  JSON.stringify({ ...sample, reviews: { cards: [card], events: [] } }),
);
assert.deepEqual(oldCard.reviews.cards[0].resourceRef, {
  kind: 'legacy',
  id: 'example',
});
for (const kind of [
  'local-asset',
  'builtin',
  'external',
  'vocabulary',
  'legacy',
]) {
  const resourceRef = { kind, id: 'explicit-source' };
  const progress = {
    ...sample,
    activities: [{ ...activity, resourceRef }],
    reviews: { cards: [{ ...card, resourceRef }], events: [] },
  };
  const parsed = parseProgress(JSON.stringify(progress));
  assert.deepEqual(parsed, progress);
  assert.deepEqual(parseProgress(JSON.stringify(parsed)), parsed);
  assert.equal(parsed.activities[0].resourceId, 'inflation');
}
for (const resourceRef of [
  null,
  { kind: 'unknown', id: 'x' },
  { kind: 'local-asset', id: '' },
  { kind: 'builtin', id: 1 },
]) {
  assert.throws(() =>
    parseProgress(
      JSON.stringify({ ...sample, activities: [{ ...activity, resourceRef }] }),
    ),
  );
  assert.throws(() =>
    parseProgress(
      JSON.stringify({
        ...sample,
        reviews: { cards: [{ ...card, resourceRef }], events: [] },
      }),
    ),
  );
}
assert.deepEqual(parseProgress(JSON.stringify(legacy)), legacy);
console.log(
  'Progress validation, legacy reference migration, five reference kinds and JSON round trips passed',
);

const oldEmptyKey = parseProgress(
  JSON.stringify({ ...sample, activities: [{ ...activity, resourceId: '' }] }),
);
assert.deepEqual(parseProgress(JSON.stringify(oldEmptyKey)), oldEmptyKey);
