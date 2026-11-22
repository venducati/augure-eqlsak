export type Segment = { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number };
export type MapBounds = { cx: number; cy: number; cz: number; width: number; height: number; depth: number; radius: number; minZ: number; maxZ: number };
export type WireView = { yaw: number; pitch: number; z: number };
export type MapCoordinate = { x: number; y: number; z?: number };
export const layerColors = ['#71c7ff', '#bda4ff', '#ff98b0', '#f7bd72', '#f4e58c', '#8bded6', '#8ca9ff', '#dcadf4'];

export function parseMap(text: string): Segment[] {
  if (text.length > 20_000_000) throw new Error('This map is too large for the viewer.');
  const segments: Segment[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/^L\s/.test(line)) continue;
    const fields = line.slice(2).split(',').slice(0, 6);
    const n = fields.map(Number);
    if (fields.length !== 6 || fields.some((value) => !value.trim()) || !n.every((value) => Number.isFinite(value) && Math.abs(value) <= 1_000_000)) continue;
    segments.push({ x1: n[0], y1: n[1], z1: n[2], x2: n[3], y2: n[4], z2: n[5] });
    if (segments.length > 200_000) throw new Error('This map exceeds the viewer’s line limit.');
  }
  if (!segments.length) throw new Error('No readable map lines were found.');
  return segments;
}

// Loop over coordinates: spreading large maps into Math.min/max can crash the tab.
export function mapBounds(segments: Segment[]): MapBounds {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
    minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2);
  }
  if (!segments.length) return { cx: 0, cy: 0, cz: 0, width: 200, height: 200, depth: 0, radius: 142, minZ: 0, maxZ: 0 };
  const width = maxX - minX, height = maxY - minY, depth = maxZ - minZ;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, cz: (minZ + maxZ) / 2,
    width: width + 50, height: height + 50, depth, radius: Math.max(50, Math.hypot(width, height, depth) / 2 + 25), minZ, maxZ };
}

export function mapFloors(segments: Segment[]) {
  const counts = new Map<number, number>();
  for (const s of segments) { const z = Math.round((s.z1 + s.z2) / 10) * 5; counts.set(z, (counts.get(z) || 0) + 1); }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([z]) => z).sort((a, b) => b - a);
}

export function floorBand(z: number, floors: number[]) {
  let index = 0, distance = Infinity;
  floors.forEach((level, i) => { if (Math.abs(level - z) < distance) { index = i; distance = Math.abs(level - z); } });
  return index;
}

export function floorPaths(segments: Segment[], floors: number[]) {
  const bands = layerColors.map(() => [] as string[]);
  for (const s of segments) bands[floorBand((s.z1 + s.z2) / 2, floors)].push(`M${s.x1} ${s.y1}L${s.x2} ${s.y2}`);
  return bands.map((lines, band) => ({ d: lines.join(''), color: layerColors[band] })).filter((path) => path.d);
}

export function parseMapCoordinate(value: string): MapCoordinate | null {
  const values = value.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if ((values.length !== 2 && values.length !== 3) || !values.every((number) => Number.isFinite(number) && Math.abs(number) <= 1_000_000)) return null;
  return values.length === 3 ? { x: values[0], y: values[1], z: values[2] } : { x: values[0], y: values[1] };
}

export function projectPoint(x: number, y: number, z: number, bounds: MapBounds, view: WireView) {
  const dx = x - bounds.cx, dy = y - bounds.cy, dz = z - bounds.cz + view.z;
  return { x: dx * Math.cos(view.yaw) - dy * Math.sin(view.yaw),
    y: (dx * Math.sin(view.yaw) + dy * Math.cos(view.yaw)) * Math.cos(view.pitch) - dz * Math.sin(view.pitch) };
}

export function wirePaths(segments: Segment[], bounds: MapBounds, view: WireView, simplified = false, separation = 0, floors = mapFloors(segments)) {
  const bands = layerColors.map(() => [] as string[]);
  const step = simplified ? Math.max(1, Math.ceil(segments.length / 4000)) : 1;
  const span = Math.max(1, bounds.maxZ - bounds.minZ);
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const project = (x: number, y: number, z: number, lift = 0) => {
    const dx = x - bounds.cx, dy = y - bounds.cy;
    return `${(dx * cy - dy * sy).toFixed(1)} ${((dx * sy + dy * cy) * cp - (z + lift - bounds.cz + view.z) * sp).toFixed(1)}`;
  };
  for (let i = 0; i < segments.length; i += step) {
    const s = segments[i], averageZ = (s.z1 + s.z2) / 2;
    const band = separation ? floorBand(averageZ, floors) : Math.min(7, Math.max(0, Math.floor((averageZ - bounds.minZ) / span * 8)));
    const lift = separation ? (floors.length - 1 - band) * separation : 0;
    bands[band].push(`M${project(s.x1, s.y1, s.z1, lift)}L${project(s.x2, s.y2, s.z2, lift)}`);
  }
  return bands.map((lines, band) => ({ d: lines.join(''), color: layerColors[band] })).filter((path) => path.d);
}
