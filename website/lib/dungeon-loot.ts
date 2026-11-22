import type { Spawn } from '../data/dungeons.ts';
import type { LootIndexItem } from './loot-index.ts';
import { normalizeZone } from './zone-catalog.ts';

export type DungeonMobDrop = {
  name: string;
  tier: 'named' | 'elite' | 'lesser';
  drops: { name: string; observations?: number }[];
  provenance: 'Measured EQL sightings' | 'EQL-specific reference' | 'Legacy EQ unverified';
  note?: string;
};

const observedZoneAliases: Record<string, string[]> = {
  castlemistmoore: ['The Castle of Mistmoore'],
  crushbone: ['Clan Crushbone'],
  cazicthule: ['Temple of Cazic-Thule'],
  lowerguk: ['The Ruins of Old Guk'],
  upperguk: ['The City of Guk'],
  nagafenslair: ["Nagafen's Lair", "Nagafen's Lair - Group"],
  permafrostkeep: ['The Permafrost Caverns', 'The Permafrost Caverns - Group'],
  thehole: ['The Ruins of Old Paineel', 'The Ruins of Old Paineel - Group'],
};

const cleanMob = (name: string) => name.trim().replace(/\s+/g, ' ');
const mobKey = (name: string) => normalizeZone(cleanMob(name));

function zoneKeys(name: string, id: string, aliases: string[]) {
  return new Set([name, id, ...aliases, ...(observedZoneAliases[normalizeZone(name)] || [])].map(normalizeZone));
}

function referenceProvenance(source: string): DungeonMobDrop['provenance'] {
  return /User-Verified|EQL Source|EQL wiki|EQL-/i.test(source)
    ? 'EQL-specific reference'
    : 'Legacy EQ unverified';
}

function referenceDrops(text: string) {
  if (/no verified|various|incomplete|verify|pending/i.test(text)) return [];
  return text.split(/\s*·\s*/).map((name) => ({ name: name.trim() })).filter((drop) => drop.name);
}

export function dungeonMobDrops(input: {
  name: string;
  id: string;
  aliases?: string[];
  spawns?: Spawn[];
  lootIndex: LootIndexItem[];
}): DungeonMobDrop[] {
  const keys = zoneKeys(input.name, input.id, input.aliases || []);
  const knownNamed = new Map((input.spawns || []).map((spawn) => [mobKey(spawn.name), spawn]));
  const rows = new Map<string, DungeonMobDrop>();

  for (const item of input.lootIndex) {
    for (const sighting of item.sightings) {
      if (!sighting.sessions.some((session) => session.zone && keys.has(normalizeZone(session.zone)))) continue;
      const key = mobKey(sighting.mob);
      const named = knownNamed.has(key);
      const literalElite = /\belite\b/i.test(sighting.mob);
      const row = rows.get(key) || {
        name: cleanMob(sighting.mob),
        tier: named ? 'named' : literalElite ? 'elite' : 'lesser',
        drops: [],
        provenance: 'Measured EQL sightings' as const,
      };
      const prior = row.drops.find((drop) => mobKey(drop.name) === mobKey(item.name));
      if (prior) prior.observations = Math.max(prior.observations || 0, sighting.seen);
      else row.drops.push({ name: item.name, observations: sighting.seen });
      rows.set(key, row);
    }
  }

  for (const spawn of input.spawns || []) {
    const key = mobKey(spawn.name);
    const measured = rows.get(key);
    if (measured) {
      measured.tier = 'named';
      continue;
    }
    const drops = referenceDrops(spawn.loot);
    rows.set(key, {
      name: spawn.name,
      tier: 'named',
      drops,
      provenance: referenceProvenance(spawn.source),
      note: drops.length ? 'Candidate drops from the named-NPC reference; not a measured drop rate.' : spawn.loot,
    });
  }

  const rank = { named: 0, elite: 1, lesser: 2 };
  return [...rows.values()]
    .map((row) => ({ ...row, drops: row.drops.sort((a, b) => (b.observations || 0) - (a.observations || 0) || a.name.localeCompare(b.name)) }))
    .sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name));
}
