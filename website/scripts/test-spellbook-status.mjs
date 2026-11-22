import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/SpellLibrary.tsx', 'utf8');

test('spell status summary controls open a labeled, complete numbered report', () => {
  assert.match(source, /aria-controls="spell-check-results"/);
  assert.match(source, /showSpellList\('needed'\)/);
  assert.match(source, /id="spell-check-results"/);
  assert.match(source, /NUMBERED SPELL REPORT/);
  assert.match(source, /visible\.map\(\(spell\)/);
  assert.doesNotMatch(source, /visible\.slice\(0, limit\)/);
});

test('spell status report distinguishes acquired, missing, and later spells', () => {
  assert.match(source, /Acquired \/ known/);
  assert.match(source, /Still needed/);
  assert.match(source, /Above level/);
  assert.match(source, /Select a spell to see its complete report fields/);
});
