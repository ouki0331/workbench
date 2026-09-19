import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpile(
  readFileSync(
    new URL('../lib/learning-providers.ts', import.meta.url),
    'utf8',
  ),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
);
const { builtInVocabularyProvider, disabledGrammarProvider } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);

const preview = await builtInVocabularyProvider.getVocabulary({
  text: 'Diplomacy and negotiation can lead to a transparent agreement.',
  topic: 'international-politics',
  mode: 'preview',
});
assert.deepEqual(
  preview.map((entry) => entry.word),
  ['diplomacy', 'agreement', 'negotiation', 'transparent'],
);
assert.equal(preview[0].meanings.ja, '外交');

const writing = await builtInVocabularyProvider.getVocabulary({
  text: 'Should governments act?',
  topic: 'economy-finance',
  mode: 'writing',
  limit: 6,
});
assert.equal(writing.length, 6);
assert.ok(writing.some((entry) => entry.word === 'inflation'));
assert.equal(disabledGrammarProvider.available, false);

console.log('Vocabulary and grammar provider interface checks passed');
