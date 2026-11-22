// Item catalog loader: parses the synced EQLWiki item snapshot and joins it
// against the measured-drop loot index. Pure functions so tests can feed any
// payload shape, and malformed snapshots degrade to an empty catalog rather
// than crashing the Loot tab.

export type ItemStatBlock = Record<string, number>;

export type CatalogItem = {
  name: string;
  slots: string[];
  classes: string[];
  allClasses: boolean;
  ac: number | null;
  dmg: number | null;
  delay: number | null;
  skill: string;
  hp: number | null;
  mana: number | null;
  stats: ItemStatBlock;
  flags: string[];
  clicky: string;
  drops: { zone: string; mobs: string[] }[];
  quests: string[];
  notes: string;
  tags: string[];
  measured: boolean; // observed in combat-log sightings
  observations: number; // summed sighting count when measured
  measuredMobs: string[];
};

export type FacetFilters = {
  text: string;
  classes: string[]; // class codes, e.g. ['WAR','SHD']
  slots: string[]; // normalized slot names
  wants: string[]; // stat keys, e.g. ['STR','AGI','STA']
  measuredOnly: boolean;
  questFlagged: boolean;
  max: number;
};

// Codes as used on eqlwiki Itempage "Class:" lines (classic 16-class roster).
const CLASS_CODES = new Set(['WAR','CLR','PAL','RNG','SHD','DRU','SHM','MNK','BRD','ROG','BST','MAG','NEC','WIZ','ENC','BER']);
export const CLASS_LABELS: Record<string, string> = {
  WAR: 'Warrior', CLR: 'Cleric', PAL: 'Paladin', RNG: 'Ranger', SHD: 'Shadow Knight',
  DRU: 'Druid', SHM: 'Shaman', MNK: 'Monk', BRD: 'Bard', ROG: 'Rogue', BST: 'Beastlord',
  MAG: 'Magician', NEC: 'Necromancer', WIZ: 'Wizard', ENC: 'Enchanter', BER: 'Berserker',
};

export const SLOT_OPTIONS = ['PRIMARY', 'SECONDARY', 'RANGE', 'AMMO', 'HEAD', 'FACE', 'CHEST', 'LEGS', 'ARMS', 'HANDS', 'FEET', 'WAIST', 'WRIST', 'FOREARM', 'NECK', 'EAR1', 'EAR2', 'FINGER1', 'FINGER2', 'BACK', 'CHEST(PLATEABLE)', 'SHIRT', 'LEG(PLATEABLE)', 'ANKLE', 'BODY'];
export const STAT_OPTIONS = ['STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA', 'HP', 'MANA', 'HASTE', 'MSV', 'SR', 'MR', 'CR', 'DR', 'TR', 'PR'];

const normKey = (name: string) =>
  name.toLowerCase().replace(/[`´′']/g, "'").replace(/\s*\+\d+$/, '').replace(/\s+/g, ' ').trim();

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function asNumberOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[+-]?\d+$/.test(v.trim()) ? Number.parseInt(v, 10) : NaN;
  return Number.isSafeInteger(n) ? n : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function readCatalog(payload: unknown): CatalogItem[] {
  const raw = (payload as { items?: Record<string, unknown> })?.items;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out: CatalogItem[] = [];
  for (const entry of Object.values(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    const name = asString(v.name);
    if (!name) continue;
    const stats = (v.stats && typeof v.stats === 'object' ? v.stats : {}) as Record<string, unknown>;
    const cleanStats: ItemStatBlock = {};
    for (const [k, sv] of Object.entries(stats)) {
      const n = asNumberOrNull(sv);
      if (n !== null) cleanStats[k.toUpperCase()] = n;
    }
    const dropsRaw = Array.isArray(v.drops) ? v.drops : [];
    const drops = dropsRaw.flatMap((d: unknown) => {
      if (!d || typeof d !== 'object') return [];
      const dv = d as Record<string, unknown>;
      const zone = asString(dv.zone);
      const mobs = asStringArray(dv.mobs);
      return zone ? [{ zone, mobs }] : [];
    });
    const classes = asStringArray(v.classes).map((c) => c.toUpperCase()).filter((c) => CLASS_CODES.has(c));
    out.push({
      name,
      slots: asStringArray(v.slots).map((s) => s.toUpperCase()),
      classes,
      allClasses: v.allClasses === true,
      ac: asNumberOrNull(v.ac),
      dmg: asNumberOrNull(v.dmg),
      delay: asNumberOrNull(v.delay),
      skill: asString(v.skill),
      hp: asNumberOrNull(v.hp),
      mana: asNumberOrNull(v.mana),
      stats: cleanStats,
      flags: asStringArray(v.flags),
      clicky: asString(v.clicky),
      drops,
      quests: asStringArray(v.quests),
      notes: asString(v.notes),
      tags: asStringArray(v.tags),
      measured: false,
      observations: 0,
      measuredMobs: [],
    });
  }
  return out;
}

// Overlay measured-drop evidence (from the loot index) onto catalog items.
export function joinMeasured(catalog: CatalogItem[], measured: { name: string; sightings: { mob: string; seen: number }[] }[]): CatalogItem[] {
  const byKey = new Map<string, { name: string; sightings: { mob: string; seen: number }[] }>();
  for (const m of measured) byKey.set(normKey(m.name), m);
  for (const item of catalog) {
    const hit = byKey.get(normKey(item.name));
    if (!hit) continue;
    item.measured = true;
    item.observations = hit.sightings.reduce((t, s) => t + (Number.isSafeInteger(s.seen) ? Math.max(0, s.seen) : 0), 0);
    item.measuredMobs = [...new Set(hit.sightings.map((s) => s.mob))].slice(0, 12);
  }
  return catalog;
}

const hasAny = (item: CatalogItem, wanted: string[]) =>
  wanted.some((w) =>
    w === 'HP' ? item.hp !== null && item.hp > 0 :
    w === 'MANA' ? item.mana !== null && item.mana > 0 :
    (item.stats[w] ?? 0) > 0);

export function filterCatalog(catalog: CatalogItem[], f: FacetFilters): CatalogItem[] {
  const text = f.text.trim().toLowerCase();
  const matched = catalog.filter((item) => {
    if (f.measuredOnly && !item.measured) return false;
    if (f.questFlagged && !(item.flags.includes('Quest') || item.quests.length > 0)) return false;
    if (f.classes.length) {
      if (!item.allClasses && !f.classes.some((c) => item.classes.includes(c))) return false;
    }
    if (f.slots.length && !f.slots.some((s) => item.slots.some((is) => is.startsWith(s)))) return false;
    if (f.wants.length && !f.wants.every((w) => hasAny(item, [w]))) return false;
    if (text) {
      const hay = `${item.name} ${item.measuredMobs.join(' ')} ${item.drops.map((d) => `${d.zone} ${d.mobs.join(' ')}`).join(' ')}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
  const weight = (item: CatalogItem) =>
    (item.measured ? 2 : 0) +
    (item.flags.includes('NoRent') && !item.flags.includes('Faded') ? 1 : 0) +
    Object.keys(item.stats).length +
    (item.hp || 0) / 10 + (item.ac || 0) / 5 + (item.dmg || 0) / 3;
  matched.sort((a, b) => (b.measured ? 1 : 0) - (a.measured ? 1 : 0) || weight(b) - weight(a) || a.name.localeCompare(b.name));
  return matched.slice(0, f.max);
}

// Catalog rows for items that are measured but have no wiki page (enhancement
// variants like "+1"), inheriting the base item's facets where resolvable.
export function measuredGaps(catalog: CatalogItem[], measured: { name: string }[]): string[] {
  const present = new Set(catalog.map((i) => normKey(i.name)));
  return measured.filter((m) => !present.has(normKey(m.name))).map((m) => m.name);
}
