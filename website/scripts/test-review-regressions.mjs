import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DUNGEONS } from '../data/dungeons.ts';
import { atlasMaps } from '../data/atlas-maps.ts';
import { dungeonCatalog, findDungeon, searchDungeons } from '../lib/dungeon-catalog.ts';
import { resolveZoneDestination } from '../lib/zone-navigation.ts';
import { parseMap, mapBounds, mapFloors, floorPaths, wirePaths, projectPoint, parseMapCoordinate } from '../lib/dungeon-map.ts';
import { parseLog, buildEncounters, encounterBuckets, readLogFile } from '../lib/log-report.ts';
import { parseCombatLine } from '../lib/combat-meter.ts';
import { parseCharacterReport, isFactionReport, splitReportRow } from '../lib/character-report.ts';
import { spellColumns, spellFields } from '../lib/spell-report.ts';
import { emptyStats, gearDelta, statValue } from '../lib/gear-plan.ts';
import { writeSpellIconManifest } from './spell-icon-manifest.mjs';
import { dungeonMobDrops } from '../lib/dungeon-loot.ts';
import { buildAtlasVoyage } from '../lib/atlas-voyage.ts';

const at = Date.parse('2026-09-11T12:00:00Z');
const line = (seconds, body) => `[${new Date(at + seconds * 1000).toISOString()}] ${body}`;
test('all 32 atlas dungeons route to their own dossier, including reference-only destinations', () => {
  assert.equal(dungeonCatalog.length, 32);
  assert.equal(new Set(dungeonCatalog.map((entry) => entry.id)).size, 32);
  for (const entry of dungeonCatalog) {
    const result = resolveZoneDestination(entry.name, dungeonCatalog, atlasMaps);
    assert.equal(result.guide, entry.name);
    assert.equal(result.waypoint, entry.name);
  }
  assert.equal(findDungeon('gukbottom').name, 'Lower Guk');
  assert.equal(findDungeon('Chardok').detail, undefined);
  assert.equal(searchDungeons("Solusek's Eye")[0].name, 'Solusek’s Eye');
  assert(searchDungeons('', 'Faydwer').every((entry) => entry.continent === 'Faydwer'));
  assert.equal(findDungeon('not a real dungeon'), undefined);
});
test('every shipped dossier map renders as at most eight path groups', () => {
  for (const dungeon of DUNGEONS) {
    const segments = parseMap(readFileSync(`public/maps/${dungeon.id}.txt`, 'utf8'));
    const bounds = mapBounds(segments), floors = mapFloors(segments);
    assert(Object.values(bounds).every(Number.isFinite));
    for (const paths of [floorPaths(segments, floors), wirePaths(segments, bounds, { yaw: -.62, pitch: .72, z: 0 })]) {
      assert(paths.length > 0 && paths.length <= 8);
      assert(paths.every((path) => !/NaN|Infinity/.test(path.d)));
    }
  }
});
test('Z movement changes the projected position while the camera bounds remain stable', () => {
  const geometry = parseMap('L 0,0,0,100,100,50');
  const bounds = mapBounds(geometry), before = { ...bounds };
  const a = projectPoint(50, 50, 25, bounds, { yaw: .6, pitch: .72, z: 0 });
  const b = projectPoint(50, 50, 25, bounds, { yaw: .6, pitch: .72, z: 50 });
  assert.equal(a.x, b.x); assert(b.y < a.y); assert.deepEqual(bounds, before);
});

test('coordinate lookup accepts EQL-style pairs and triples without guessing malformed input', () => {
  assert.deepEqual(parseMapCoordinate('120, -48, 17'), { x: 120, y: -48, z: 17 });
  assert.deepEqual(parseMapCoordinate('120 -48'), { x: 120, y: -48 });
  assert.equal(parseMapCoordinate('120 only'), null);
  assert.equal(parseMapCoordinate('1, 2, 3, 4'), null);
});
test('large geometry avoids argument-stack overflow and malformed coordinates are rejected', () => {
  const large = Array.from({ length: 150000 }, (_, i) => ({ x1: i, y1: 1, z1: 0, x2: i + 1, y2: 2, z2: 5 }));
  assert.equal(mapBounds(large).width, 150050);
  assert(wirePaths(large, mapBounds(large), { yaw: 0, pitch: 1, z: 0 }, true).length <= 8);
  for (const text of ['L 0,,0,1,2,3', 'L 0,Infinity,0,1,2,3', 'L 0,0,0,1,2,3000000', '<html>Unavailable</html>']) assert.throws(() => parseMap(text));
});
test('incoming hits and interleaved targets no longer split one enemy fight into fragments', () => {
  const events = parseLog([
    line(0, 'You hit a gnoll for 20 points of damage.'),
    line(1, 'a gnoll hits YOU for 7 points of damage.'),
    line(2, 'You kick a rat for 5 points of damage.'),
    line(3, 'a gnoll hits Ally for 9 points of damage.'),
    line(4, 'You hit a gnoll for 30 points of damage.'),
    line(5, 'You have slain a gnoll!'),
    line(6, 'You hit a gnoll for 11 points of damage.'),
  ].join('\n'));
  const fights = buildEncounters(events);
  assert.equal(fights.length, 3);
  assert.equal(fights[0].damage.length, 2);
  assert.equal(fights[0].slain, true);
  assert.equal(fights[2].damage[0].amount, 11);
});
test('histogram boundaries count each hit once, including the last hit', () => {
  const damage = parseLog([0, 1, 2, 3, 4].map((s) => line(s, 'You hit a gnoll for 10 points of damage.')).join('\n'));
  const [fight] = buildEncounters(damage);
  const bins = encounterBuckets(fight, 4);
  assert.equal(bins.reduce((total, amount) => total + amount, 0), 50);
  assert.deepEqual(bins, [10, 10, 10, 20]);
});
test('saved logs recognize comma-separated melee damage and do not accept infinite amounts', () => {
  const [event] = parseLog(line(0, 'You hit a gnoll for 1,200 points of damage. (Critical)'));
  assert.equal(event.amount, 1200); assert.equal(event.critical, true);
  // The current parser never returns null for a stamped line: unusable amounts
  // degrade to a visible 'unknown' event (root fork 1.6+ behaviour) instead of
  // vanishing, and the log reader still files the line as plain text.
  const huge = parseCombatLine(line(0, `You hit a gnoll for ${'9'.repeat(350)} points of damage.`));
  assert.equal(huge.kind, 'unknown'); assert.equal(huge.amount, 0);
  assert.equal(parseLog(line(0, `You hit a gnoll for ${'9'.repeat(350)} points of damage.`))[0].kind, 'text');
});
test('chunked log import preserves multibyte text, line IDs, CRLF and a final partial line', async () => {
  const lines = Array.from({ length: 7000 }, (_, i) => line(i, `You say, 'café ${i}'`));
  const progress = [];
  const events = await readLogFile(new Blob([lines.join('\r\n')]), { onProgress: (value) => progress.push(value) });
  assert.equal(events.length, lines.length); assert.equal(events.at(-1).id, 6999);
  assert(events.at(-1).raw.includes('café 6999')); assert.equal(progress.at(-1), 100); assert(progress.length > 1);
});
test('empty, oversized-line and cancelled log imports report a useful failure', async () => {
  await assert.rejects(readLogFile(new Blob([''])), /empty/);
  await assert.rejects(readLogFile(new Blob(['a'.repeat(9000)])), /long/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readLogFile(new Blob([line(0, 'You wave.')]), { signal: controller.signal }), /./);
});
test('character reports retain quoted item names and inventory cannot become a faction chart', () => {
  assert.deepEqual(splitReportRow('1,"Sword, Runed",100,5'), ['1', 'Sword, Runed', '100', '5']);
  const inventory = parseCharacterReport('1\tSword\t100\t5');
  assert.equal(isFactionReport('Jreel_rivervale-Inventory.txt', inventory), false);
  assert.equal(isFactionReport('Jreel_rivervale-Factions.txt', inventory), true);
  assert.equal(isFactionReport('Pasted text', parseCharacterReport('ID\tName\tStringValue\tPointsToMax')), true);
  assert.throws(() => parseCharacterReport('binary\0text'), /readable/);
});
test('spell headers identify names, levels and IDs; an unidentified numeric ID is not a level', () => {
  const rows = parseCharacterReport('SpellID\tSpellName\tLevel\tClass\n5\tMinor Healing\t1\tCleric');
  const columns = spellColumns(rows);
  assert.equal(spellFields(rows[0], columns, []), null);
  assert.deepEqual(spellFields(rows[1], columns, []), { name: 'Minor Healing', level: 1, id: '5' });
  assert.equal(spellFields(parseCharacterReport('5\tMinor Healing')[0], null, []).level, undefined);
});
test('class spell catalog remains complete, attributed and comparison-ready', () => {
  const catalog = JSON.parse(readFileSync('data/eqlwiki-spells.json', 'utf8'));
  assert.equal(catalog.source.license, 'CC BY-SA 4.0');
  assert.equal(catalog.classes.length, 12);
  assert(catalog.spells.length >= 1600);
  for (const entry of catalog.classes) {
    const spells = catalog.spells.filter((spell) => spell.classCode === entry.code);
    assert(spells.length >= 60, `${entry.name} catalog is unexpectedly small`);
    assert(spells.every((spell) => spell.name && Number.isInteger(spell.level) && spell.level >= 1 && spell.level <= 60));
  }
  const clericNames = new Set(catalog.spells.filter((spell) => spell.classCode === 'CLR').map((spell) => spell.name));
  assert(clericNames.has('Minor Healing'));
  assert(clericNames.has('Superior Healing'));
});
test('slash command catalog keeps an inline description for every indexed command', () => {
  const catalog = JSON.parse(readFileSync('data/eqlwiki-commands.json', 'utf8'));
  assert.equal(catalog.length, 265);
  assert(catalog.every((entry) => typeof entry.syntax === 'string' && entry.syntax.startsWith('/')));
  assert(catalog.every((entry) => typeof entry.description === 'string' && entry.description.trim().length > 0));
  assert.equal(catalog.find((entry) => entry.syntax === '/faction')?.description, 'Toggles the "Factions" window. Here you can view your character\'s standing with various factions.');
});
test('gear replacement benefits subtract the old item and keep losses', () => {
  const bonuses = { ...emptyStats(), STR: 12, HP: 25 }, replaced = { ...emptyStats(), STR: 8, HP: 40 };
  const delta = gearDelta([{ bonuses, replaced }]);
  assert.equal(delta.STR, 4); assert.equal(delta.HP, -15);
  assert.equal(statValue('Infinity'), 0); assert.equal(statValue('1e300'), 1000000);
});
test('spell image manifest advertises only real supported image files', () => {
  mkdirSync('work', { recursive: true });
  const root = mkdtempSync(resolve('work/review-icons-'));
  mkdirSync(join(root, 'spell-icons'));
  writeFileSync(join(root, 'spell-icons', 'minor-healing.png'), 'fixture');
  writeFileSync(join(root, 'spell-icons', 'notes.txt'), 'ignored');
  assert.equal(writeSpellIconManifest(root), 1);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'spell-icons', 'index.json'), 'utf8')), ['minor-healing.png']);
});
test('dungeon mob intelligence separates measured lesser mobs from named references', () => {
  const blackburrow = findDungeon('Blackburrow');
  const rows = dungeonMobDrops({
    name: blackburrow.name,
    id: blackburrow.id,
    aliases: blackburrow.aliases,
    spawns: blackburrow.detail.spawns,
    lootIndex: [
      { name: 'Gnoll Fang', sightings: [{ mob: 'a gnoll bouncer', seen: 7, sessions: [{ zone: 'Blackburrow' }] }] },
      { name: 'Wrong Zone Item', sightings: [{ mob: 'a gnoll bouncer', seen: 99, sessions: [{ zone: 'Befallen' }] }] },
    ],
  });
  const lesser = rows.find((row) => row.name === 'a gnoll bouncer');
  assert.equal(lesser.tier, 'lesser');
  assert.deepEqual(lesser.drops, [{ name: 'Gnoll Fang', observations: 7 }]);
  const named = rows.find((row) => row.name === 'Lord Elgnub');
  assert.equal(named.tier, 'named');
  assert.equal(named.provenance, 'EQL-specific reference');
  assert(named.drops.some((drop) => drop.name === 'Wicked Sallet'));
});
test('known EQL log-zone names attach to their matching dossier only', () => {
  const lootIndex = [{ name: 'Test Relic', sightings: [{ mob: 'A test elite', seen: 3, sessions: [{ zone: 'The Castle of Mistmoore' }] }] }];
  const mistmoore = findDungeon('Castle Mistmoore');
  const befallen = findDungeon('Befallen');
  const matched = dungeonMobDrops({ name: mistmoore.name, id: mistmoore.id, aliases: mistmoore.aliases, lootIndex });
  const unmatched = dungeonMobDrops({ name: befallen.name, id: befallen.id, aliases: befallen.aliases, lootIndex });
  assert.equal(matched[0].tier, 'elite');
  assert.equal(matched[0].drops[0].observations, 3);
  assert.equal(unmatched.length, 0);
});
test('atlas voyage draws boat passages and distinguishes route endpoints from stops', () => {
  const nodes = [
    ['East Freeport', 82, 45, '1–10', 'city'],
    ['North Ro', 79, 57, '5–20', 'wild'],
  ];
  const route = ['East Freeport', 'Ocean of Tears', 'Butcherblock Mountains'];
  const plan = buildAtlasVoyage(nodes, route, [
    { from: 'East Freeport', to: 'Ocean of Tears', mode: 'Boat' },
    { from: 'Ocean of Tears', to: 'Butcherblock Mountains', mode: 'Boat' },
  ]);
  assert.equal(plan.hasBoat, true);
  assert.equal(plan.points[0].role, 'departure');
  assert.equal(plan.paths.length, 1);
  assert.equal(plan.paths[0].partial, true);
  assert.match(plan.paths[0].d, /^M 82 45 Q /);
});
test('atlas voyage shows destination and intermediate glows for visible route points', () => {
  const nodes = [
    ['Ocean of Tears', 24, 76, 'Travel', 'travel'],
    ['Butcherblock Mountains', 19, 43, '1–20', 'wild'],
    ['Castle Mistmoore', 42, 80, '20–45', 'dungeon'],
  ];
  const route = ['East Freeport', 'Ocean of Tears', 'Butcherblock Mountains', 'Castle Mistmoore'];
  const plan = buildAtlasVoyage(nodes, route, [
    { from: 'East Freeport', to: 'Ocean of Tears', mode: 'Boat' },
    { from: 'Ocean of Tears', to: 'Butcherblock Mountains', mode: 'Boat' },
    { from: 'Butcherblock Mountains', to: 'Castle Mistmoore', mode: 'Land boundary' },
  ]);
  assert.deepEqual(plan.points.map((point) => point.role), ['stop', 'stop', 'destination']);
  assert.equal(plan.paths.filter((path) => path.boat).length, 2);
  assert.equal(plan.paths.filter((path) => !path.boat).length, 1);
});

test('home field brief connects recommendations to route, dossier, loot and evidence', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /Your next move/);
  assert.match(page, /Refresh my picks/);
  assert.match(page, /Route there/);
  assert.match(page, /Open dossier/);
  assert.match(page, /Check loot/);
  assert.match(page, /provenanceClass\(place\.source as Source\)/);
  assert.match(page, /Open another tool/);
});
