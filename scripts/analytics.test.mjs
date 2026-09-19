import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(path) {
  return ts.transpile(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
}
const progressUrl =
  'data:text/javascript;base64,' +
  Buffer.from(compile('../lib/progress.ts')).toString('base64');
const analyticsCode = compile('../lib/analytics.ts').replace(
  "'./progress'",
  JSON.stringify(progressUrl),
);
const { localAnalyticsProvider } = await import(
  'data:text/javascript;base64,' + Buffer.from(analyticsCode).toString('base64')
);
const event = (id, kind, resourceId, seconds = 0, at = id) => ({
  id,
  date: '2026-09-15',
  at: `2026-09-15T12:00:0${at}.000Z`,
  moduleId: 'ielts',
  subjectId: 'english',
  kind,
  resourceId,
  label: resourceId,
  seconds,
});
const report = localAnalyticsProvider.weekly(
  {
    version: 1,
    profile: { target: 7, examDate: '' },
    sessions: [
      {
        id: 'session',
        date: '2026-09-15',
        skill: 'reading',
        minutes: 25,
        score: null,
        note: '',
      },
    ],
    reviews: {
      cards: [],
      events: [
        {
          id: 'review',
          cardId: 'card',
          date: '2026-09-15',
          rating: 'good',
          intervalDays: 3,
        },
      ],
    },
    assessments: [],
    activities: [
      event('1', 'article-opened', 'article-a'),
      event('2', 'article-opened', 'article-a'),
      event('3', 'word-saved', 'inflation'),
      event('4', 'listening', 'audio-a', 125),
      event('5', 'recording', 'recording-a', 61),
      event('6', 'word-known', 'inflation', 0, '6'),
      event('7', 'word-unknown', 'inflation', 0, '7'),
      event('8', 'word-known', 'tariff', 0, '8'),
    ],
  },
  '2026-09-15',
);
assert.equal(report.studyMinutes, 25);
assert.equal(report.articles, 1);
assert.equal(report.words, 1);
assert.equal(report.reviews, 1);
assert.equal(report.listeningMinutes, 2);
assert.equal(report.recordingMinutes, 1);
assert.equal(report.knownWords, 1);
assert.equal(report.sessionCount, 1);
assert.equal(report.days.at(-1).minutes, 25);
assert.equal(report.wordHistory[0].resourceId, 'tariff');
console.log('10 weekly analytics checks passed');
