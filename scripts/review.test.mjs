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
const reviewCode = compile('../lib/review.ts').replace(
  "from './progress'",
  `from '${progressUrl}'`,
);
const { scheduleReview, dueLabel } = await import(
  'data:text/javascript;base64,' + Buffer.from(reviewCode).toString('base64')
);
const card = {
  id: 'vocabulary:one',
  sourceId: 'one',
  sourceKind: 'vocabulary',
  front: 'retain',
  back: '保留；记住',
  context: 'retain information',
  createdDate: '2026-09-14',
  dueDate: '2026-09-14',
  intervalDays: 0,
  ease: 2.5,
  repetitions: 0,
  lapses: 0,
  lastReviewedDate: null,
};
const firstGood = scheduleReview(card, 'good', '2026-09-14');
assert.equal(firstGood.dueDate, '2026-09-15');
assert.equal(firstGood.intervalDays, 1);
const secondGood = scheduleReview(firstGood, 'good', '2026-09-15');
assert.equal(secondGood.dueDate, '2026-09-18');
assert.equal(secondGood.intervalDays, 3);
const easy = scheduleReview(card, 'easy', '2026-09-14');
assert.equal(easy.dueDate, '2026-09-18');
assert.equal(easy.ease, 2.65);
const again = scheduleReview(secondGood, 'again', '2026-09-15');
assert.equal(again.dueDate, '2026-09-15');
assert.equal(again.intervalDays, 0);
assert.equal(again.lapses, 1);
assert.equal(dueLabel(card, 'again'), '今天再看');
console.log('9 review scheduling checks passed');
