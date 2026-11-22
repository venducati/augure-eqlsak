import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  zoneGuideURL,
  resolveZoneDestination,
  companionOrigin,
} from '../lib/zone-navigation.ts';
import { defaultRules } from '../lib/build-advisor.ts';
import { atlasMaps } from '../data/atlas-maps.ts';
const guides = defaultRules.zones;

test('the shipped build hides external guide links until an origin is configured', () => {
  assert.equal(companionOrigin, '');
  assert.equal(zoneGuideURL('Castle Mistmoore'), '');
});

test('every rated zone resolves to its exact guide and correct continent waypoint', () => {
  for (const zone of guides) {
    const resolved = resolveZoneDestination(zone.name, guides, atlasMaps);
    assert.equal(resolved.guide, zone.name);
    assert.equal(resolved.waypoint, zone.name);
    assert.equal(atlasMaps[resolved.mapIndex].name, zone.continent);
    assert(
      readFileSync(
        new URL(`../public/maps/${zone.id}.txt`, import.meta.url),
        'utf8',
      ).includes('L '),
    );
  }
});

test('punctuation, short names and aliases resolve without sending the player to another zone', () => {
  for (const name of [
    "Dagnor's Cauldron",
    'Dagnor’s Cauldron',
    'dagnorscauldron',
  ]) {
    const result = resolveZoneDestination(name, guides, atlasMaps);
    assert.equal(result.waypoint, 'Dagnor’s Cauldron');
    assert.equal(result.guide, undefined);
    assert.equal(atlasMaps[result.mapIndex].name, 'Faydwer');
  }
  assert.equal(
    resolveZoneDestination('paw', guides, atlasMaps).guide,
    'Splitpaw Lair',
  );
  assert.equal(
    resolveZoneDestination('mistmoore', guides, atlasMaps).guide,
    'Castle Mistmoore',
  );
});

test('unsupported zones and malformed names cannot open a wrong default guide', () => {
  for (const value of [
    '',
    'Made Up Zone',
    'https://example.com',
    '<script>alert(1)</script>',
    'a'.repeat(121),
  ])
    assert.equal(resolveZoneDestination(value, guides, atlasMaps), null);
});

test('a configured origin yields same-origin /zone/<slug> paths that resist tampering', async () => {
  // Stage a sibling copy whose data/companion-site.json has an origin.
  // Separate module URLs dodge the JSON module cache.
  const confRoot = resolve('work/website-zone-nav-origin');
  mkdirSync(resolve(confRoot, 'lib'), { recursive: true });
  mkdirSync(resolve(confRoot, 'data'), { recursive: true });
  for (const file of ['lib/zone-navigation.ts', 'lib/zone-catalog.ts'])
    copyFileSync(resolve(file), resolve(confRoot, file));
  copyFileSync(
    resolve('data/zone-catalog.json'),
    resolve(confRoot, 'data/zone-catalog.json'),
  );
  writeFileSync(
    resolve(confRoot, 'data/companion-site.json'),
    JSON.stringify({ origin: 'https://guides.example.org/eqlsak/' }),
  );
  const nav = await import(
    pathToFileURL(resolve(confRoot, 'lib/zone-navigation.ts')).href
  );
  assert.equal(
    nav.zoneGuideURL('Castle Mistmoore'),
    'https://guides.example.org/eqlsak/zone/castle-mistmoore',
  );
  const url = new URL(nav.zoneGuideURL('Mistmoore&zone=Befallen#other'));
  assert.equal(url.origin, 'https://guides.example.org');
  assert.equal(url.password, '');
  assert.equal(
    decodeURIComponent(url.pathname),
    '/eqlsak/zone/mistmoore&zone=befallen#other',
  );
});
