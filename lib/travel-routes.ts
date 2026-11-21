import travel from '../data/norrath-travel.json' with { type: 'json' };
import spellCatalog from '../data/eql-spell-catalog.json' with { type: 'json' };
import { findZone, normalizeZone, zoneCatalog, type ZoneOption } from './zone-catalog.ts';

export type TravelMode = 'walk' | 'boat' | 'translocator' | 'port' | 'plane';
export interface TravelStep {
  from: string;
  to: string;
  mode: TravelMode;
  minutes: number;
  detail?: string;
  warning?: string;
  spell?: string;
  caster?: string;
  spellLevel?: number;
  npc?: string;
}
export interface TravelOptions {
  boat: boolean;
  translocator: boolean;
  /** One druid or wizard flex slot in the group: rings and gates land inside their zone from anywhere. */
  port: boolean;
  /** End-game planar orb crossings (Plane of Sky / Hate / Fear). Off unless requested. */
  plane: boolean;
}
export const defaultTravelOptions: TravelOptions = { boat: true, translocator: true, port: true, plane: false };
export interface TravelPlan {
  from: string;
  to: string;
  steps: TravelStep[];
  minutes: number;
  zones: number;
}
const MIN = travel.minutes as { walk?: number; port?: number; portal?: number } | undefined;
const minutes = { walk: MIN?.walk ?? 4, port: MIN?.port ?? 2, portal: MIN?.portal ?? 5 };

/** Resolve an EQLSaK planning name to a canonical catalog id. Generic city names (Qeynos, Kaladim…) map to their practical hub zone. */
export function travelZoneId(name: string, zones: ZoneOption[] = zoneCatalog): string | null {
  const generic = (travel.generic ?? {}) as Record<string, string>;
  const key = normalizeZone(name);
  if (generic[key]) {
    const hub = zones.find((zone) => zone.id === generic[key]);
    if (hub) return hub.id;
    const parts = zones.filter((zone) => normalizeZone(zone.name).includes(key)).sort((a, b) => a.name.length - b.name.length);
    return parts[0]?.id ?? findZone(name, zones)?.id ?? null;
  }
  return findZone(name, zones)?.id ?? null;
}

export interface TravelNode {
  id: string;
  name: string;
  continent: string;
  aliases: string[];
  availability: string;
}
const byId = new Map(zoneCatalog.map((zone) => [zone.id, zone]));
export function travelNode(id: string): TravelNode {
  return byId.get(id) ?? { id, name: id, continent: 'Unknown', aliases: [], availability: 'unknown' };
}
export function isCurrentZone(id: string) {
  return (byId.get(id)?.availability ?? 'current') === 'current';
}
function usableZone(name: string): string | null {
  const id = travelZoneId(name);
  return id && isCurrentZone(id) ? id : null;
}

/** Validate one graph record from the shipped data. Returns an error string, or null when usable. */
export function validateTravelEdge(edge: unknown): string | null {
  const e = edge as Partial<{ from: string; to: string; kind: string; spell: string; npc: string; minutes: number }>;
  if (!e || typeof e !== 'object') return 'edge is not an object';
  const mode = (e.kind ?? (e.spell ? 'port' : e.npc ? 'translocator' : e.minutes ? 'boat' : '')) as TravelMode;
  const validModes: TravelMode[] = ['walk', 'boat', 'translocator', 'port', 'plane'];
  if (!validModes.includes(mode)) return `edge has unknown mode '${String(e.kind ?? '')}'`;
  const sides: ('from' | 'to')[] = mode === 'port' ? ['to'] : ['from', 'to'];
  for (const side of sides) {
    const value = e[side];
    if (typeof value !== 'string' || !value.trim()) return `edge ${side} is missing`;
    const id = travelZoneId(value);
    if (!id) return `edge ${side} '${value}' is not in the zone catalog`;
    if (!isCurrentZone(id)) return `edge ${side} '${value}' is marked ${travelNode(id).availability} in the zone catalog`;
  }
  if (mode === 'port') {
    if (!e.spell) return 'port edge is missing a spell';
    const spell = spellCatalog.spells.find((s) => s.name === e.spell);
    if (!spell) return `port spell '${e.spell}' is not in the EQL spell catalog`;
    if (!spell.classes?.length) return `port spell '${e.spell}' lists no classes`;
  }
  if (mode === 'boat' && !(typeof e.minutes === 'number' && e.minutes > 0)) return 'boat edge needs positive minutes';
  return null;
}

interface RawEdge { from: string | null; to: string; mode: TravelMode; minutes: number; extra: Partial<TravelStep> }
function portInfo(name?: string): Partial<TravelStep> {
  if (!name) return {};
  const spell = spellCatalog.spells.find((s) => s.name === name);
  if (!spell) return { spell: name };
  const casters = [...new Set((spell.classes ?? []).map((c) => c.id))].sort();
  return { spell: name, caster: casters.join('/'), spellLevel: spell.level };
}
export function travelEdges(): RawEdge[] {
  return [
    ...(travel.links ?? []).map((l) => ({ from: l.from, to: l.to, mode: 'walk' as TravelMode, minutes: minutes.walk, extra: { detail: (l as { detail?: string }).detail } })),
    ...(travel.boats ?? []).map((l) => ({ from: l.from, to: l.to, mode: 'boat' as TravelMode, minutes: l.minutes, extra: { detail: l.detail } })),
    ...(travel.translocators ?? []).map((l) => ({ from: l.from, to: l.to, mode: 'translocator' as TravelMode, minutes: minutes.port, extra: { npc: l.npc, detail: l.detail } })),
    ...(travel.ports ?? []).map((l) => ({ from: null, to: l.zone, mode: 'port' as TravelMode, minutes: minutes.port, extra: portInfo(l.spell) })),
    ...(travel.planes ?? []).map((l) => ({ from: l.from, to: l.to, mode: 'plane' as TravelMode, minutes: minutes.portal, extra: { detail: l.detail, warning: l.warning } }))
  ];
}
interface Edge { to: string; minutes: number; step: Omit<TravelStep, 'from'> }
function buildEdges(options: TravelOptions): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();
  const add = (id: string, edge: Edge) => {
    const list = graph.get(id) ?? [];
    list.push(edge);
    graph.set(id, list);
  };
  for (const edge of travelEdges()) {
    if (edge.mode === 'port') continue; // cast anywhere: handled as a virtual first hop, not a graph edge
    if (edge.mode !== 'walk' && !options[edge.mode]) continue;
    const invalid = validateTravelEdge({ from: edge.from ?? undefined, to: edge.to, kind: edge.mode, spell: (edge.extra as { spell?: string }).spell, npc: (edge.extra as { npc?: string }).npc, minutes: edge.minutes });
    if (invalid) continue; // never route through an unvalidated edge
    const from = usableZone(edge.from!), to = usableZone(edge.to)!;
    if (!from || !to || from === to) continue;
    const step: Omit<TravelStep, 'from'> = { to, mode: edge.mode, minutes: edge.minutes, ...edge.extra };
    add(from, { to, minutes: edge.minutes, step });
    if (edge.mode === 'walk') add(to, { to: from, minutes: edge.minutes, step: { ...step, to: from } });
  }
  return graph;
}
/** The cheapest druid/wizard port landing inside `to`, if one exists and ports are enabled. */
function bestPortHop(to: string, options: TravelOptions): Edge | null {
  if (!options.port) return null;
  let best: Edge | null = null;
  for (const edge of travelEdges()) {
    if (edge.mode !== 'port') continue;
    if (validateTravelEdge({ to: edge.to, kind: 'port', spell: (edge.extra as { spell?: string }).spell })) continue;
    if (usableZone(edge.to) !== to) continue;
    if (!best || edge.minutes < best.minutes) best = { to, minutes: edge.minutes, step: { to, mode: 'port', minutes: edge.minutes, ...edge.extra } };
  }
  return best;
}

/** Cheapest-minute route between two EQLSaK planning zone names. Null when unreachable with the chosen options. */
export function planTravel(fromName: string, toName: string, options: TravelOptions = defaultTravelOptions): TravelPlan | null {
  const from = usableZone(fromName), to = usableZone(toName);
  if (!from || !to) return null;
  if (from === to) return { from, to, steps: [], minutes: 0, zones: 0 };
  const graph = buildEdges(options);
  const best = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { node: string; edge: Edge }>();
  const port = bestPortHop(to, options);
  if (port) { best.set(to, port.minutes); previous.set(to, { node: from, edge: port }); }
  const visited = new Set<string>();
  while (true) {
    let current: string | null = null, currentCost = Infinity;
    for (const [node, cost] of best) if (!visited.has(node) && cost < currentCost) { current = node; currentCost = cost; }
    if (current === null || current === to) break;
    visited.add(current);
    for (const edge of graph.get(current) ?? []) {
      const cost = currentCost + edge.minutes;
      if (cost < (best.get(edge.to) ?? Infinity)) { best.set(edge.to, cost); previous.set(edge.to, { node: current, edge }); }
    }
  }
  if (!previous.has(to)) return null;
  const steps: TravelStep[] = [];
  let cursor = to;
  while (cursor !== from) {
    const head = previous.get(cursor)!;
    steps.unshift({ from: head.node, ...head.edge.step });
    cursor = head.node;
  }
  const zones = new Set(steps.map((s) => s.to));
  zones.add(from);
  return { from, to, steps, minutes: best.get(to)!, zones: zones.size };
}

export const travelModeLabels: Record<TravelMode, string> = {
  walk: 'On foot',
  boat: 'Boat',
  translocator: 'Translocator',
  port: 'Port spell',
  plane: 'Planar portal'
};
export const travelFare = travel.fare ?? '';
export const travelBoatWait = travel.boatWait ?? '';
