import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/field-search.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source.replaceAll('export function', 'function') + '\nglobalThis.searchApi = { searchTokens, searchScore };', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
Function(js)();
const { searchTokens, searchScore } = globalThis.searchApi;
assert.deepEqual(searchTokens('Where does the Blackburrow gnoll drop loot?'), ['blackburrow', 'gnoll', 'drop', 'loot']);
assert.ok(searchScore('where is Blackburrow', 'Blackburrow', 'Antonica dungeon') > searchScore('where is Blackburrow', 'Qeynos', 'Antonica city'));
assert.ok(searchScore('gnoll fangs', 'Gnoll Fang', 'Blackburrow gnoll loot') > 0);
assert.equal(searchScore('unrelated', 'Blackburrow', 'Antonica dungeon'), 0);
console.log('Field search checks passed');
