import { atlasMaps } from '../data/atlas-maps.ts';
import { DUNGEONS } from '../data/dungeons.ts';
import { findZone, normalizeZone } from './zone-catalog.ts';

export const dungeonCatalog = atlasMaps.flatMap((map) => map.nodes
  .filter((node) => node[4] === 'dungeon')
  .map(([name, , , range]) => {
    const detail = DUNGEONS.find((dungeon) => dungeon.name === name);
    const zone = findZone(name);
    return {
      id: detail?.id || zone?.id || normalizeZone(name),
      name, range: detail?.range || range, continent: map.name, detail,
      aliases: zone?.aliases || [],
      availability: zone?.availability || 'Reference',
    };
  }))
  .sort((a, b) => a.continent.localeCompare(b.continent) || a.name.localeCompare(b.name));

export function findDungeon(query = '') {
  const key = normalizeZone(query);
  return key ? dungeonCatalog.find((entry) =>
    [entry.name, entry.id, ...entry.aliases].some((name) => normalizeZone(name) === key)) : undefined;
}

export function searchDungeons(query: string, continent = 'All Norrath') {
  const key = normalizeZone(query);
  return dungeonCatalog.filter((entry) =>
    (continent === 'All Norrath' || entry.continent === continent) &&
    (!key || [entry.name, entry.id, ...entry.aliases].some((name) => normalizeZone(name).includes(key))));
}
