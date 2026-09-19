import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpile(
  readFileSync(new URL('../lib/assessment.ts', import.meta.url), 'utf8'),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
);
const { estimateBand } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
assert.deepEqual(
  Array.from({ length: 9 }, (_, correct) => estimateBand(correct)),
  [3, 3.5, 4, 5, 5.5, 6, 6.5, 7, 8],
);
for (const invalid of [-1, 1.5, 9, NaN])
  assert.throws(() => estimateBand(invalid));
console.log('13 assessment score checks passed');
