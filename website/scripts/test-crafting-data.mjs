import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const snapshot = JSON.parse(readFileSync('data/eql-recipes.json', 'utf8'));

test('offline crafting catalog retains complete strict recipe records and source evidence', () => {
  assert.equal(snapshot.schema, 'eqlsak-recipes-v1');
  assert.equal(snapshot.records.length, 1728);
  assert(snapshot.records.every((recipe) => recipe.name && recipe.slug && recipe.variants.length));
  assert(snapshot.records.every((recipe) => recipe.provenance.some((source) => source.uri?.startsWith('https://eqlwiki.com/'))));
  assert(snapshot.records.flatMap((recipe) => recipe.variants).every((variant) => variant.skill && variant.container && Array.isArray(variant.components)));
});

test('crafting UI does not promote legacy recipe evidence to verified EQL', () => {
  const source = readFileSync('components/CraftingGuide.tsx', 'utf8');
  assert.match(source, /Legacy EQ unverified/);
  assert.match(source, /verify valuable combines in game/);
  assert.match(source, /eqlsak-craft-plan-v1/);
});

test('recipe source controls navigate visibly instead of opening a hidden background tab', () => {
  const source = readFileSync('components/CraftingGuide.tsx', 'utf8');
  assert.match(source, /Open source page for/);
  assert.match(source, />Open source page <ExternalLink/);
  assert.doesNotMatch(source, /target="_blank"/);
  assert(snapshot.records.every((recipe) => recipe.provenance.every((entry) => !entry.uri || /^https:\/\/eqlwiki\.com\//.test(entry.uri))));
});
