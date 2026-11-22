export type AtlasRouteNode = readonly [
  name: string,
  x: number,
  y: number,
  level: string,
  type: string,
];

export type AtlasRouteLeg = {
  from: string;
  to: string;
  mode: string;
};

export type AtlasVoyagePoint = {
  name: string;
  x: number;
  y: number;
  role: 'departure' | 'destination' | 'stop';
};

export type AtlasVoyagePath = {
  id: string;
  d: string;
  boat: boolean;
  partial: boolean;
};

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const middleX = (a.x + b.x) / 2;
  const middleY = (a.y + b.y) / 2 - Math.min(11, 5 + Math.abs(a.x - b.x) * 0.08);
  return `M ${a.x} ${a.y} Q ${middleX} ${middleY} ${b.x} ${b.y}`;
};

const edgeAnchor = (point: { x: number; y: number }) => ({
  x: point.x < 50 ? -7 : 107,
  y: Math.max(8, Math.min(92, point.y + (point.y < 50 ? -7 : 7))),
});

export function buildAtlasVoyage(
  nodes: readonly AtlasRouteNode[],
  route: string[],
  legs: AtlasRouteLeg[],
) {
  const nodeByName = new Map(nodes.map((node) => [node[0], node]));
  const points: AtlasVoyagePoint[] = route.flatMap((name, index) => {
    const node = nodeByName.get(name);
    if (!node) return [];
    return [{
      name,
      x: node[1],
      y: node[2],
      role: index === 0 ? 'departure' as const : index === route.length - 1 ? 'destination' as const : 'stop' as const,
    }];
  });

  const paths: AtlasVoyagePath[] = [];
  for (const leg of legs) {
    const from = nodeByName.get(leg.from);
    const to = nodeByName.get(leg.to);
    const boat = leg.mode === 'Boat';
    if (from && to) {
      paths.push({ id: `${leg.from}-${leg.to}`, d: curve({ x: from[1], y: from[2] }, { x: to[1], y: to[2] }), boat, partial: false });
    } else if (boat && (from || to)) {
      const visible = from || to!;
      const point = { x: visible[1], y: visible[2] };
      const edge = edgeAnchor(point);
      paths.push({
        id: `${leg.from}-${leg.to}`,
        d: from ? curve(point, edge) : curve(edge, point),
        boat: true,
        partial: true,
      });
    }
  }

  return {
    points,
    paths,
    hasBoat: paths.some((path) => path.boat),
  };
}
