import { findZone, normalizeZone, zoneCatalog } from './zone-catalog.ts';
import companionSite from '../data/companion-site.json' with { type: 'json' };

/** Optional self-hosted companion site. Empty until the owner sets an origin. */
export const companionOrigin = (companionSite.origin || '').trim();

/** Links carry only a zone name; character, faction and build data stay local. Returns '' when no companion site is configured. */
export function zoneGuideURL(zone: string) {
  if (!companionOrigin) return '';
  const slug = zone
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return `${companionOrigin.replace(/\/+$/, '')}/zone/${encodeURIComponent(slug)}`;
}

type Guide = { id: string; name: string };
type Atlas = {
  name: string;
  nodes: readonly (readonly [string, number, number, string, string])[];
};
export type ZoneDestination = {
  name: string;
  guide?: string;
  mapIndex?: number;
  waypoint?: string;
};

/** Resolve names, game short names and aliases against the guides we actually have. */
export function resolveZoneDestination(
  raw: string,
  guides: readonly Guide[],
  maps: readonly Atlas[],
): ZoneDestination | null {
  const query = raw.trim();
  if (!query || query.length > 120) return null;
  const key = normalizeZone(query);
  const known =
    findZone(query) ||
    zoneCatalog.find((zone) => normalizeZone(zone.id) === key);
  const keys = new Set([
    key,
    ...[known?.name, known?.id, ...(known?.aliases || [])]
      .filter((value): value is string => !!value)
      .map(normalizeZone),
  ]);
  const guide = guides.find(
    (zone) =>
      keys.has(normalizeZone(zone.name)) || keys.has(normalizeZone(zone.id)),
  );
  if (guide) keys.add(normalizeZone(guide.name));
  const mapIndex = maps.findIndex((map) =>
    map.nodes.some(([name]) => keys.has(normalizeZone(name))),
  );
  const waypoint =
    mapIndex >= 0
      ? maps[mapIndex].nodes.find(([name]) =>
          keys.has(normalizeZone(name)),
        )?.[0]
      : undefined;
  if (!guide && !waypoint) return null;
  return {
    name: guide?.name || waypoint!,
    guide: guide?.name,
    mapIndex: mapIndex >= 0 ? mapIndex : undefined,
    waypoint,
  };
}
