import { buildAtlasVoyage, type AtlasRouteLeg, type AtlasRouteNode } from '../lib/atlas-voyage';

export default function AtlasVoyageLayer({
  nodes,
  route,
  legs,
}: {
  nodes: readonly AtlasRouteNode[];
  route: string[];
  legs: AtlasRouteLeg[];
}) {
  const voyage = buildAtlasVoyage(nodes, route, legs);
  if (!voyage.points.length && !voyage.paths.length) return null;

  return <svg className="atlasvoyage" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <filter id="voyage-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="voyage-course" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#78c9ff" stopOpacity=".2"/>
        <stop offset=".5" stopColor="#ffe18b" stopOpacity=".95"/>
        <stop offset="1" stopColor="#78c9ff" stopOpacity=".2"/>
      </linearGradient>
    </defs>
    {voyage.paths.map((path) => <g key={path.id}>
      <path className={`voyage-course ${path.boat ? 'boat' : 'land'}${path.partial ? ' partial' : ''}`} d={path.d}/>
      {path.boat && <g className="voyage-ship" filter="url(#voyage-glow)">
        <path className="voyage-hull" d="M -2.8 1.1 L 2.8 1.1 L 1.7 2.4 L -1.8 2.4 Z"/>
        <path className="voyage-mast" d="M 0 -2.8 L .25 1.2 L -.25 1.2 Z"/>
        <path className="voyage-sail" d="M .2 -2.5 L 2.4 .45 L .25 .45 Z"/>
        <animateMotion dur={path.partial ? '8s' : '11s'} repeatCount="indefinite" rotate="auto" path={path.d}/>
      </g>}
    </g>)}
    {voyage.points.map((point) => <g className={`voyage-point ${point.role}`} key={point.name} transform={`translate(${point.x} ${point.y})`}>
      <circle className="voyage-pulse" r={point.role === 'stop' ? 2.2 : 3.2}/>
      <circle className="voyage-core" r={point.role === 'stop' ? .7 : 1}/>
    </g>)}
  </svg>;
}
