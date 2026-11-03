// Regression tests for the delimiter-aware active prompt tokenizer.
// Run with: npm install && npm test
// The source is TypeScript; transpile it in memory so tests exercise the actual
// checked-in module rather than a separately maintained JavaScript copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../client/synchroniseCurrentPrompts/tokenizePrompt.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: sourcePath,
});
const moduleObject = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  exports: moduleObject.exports,
  module: moduleObject,
});
const tokenizePrompt = moduleObject.exports.default;

function asPlainTokens(value, extendedSyntax = true) {
  return tokenizePrompt(value, extendedSyntax).map(({ type, value }) => ({ type, value }));
}

test('untouched supported prompts round-trip exactly', () => {
  const cases = [
    'red, blue',
    'red; blue',
    'red. blue! green? yellow',
    'first line\nsecond line\tthird line',
    'foreground BREAK background',
    'foreground\nBREAK\nbackground',
    '(red; blue:1.25), <lora:style:0.8>, [option:0.4]',
    '{red|blue}, background',
    '1.25, 2.5, red.blue',
    'red\\, blue; green',
    '夜，光；影。 暗！ 明？',
    'a, b. ',
  ];
  for (const value of cases) {
    assert.equal(asPlainTokens(value).map((token) => token.value).join(''), value, value);
  }
});

test('top-level punctuation and whitespace are separators', () => {
  assert.deepEqual(asPlainTokens('red; blue\ngreen'), [
    { type: 'prompt', value: 'red' },
    { type: 'separator', value: '; ' },
    { type: 'prompt', value: 'blue' },
    { type: 'separator', value: '\n' },
    { type: 'prompt', value: 'green' },
  ]);
});

test('decimal values, network syntax and escaped delimiters do not split', () => {
  assert.deepEqual(asPlainTokens('(glow:1.25), <lora:style:0.8>, red\\, blue'), [
    { type: 'prompt', value: '(glow:1.25)' },
    { type: 'separator', value: ', ' },
    { type: 'prompt', value: '<lora:style:0.8>' },
    { type: 'separator', value: ', ' },
    { type: 'prompt', value: 'red\\, blue' },
  ]);
});

test('standalone BREAK is syntax; the word BREAKDOWN is not', () => {
  const tokens = asPlainTokens('BREAKDOWN BREAK shadow');
  assert.equal(tokens.filter((token) => token.type === 'syntax').length, 1);
  assert.equal(tokens.find((token) => token.type === 'syntax').value, 'BREAK');
  assert.equal(tokens.map((token) => token.value).join(''), 'BREAKDOWN BREAK shadow');
});

test('period within a word is not sentence-ending punctuation', () => {
  assert.deepEqual(asPlainTokens('red.blue'), [
    { type: 'prompt', value: 'red.blue' },
  ]);
});

test('extended syntax can be disabled without damaging original text', () => {
  const value = '{red|blue}, sky';
  const tokens = asPlainTokens(value, false);
  assert.equal(tokens.map((token) => token.value).join(''), value);
  assert.equal(tokens.some((token) => token.type === 'syntax'), false);
});
