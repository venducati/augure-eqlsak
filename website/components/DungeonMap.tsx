'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Layers3, Minus, Plus, RotateCcw, Search } from 'lucide-react';
import type { Spawn } from '../data/dungeons';
import { floorBand, floorPaths, layerColors, mapBounds, mapFloors, parseMap, parseMapCoordinate, projectPoint, wirePaths } from '../lib/dungeon-map';
import type { Segment } from '../lib/dungeon-map';

const defaultView = () => ({ yaw: -.62, pitch: .72, z: 0, x: 0, y: 0, zoom: 1 });
type View = ReturnType<typeof defaultView>;
type Drag = { id: number; x: number; y: number; view: View; mode: 'orbit' | 'pan' | 'z'; moved: boolean };

export default function DungeonMap({ id, name, spawns, onSelect }: { id: string; name: string; spawns: Spawn[]; onSelect: (spawn: Spawn) => void }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState('Loading map…');
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<'floor' | 'wireframe'>('floor');
  const [floor, setFloor] = useState('all');
  const [view, setView] = useState(defaultView);
  const [dragging, setDragging] = useState(false);
  const [showPois, setShowPois] = useState(true);
  const [lightMap, setLightMap] = useState(false);
  const [separation, setSeparation] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [coordinateInput, setCoordinateInput] = useState('');
  const [coordinateMessage, setCoordinateMessage] = useState('Enter X, Y or X, Y, Z from an EQL location readout.');
  const [target, setTarget] = useState<{ x: number; y: number; z?: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const current = useRef(view);
  const wheelAction = useRef<(event: WheelEvent) => void>(() => {});
  function update(next: View) {
    current.current = next;
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setView(current.current); });
  }
  function reset() { update(defaultView()); }
  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    setSegments([]); setStatus('Loading map…'); setFloor('all');
    current.current = defaultView(); setView(current.current);
    void fetch(`/maps/${id}.txt`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('This map could not be loaded.');
      const parsed = parseMap(await response.text());
      if (!controller.signal.aborted) { setSegments(parsed); setStatus(''); }
    }).catch((error) => {
      if (timedOut) setStatus('The map took too long to load. Please try again.');
      else if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'The map could not be read.');
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [id, retry]);
  useEffect(() => {
    const element = host.current;
    const wheel = (event: WheelEvent) => wheelAction.current(event);
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => { element?.removeEventListener('wheel', wheel); cancelAnimationFrame(frame.current); frame.current = 0; };
  }, []);
  const bounds = useMemo(() => mapBounds(segments), [segments]);
  const floors = useMemo(() => mapFloors(segments), [segments]);
  const visible = useMemo(() => floor === 'all' ? segments : segments.filter((s) => floorBand((s.z1 + s.z2) / 2, floors) === Number(floor)), [segments, floors, floor]);
  const flatBounds = useMemo(() => mapBounds(visible), [visible]);
  const flatPaths = useMemo(() => floorPaths(visible, floors), [visible, floors]);
  const { yaw, pitch, z } = view;
  const paths = useMemo(() => mode === 'wireframe' ? wirePaths(segments, bounds, { yaw, pitch, z }, dragging, separation, floors) : flatPaths, [mode, segments, bounds, yaw, pitch, z, dragging, separation, floors, flatPaths]);
  const matchingSpawns = useMemo(() => spawns.filter((spawn) => `${spawn.name} ${spawn.loot} ${spawn.quest}`.toLowerCase().includes(locationQuery.trim().toLowerCase())), [spawns, locationQuery]);
  // The wireframe camera stays fixed around the model's original center. Reframing
  // every pointer move would cancel Z translation and make rotations change size.
  const width = (mode === 'wireframe' ? bounds.radius * 2 : flatBounds.width) / view.zoom;
  const height = (mode === 'wireframe' ? bounds.radius * 2 : flatBounds.height) / view.zoom;
  const cx = mode === 'wireframe' ? 0 : flatBounds.cx, cy = mode === 'wireframe' ? 0 : flatBounds.cy;
  function viewportUnits(rect: DOMRect) { return Math.max(width / Math.max(1, rect.width), height / Math.max(1, rect.height)); }
  wheelAction.current = (event) => {
    if (!segments.length) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 500 : 1);
    const next = current.current;
    if (mode === 'wireframe' && event.shiftKey) update({ ...next, z: next.z - delta * bounds.radius / 1500 });
    else update({ ...next, zoom: Math.max(.5, Math.min(8, next.zoom * Math.exp(-delta * .0012))) });
  };
  function start(event: React.PointerEvent<HTMLDivElement>) {
    if (!segments.length || (event.target as Element).closest('.pois,button') || ![0, 1, 2].includes(event.button)) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { ...current.current }, mode: mode === 'floor' ? 'pan' : event.shiftKey ? 'z' : event.button === 0 ? 'orbit' : 'pan', moved: false };
    setDragging(true);
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
    const scale = viewportUnits(event.currentTarget.getBoundingClientRect());
    if (start.mode === 'orbit') update({ ...start.view, yaw: start.view.yaw + dx * .009, pitch: Math.max(-1.5, Math.min(1.5, start.view.pitch + dy * .007)) });
    else if (start.mode === 'z') update({ ...start.view, z: start.view.z - dy * scale });
    else update({ ...start.view, x: start.view.x - dx * scale, y: start.view.y - dy * scale });
  }
  function stop(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start?.id !== event.pointerId) return;
    if (!start.moved && mode === 'floor' && event.button === 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = cx - width / 2 + current.current.x + (event.clientX - rect.left) / rect.width * width;
      const y = cy - height / 2 + current.current.y + (event.clientY - rect.top) / rect.height * height;
      setTarget({ x, y }); setCoordinateMessage(`Map cursor · X ${Math.round(x)} · Y ${Math.round(y)}`);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }
  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const next = current.current, step = Math.max(width, height) * .04;
    if (event.key === 'Home') reset();
    else if (event.key === '+' || event.key === '=') update({ ...next, zoom: Math.min(8, next.zoom * 1.2) });
    else if (event.key === '-') update({ ...next, zoom: Math.max(.5, next.zoom / 1.2) });
    else if (event.key === 'ArrowLeft') update({ ...next, x: next.x - step });
    else if (event.key === 'ArrowRight') update({ ...next, x: next.x + step });
    else if (event.key === 'ArrowUp') update(event.shiftKey && mode === 'wireframe' ? { ...next, z: next.z + step } : { ...next, y: next.y - step });
    else if (event.key === 'ArrowDown') update(event.shiftKey && mode === 'wireframe' ? { ...next, z: next.z - step } : { ...next, y: next.y + step });
    else return;
    event.preventDefault();
  }
  function focusCoordinate() {
    const coordinate = parseMapCoordinate(coordinateInput);
    if (!coordinate) { setCoordinateMessage('Use two or three numbers, such as 120, -48, 17.'); return; }
    setTarget(coordinate);
    if (mode === 'floor') {
      update({ ...current.current, x: coordinate.x - flatBounds.cx, y: coordinate.y - flatBounds.cy, zoom: Math.max(2.2, current.current.zoom) });
      if (coordinate.z !== undefined && floors.length) setFloor(String(floorBand(coordinate.z, floors)));
    } else {
      const point = projectPoint(coordinate.x, coordinate.y, coordinate.z ?? bounds.cz, bounds, current.current);
      update({ ...current.current, x: point.x, y: point.y, zoom: Math.max(2, current.current.zoom) });
    }
    setCoordinateMessage(`Focused · X ${coordinate.x} · Y ${coordinate.y}${coordinate.z === undefined ? '' : ` · Z ${coordinate.z}`}`);
  }
  function focusSpawn(spawn: Spawn) {
    setTarget({ x: spawn.loc[0], y: spawn.loc[1], z: spawn.loc[2] });
    if (mode === 'floor') {
      setFloor(String(floorBand(spawn.loc[2], floors)));
      update({ ...current.current, x: spawn.loc[0] - bounds.cx, y: spawn.loc[1] - bounds.cy, zoom: 2.8 });
    } else {
      const point = projectPoint(spawn.loc[0], spawn.loc[1], spawn.loc[2], bounds, current.current);
      update({ ...current.current, x: point.x, y: point.y, zoom: 2.4 });
    }
    setCoordinateMessage(`${spawn.name} · X ${spawn.loc[0]} · Y ${spawn.loc[1]} · Z ${spawn.loc[2]}`);
    onSelect(spawn);
  }
  const marker = target ? (mode === 'floor' ? { x: target.x, y: target.y } : projectPoint(target.x, target.y, target.z ?? bounds.cz, bounds, view)) : null;
  return <article className={`mapdossier atlas-style ${lightMap ? 'light-map' : ''}`}>
    <header className="dungeonmaphead"><div><small>Interactive map-line atlas</small><h3>{name}</h3></div><div><span>{segments.length.toLocaleString()} lines</span><span>{floors.length} detected levels</span></div></header>
    <div className="dungeonexplorer">
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- The composite map has documented keyboard controls and Tab exits it; there is no native map control. */}
      <div ref={host} className={`dungeonmap dungeonstage ${mode === 'wireframe' ? 'wireframe' : ''} ${dragging ? 'dragging' : ''}`} tabIndex={0} role="application" aria-label={`${name} map. Arrow keys pan, plus and minus zoom, Home resets. Shift and up or down moves the 3D height.`} onKeyDown={keyboard} onContextMenu={(event) => event.preventDefault()} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}>
        <svg viewBox={`${cx - width / 2 + view.x} ${cy - height / 2 + view.y} ${width} ${height}`} aria-label={`${name} ${mode === 'wireframe' ? 'three-dimensional wireframe' : 'floor map'}`}>
          <g>{paths.map((path, index) => <path key={index} d={path.d} style={{ stroke: path.color }} />)}</g>
          {showPois && mode === 'floor' && matchingSpawns.filter((spawn) => floor === 'all' || floorBand(spawn.loc[2], floors) === Number(floor)).map((spawn, index) => <g className="pois" key={spawn.name} role="button" tabIndex={0} aria-label={`Show ${spawn.name} details`} onClick={() => focusSpawn(spawn)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusSpawn(spawn); } }}><circle cx={spawn.loc[0]} cy={spawn.loc[1]} r={Math.max(4, bounds.width / 130)} /><text x={spawn.loc[0]} y={spawn.loc[1]}>{index + 1}</text></g>)}
          {marker && <g className="coordinate-marker" aria-hidden="true"><circle cx={marker.x} cy={marker.y} r={Math.max(7, bounds.width / 100)} /><path d={`M${marker.x - 16} ${marker.y}H${marker.x + 16}M${marker.x} ${marker.y - 16}V${marker.y + 16}`} /></g>}
        </svg>
        {status && <div className="dungeon-map-status" role="status"><p>{status}</p>{!status.startsWith('Loading') && <button onClick={() => setRetry((value) => value + 1)}>Try loading again</button>}</div>}
        <div className="mapstagecontrols"><button onClick={() => update({ ...current.current, zoom: Math.max(.5, current.current.zoom / 1.2) })} aria-label="Zoom out"><Minus/></button><output>{Math.round(view.zoom * 100)}%</output><button onClick={() => update({ ...current.current, zoom: Math.min(8, current.current.zoom * 1.2) })} aria-label="Zoom in"><Plus/></button><button onClick={reset} aria-label="Reset map position and viewpoint" title="Reset view (Home)"><RotateCcw/></button></div>
        <span className="mapgesture">{mode === 'wireframe' ? 'Drag orbit · right-drag pan · Shift-drag Z · wheel zoom' : 'Drag pan · wheel zoom · click for X/Y · Home reset'}</span>
        <span className="maptruth">{mode === 'wireframe' ? '3D reconstruction of the bundled line map; it is not claimed as solid game geometry.' : 'Layered map lines; named markers retain their source’s approximate coordinates.'}</span>
      </div>
      <aside className="dungeoncontrols" aria-label="Map controls">
        <section><h4>View</h4><div className="mapviewtoggle">{(['floor', 'wireframe'] as const).map((value) => <button key={value} aria-pressed={mode === value} className={mode === value ? 'active' : ''} onClick={() => { setMode(value); setFloor('all'); reset(); }}>{value === 'floor' ? 'Floor plan' : '3D wireframe'}</button>)}</div></section>
        <section><h4><Crosshair/> Go to coordinate</h4><div className="coordinate-search"><input value={coordinateInput} onChange={(event) => setCoordinateInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') focusCoordinate(); }} placeholder="X, Y, Z" aria-label="EQL map coordinate"/><button onClick={focusCoordinate} aria-label="Focus coordinate"><Search/></button></div><p className="controlnote">{coordinateMessage}</p></section>
        <section><h4><Layers3/> Levels</h4>{mode === 'floor' ? <div className="floorchips"><button className={floor === 'all' ? 'active' : ''} onClick={() => { setFloor('all'); reset(); }}>All mapped levels</button>{floors.map((level, index) => <button key={level} className={floor === String(index) ? 'active' : ''} onClick={() => { setFloor(String(index)); reset(); }}><i style={{ background: layerColors[index] }}/>L{index + 1} <small>Z≈{level}</small></button>)}</div> : <><label className="controlrange">Floor separation <input type="range" min="0" max={Math.max(40, Math.round(bounds.depth))} value={separation} onChange={(event) => setSeparation(Number(event.target.value))}/><output>{separation}</output></label><div className="zcontrol"><span>Z height</span><button onClick={() => update({ ...current.current, z: current.current.z - bounds.radius * .06 })}>−</button><output>{Math.round(view.z)}</output><button onClick={() => update({ ...current.current, z: current.current.z + bounds.radius * .06 })}>+</button></div></>}</section>
        <section><h4>Layers & display</h4><label className="controlcheck"><input type="checkbox" checked={showPois} onChange={(event) => setShowPois(event.target.checked)}/> Named locations</label><label className="controlcheck"><input type="checkbox" checked={lightMap} onChange={(event) => setLightMap(event.target.checked)}/> Light parchment map</label></section>
        <section className="locationindex"><h4>Named locations & drops</h4><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Search name or drop" aria-label="Search named locations and drops"/><div>{matchingSpawns.length ? matchingSpawns.map((spawn) => <button key={spawn.name} onClick={() => focusSpawn(spawn)}><strong>{spawn.name}</strong><small>{spawn.loot || 'No verified drop listed'}</small><span>X {spawn.loc[0]} · Y {spawn.loc[1]} · Z {spawn.loc[2]}</span></button>) : <p className="controlnote">No named location matches that search.</p>}</div></section>
      </aside>
    </div>
  </article>;
}
