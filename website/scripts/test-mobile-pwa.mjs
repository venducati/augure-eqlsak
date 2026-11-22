import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { isCharacterSyncEnvelope } from '../lib/character-sync.ts';
import { readLootIndex } from '../lib/loot-index.ts';

test('PWA manifest and service worker expose the installable offline shell', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  const worker = readFileSync('public/sw.js', 'utf8');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose.includes('maskable')));
  assert.match(worker, /addEventListener\('fetch'/);
  assert.match(worker, /CACHE_URLS/);
});

test('bundled measured loot snapshot remains readable without a network request', () => {
  const snapshot = JSON.parse(readFileSync('data/eqlsource-drops.json', 'utf8'));
  const items = readLootIndex(snapshot);
  assert(items.length > 500);
  assert(items.every((item) => item.name && item.sightings.length));
});

test('future Character Sync accepts a bounded provenance-preserving manifest', () => {
  const valid = {
    schema: 'eqlsak-character-sync-v1',
    character: 'Jreel',
    server: 'Rivervale',
    createdAt: '2026-09-21T12:00:00Z',
    transport: 'file-import',
    entries: [{ kind: 'factions', fileName: 'Jreel_Rivervale-Factions.txt', provenance: 'User-Verified EQL' }],
  };
  assert.equal(isCharacterSyncEnvelope(valid), true);
  assert.equal(isCharacterSyncEnvelope({ ...valid, entries: [{ ...valid.entries[0], kind: 'passwords' }] }), false);
  assert.equal(isCharacterSyncEnvelope({ ...valid, transport: 'public-cloud' }), false);
});
