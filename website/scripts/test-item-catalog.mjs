// Tests for lib/item-catalog.ts — loader hardening, measured-overlay join,
// and the facet filter's AND/OR semantics. Runs offline against fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readCatalog,
  readQuests,
  joinMeasured,
  attachQuests,
  filterCatalog,
  measuredGaps,
} from '../lib/item-catalog.ts';

const fixture = {
  items: {
    'Adamantite Band': {
      name: 'Adamantite Band', slots: ['FINGER1', 'FINGER2'], classes: [], allClasses: true,
      hp: 75, mana: null, ac: null, dmg: null, delay: null, skill: '',
      stats: { MSV: -10 }, flags: ['Attunable', 'Quest'], clicky: '',
      drops: [{ zone: 'Lower Guk', mobs: ['a reanimated hand'] }],
      quests: ['Call of Flame Quest'], notes: '', tags: [],
    },
    'Enchanted Fine Steel Bastard Sword': {
      name: 'Enchanted Fine Steel Bastard Sword', slots: ['PRIMARY'], classes: ['WAR', 'PAL', 'RNG', 'SHD', 'BER'], allClasses: false,
      dmg: 20, delay: 42, ac: null, hp: null, mana: null, skill: '2H Slashing',
      stats: { STR: 7 }, flags: ['Attunable'], clicky: '',
      drops: [{ zone: 'Befallen', mobs: ['Knight V`Tal'] }], quests: [], notes: '', tags: [],
    },
    Junk: { name: '', slots: [], classes: [], allClasses: false, stats: {}, flags: [], drops: [], quests: [], tags: [] },
    BadRow: null,
  },
};

const noFilters = { text: '', classes: [], slots: [], wants: [], measuredOnly: false, questFlagged: false, max: 50 };

test('readCatalog skips rows without a name or object shape', () => {
  const items = readCatalog(fixture);
  assert.equal(items.length, 2);
});

test('readCatalog survives malformed payloads', () => {
  assert.deepEqual(readCatalog(null), []);
  assert.deepEqual(readCatalog(undefined), []);
  assert.deepEqual(readCatalog({}), []);
  assert.deepEqual(readCatalog({ items: [] }), []);
  assert.deepEqual(readCatalog({ items: { a: null, b: 42 } }), []);
});

test('readCatalog coerces signed digit-strings and rejects other junk', () => {
  const items = readCatalog({
    items: {
      X: {
        name: 'X', slots: [], classes: [], allClasses: false, ac: '35', hp: '+75',
        stats: { STR: '+5', WEIRD: 'nan-ish', AGI: 'seven' }, flags: [], drops: [], quests: [], tags: [],
      },
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].ac, 35);
  assert.equal(items[0].hp, 75); // "+75" is the real catalog shape
  assert.deepEqual(items[0].stats, { STR: 5 }); // signed parses; junk strings drop
});

test('readCatalog filters drop rows without a zone and class codes against the roster', () => {
  const items = readCatalog({
    items: {
      Y: {
        name: 'Y', slots: [], classes: ['WAR', 'ZZZ'], allClasses: false, stats: {}, flags: [],
        drops: [{ zone: 'Befallen', mobs: ['a skeleton'] }, { zone: '', mobs: [] }, 'garbage'], quests: [], tags: [],
      },
    },
  });
  assert.deepEqual(items[0].classes, ['WAR']);
  assert.deepEqual(items[0].drops, [{ zone: 'Befallen', mobs: ['a skeleton'] }]);
});

test('joinMeasured overlays sightings by fold key (+enhancement variants)', () => {
  const items = readCatalog(fixture);
  joinMeasured(items, [
    { name: 'Enchanted Fine Steel Bastard Sword +1', sightings: [{ mob: 'Knight V`Tal', seen: 12 }] },
    { name: 'Unrelated Thing', sightings: [] },
  ]);
  const sword = items.find((i) => i.name.startsWith('Enchanted'));
  assert.equal(sword.measured, true);
  assert.equal(sword.observations, 12);
  assert.deepEqual(sword.measuredMobs, ['Knight V`Tal']);
});

test('joinMeasured sums sightings and de-dupes mobs; guards junk seen values', () => {
  const items = readCatalog(fixture);
  joinMeasured(items, [
    { name: 'adamantite band', sightings: [
      { mob: 'a reanimated hand', seen: 5 },
      { mob: 'a reanimated hand', seen: 3 },
      { mob: 'eye of grell', seen: -9 },
      { mob: 'eye of grell', seen: 'fourteen' },
    ] },
  ]);
  const band = items.find((i) => i.name === 'Adamantite Band');
  assert.equal(band.observations, 8);
  assert.deepEqual(band.measuredMobs.sort(), ['a reanimated hand', 'eye of grell'].sort());
});

test('filterCatalog: class facet ORs selections and allClasses serves every class', () => {
  const items = readCatalog(fixture);
  const wiz = filterCatalog(items, { ...noFilters, classes: ['WIZ'] });
  assert.deepEqual(wiz.map((i) => i.name), ['Adamantite Band']);
  const ber = filterCatalog(items, { ...noFilters, classes: ['BER', 'WAR'], slots: ['PRIMARY'] });
  assert.equal(ber.length, 1);
});

test('filterCatalog: wants ANDs across stats; slots ORs', () => {
  const items = readCatalog(fixture);
  assert.equal(filterCatalog(items, { ...noFilters, wants: ['HP', 'STR'] }).length, 0);
  assert.equal(filterCatalog(items, { ...noFilters, wants: ['STR'] }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, slots: ['FINGER1', 'PRIMARY'] }).length, 2);
});

test('filterCatalog: HP/MANA special keys read dedicated fields', () => {
  const items = readCatalog(fixture);
  assert.equal(filterCatalog(items, { ...noFilters, wants: ['HP'] }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, wants: ['MANA'] }).length, 0);
});

test('filterCatalog: measuredOnly and questFlagged gates', () => {
  const items = readCatalog(fixture);
  joinMeasured(items, [{ name: 'Adamantite Band', sightings: [{ mob: 'a reanimated hand', seen: 3 }] }]);
  assert.equal(filterCatalog(items, { ...noFilters, measuredOnly: true }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, questFlagged: true }).length, 1);
});

test('filterCatalog: text matches name, drop mob, and zone', () => {
  const items = readCatalog(fixture);
  assert.equal(filterCatalog(items, { ...noFilters, text: 'band' }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, text: 'reanimated hand' }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, text: 'befallen' }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, text: 'nothing-matches-this' }).length, 0);
});

test('measuredGaps lists feed items missing from catalog after folding', () => {
  const items = readCatalog(fixture);
  const gaps = measuredGaps(items, [
    { name: 'Adamantite Band' },
    { name: 'Enchanted Fine Steel Bastard Sword +2' },
    { name: 'Something Else Entirely' },
  ]);
  assert.deepEqual(gaps, ['Something Else Entirely']);
});

test('filterCatalog ranks measured first and honours max', () => {
  const items = readCatalog(fixture);
  joinMeasured(items, [{ name: 'Adamantite Band', sightings: [{ mob: 'm', seen: 9 }] }]);
  const out = filterCatalog(items, { ...noFilters, max: 2 });
  assert.equal(out[0].name, 'Adamantite Band');
});

// ---------- quest sidecar ----------
const questFixture = {
  quests: {
    'Call of Flame Quest': {
      name: 'Call of Flame', giver: 'Goda Coachman', givers: ['Goda Coachman'],
      startZone: 'South Qeynos', level: '50', levelKind: 'min', classes: ['Warrior'],
      relatedZones: [], rewards: ['Viper'], kind: 'epic',
    },
    'Sword. Do you know?': {
      name: 'Sword. Do you know?', giver: null, givers: [], startZone: '', level: null,
      levelKind: null, classes: [], relatedZones: [], rewards: ['Enchanted Fine Steel Bastard Sword'], kind: 'regular',
    },
  },
};

test('readQuests parses records and survives junk payloads', () => {
  assert.equal(readQuests(null).size, 0);
  assert.equal(readQuests({ quests: [] }).size, 0);
  const map = readQuests(questFixture);
  assert.equal(map.size, 2);
  const epic = map.get('Call of Flame Quest');
  assert.equal(epic.kind, 'epic');
  assert.equal(epic.giver, 'Goda Coachman');
  assert.equal(map.get('Sword. Do you know?').giver, null);
  assert.equal(map.get('Sword. Do you know?').kind, 'regular'); // unknown kinds clamp
});

test('attachQuests links items by referenced quest name and sorts epic first', () => {
  const items = readCatalog({
    items: {
      Z: { name: 'Z', slots: [], classes: [], allClasses: true, stats: {}, flags: [], drops: [], quests: ['Sword. Do you know?', 'Call of Flame Quest', 'Missing Quest'], tags: [] },
    },
  });
  attachQuests(items, readQuests(questFixture));
  assert.deepEqual(items[0].questDetails.map((q) => q.kind), ['epic', 'regular']);
});

test('filterCatalog epicOnly gate needs attached details', () => {
  const items = readCatalog(fixture);
  // Without quests attached, epicOnly filters everything out (fails closed).
  assert.equal(filterCatalog(items, { ...noFilters, epicOnly: true }).length, 0);
  attachQuests(items, readQuests(questFixture));
  const epic = filterCatalog(items, { ...noFilters, epicOnly: true });
  assert.deepEqual(epic.map((i) => i.name), ['Adamantite Band']);
});

test('filterCatalog text search reaches quest names and givers after attach', () => {
  const items = readCatalog(fixture);
  attachQuests(items, readQuests(questFixture));
  assert.equal(filterCatalog(items, { ...noFilters, text: 'goda coachman' }).length, 1);
  assert.equal(filterCatalog(items, { ...noFilters, text: 'call of flame' }).length, 1);
});

