'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Compass, Eye, MapPin, PackageOpen, Route, Search, ShieldCheck, Swords } from 'lucide-react';
import type { Spawn } from '../data/dungeons';
import { dungeonCatalog, findDungeon, searchDungeons } from '../lib/dungeon-catalog';
import { dungeonMobDrops } from '../lib/dungeon-loot';
import type { LootIndexItem } from '../lib/loot-index';
import DungeonMap from './DungeonMap';

const dungeonNotes: Record<string, { adjacent: string; character: string; danger: string; travel: string }> = {
  blackburrow: { adjacent: 'Qeynos Hills · Everfrost Peaks', character: 'Gnoll stronghold with upper ledges, a central pit, and descending tunnels.', danger: 'Fleeing gnolls can assemble dangerous trains. Confirm the drop before descending.', travel: 'Enter from northeastern Qeynos Hills or through the Everfrost canyon passage.' },
  mistmoore: { adjacent: 'Lesser Faydark', character: 'Castle grounds, graveyard, ramp, courtyard and interior castle camps.', danger: 'Aggressive social creatures and narrow pulls make trains especially dangerous.', travel: 'Reach the castle entrance from Lesser Faydark; confirm local faction and escape route.' },
  paw: { adjacent: 'South Karana', character: 'Splitpaw gnoll tunnels with multiple wings and deeper named camps.', danger: 'Long corridors and social gnolls make retreat paths important.', travel: 'The entrance is in South Karana; establish the exit route before moving deep.' },
  befallen: { adjacent: 'West Commonlands', character: 'A compact, multi-level undead ruin with locked progression.', danger: 'Drops between floors, locked doors, and narrow passages can cut off retreat.', travel: 'Enter from West Commonlands and verify required keys before descending.' },
  najena: { adjacent: 'Lavastorm Mountains', character: 'A key-driven dungeon of cells, undead rooms, guards and magician encounters.', danger: 'Pit traps and locked progression can strand an unprepared group.', travel: 'The entrance lies in southeastern Lavastorm Mountains.' },
  gukbottom: { adjacent: 'Upper Guk', character: 'A sprawling lower complex of froglok camps, undead wings and water routes.', danger: 'Complex junctions and aggressive camps make route discipline essential.', travel: 'Descend from Upper Guk; confirm the intended wing and evacuation plan first.' },
};


const continents = ['All Norrath', ...new Set(dungeonCatalog.map((entry) => entry.continent))];
const sourceClass = (source: string) => /User-Verified/i.test(source) ? 'verified' : /EQL/i.test(source) ? 'eql' : 'legacy';

export default function DungeonGuide({ initialDungeon, lootIndex, renderAdvisor, onShowAtlas, onOpenLoot, onDungeonChange }: { initialDungeon?: string; lootIndex: LootIndexItem[]; renderAdvisor?: (zone: string) => React.ReactNode; onShowAtlas?: (zone: string) => void; onOpenLoot?: (item: string) => void; onDungeonChange?: (zone: string) => void }) {
  const [selectedName, setSelectedName] = useState<string>(() => findDungeon(initialDungeon)?.name || 'Blackburrow');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [continent, setContinent] = useState('All Norrath');
  const [active, setActive] = useState<Spawn | null>(null);
  const selection = useRef(selectedName);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mobFilter, setMobFilter] = useState<'all' | 'elite' | 'lesser'>('all');
  const [showAllMobs, setShowAllMobs] = useState(false);
  const selected = findDungeon(selectedName)!;
  const dungeon = selected.detail;
  const notes = dungeon && dungeonNotes[dungeon.id];
  const filteredCatalog = useMemo(() => searchDungeons(catalogSearch, continent), [catalogSearch, continent]);
  useEffect(() => {
    const next = findDungeon(initialDungeon);
    if (next && next.name !== selection.current) { selection.current = next.name; setSelectedName(next.name); setActive(null); setCatalogSearch(''); setContinent('All Norrath'); }
  }, [initialDungeon]);
  const shownSpawns = dungeon?.spawns.filter((spawn) => !verifiedOnly || /User-Verified|EQL Source survey/i.test(spawn.source)) || [];
  const mobDrops = useMemo(() => dungeonMobDrops({ name: selected.name, id: selected.id, aliases: selected.aliases, spawns: dungeon?.spawns, lootIndex }), [selected.name, selected.id, selected.aliases, dungeon?.spawns, lootIndex]);
  const filteredMobs = mobDrops.filter((mob) => mobFilter === 'all' || (mobFilter === 'elite' ? mob.tier !== 'lesser' : mob.tier === 'lesser'));
  const visibleMobs = showAllMobs ? filteredMobs : filteredMobs.slice(0, 12);
  function selectDungeon(name: string) { selection.current = name; setSelectedName(name); setActive(null); setMobFilter('all'); setShowAllMobs(false); onDungeonChange?.(name); }

  return <section className="dossier">
    <header className="dossierhead">
      <div><small>EVIDENCE-FIRST DUNGEON REFERENCE</small><h2>Dungeon Dossiers</h2><p>Find a dungeon, inspect its mapped floors, or locate its entrance on the Atlas.</p></div>
      <div className="dungeon-catalog-tools">
        <label><Search size={17} aria-hidden="true"/><span className="sr-only">Search dungeon dossiers</span><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search by dungeon name or alias…"/></label>
        <div className="continent-filters" aria-label="Filter dungeons by continent">{continents.map((name) => <button key={name} className={continent === name ? 'active' : ''} aria-pressed={continent === name} onClick={() => setContinent(name)}>{name}<span>{name === 'All Norrath' ? dungeonCatalog.length : dungeonCatalog.filter((entry) => entry.continent === name).length}</span></button>)}</div>
      </div>
      <div className="dungeon-catalog" aria-label="Dungeon dossier catalog">{filteredCatalog.map((entry) => <button key={entry.id} className={`${selectedName === entry.name ? 'active' : ''} ${entry.detail ? 'complete' : 'reference'}`} aria-pressed={selectedName === entry.name} onClick={() => selectDungeon(entry.name)}><i aria-hidden="true">{entry.continent[0]}</i><span><strong>{entry.name}</strong><small>{entry.continent} · Levels {entry.range}</small></span><em>{entry.detail ? 'Mapped dossier' : 'Atlas reference'}</em></button>)}{!filteredCatalog.length && <p className="catalog-empty">No dungeon names match that search. <button onClick={() => { setCatalogSearch(''); setContinent('All Norrath'); }}>Show all dungeons</button></p>}</div>
      <div className="catalog-key"><span><i className="full"/> Mapped dossiers include floor lines and named records</span><span><i/> Atlas references include a location; detailed maps are pending</span></div>
      {onShowAtlas && <div className="dungeon-atlas-action"><button onClick={() => onShowAtlas(selected.name)}><MapPin size={16} aria-hidden="true"/> Show {selected.name} on the continent map</button></div>}
    </header>
    {renderAdvisor?.(selected.name)}
    <section className="mobloot" aria-labelledby="mob-loot-title">
      <header>
        <div><small>CREATURES &amp; POSSIBLE DROPS</small><h2 id="mob-loot-title">What you may meet in {selected.name}</h2><p>Measured counts are EQL sightings, not drop odds. Reference-only entries are labeled so a possible drop is never presented as proven.</p></div>
        <span>{mobDrops.length} mob {mobDrops.length === 1 ? 'record' : 'records'}</span>
      </header>
      <div className="moblootfilters" aria-label="Filter dungeon mobs">
        <button className={mobFilter === 'all' ? 'active' : ''} aria-pressed={mobFilter === 'all'} onClick={() => { setMobFilter('all'); setShowAllMobs(false); }}>All mobs <span>{mobDrops.length}</span></button>
        <button className={mobFilter === 'elite' ? 'active' : ''} aria-pressed={mobFilter === 'elite'} onClick={() => { setMobFilter('elite'); setShowAllMobs(false); }}>Named / elite <span>{mobDrops.filter((mob) => mob.tier !== 'lesser').length}</span></button>
        <button className={mobFilter === 'lesser' ? 'active' : ''} aria-pressed={mobFilter === 'lesser'} onClick={() => { setMobFilter('lesser'); setShowAllMobs(false); }}>Lesser / observed <span>{mobDrops.filter((mob) => mob.tier === 'lesser').length}</span></button>
      </div>
      {visibleMobs.length ? <div className="moblootgrid">{visibleMobs.map((mob) => <article key={mob.name}>
        <div className="mobloottitle"><i aria-hidden="true">{mob.tier === 'lesser' ? <Swords/> : <ShieldCheck/>}</i><div><small>{mob.tier === 'named' ? 'NAMED REFERENCE' : mob.tier === 'elite' ? 'OBSERVED ELITE' : 'OBSERVED MOB'}</small><h3>{mob.name}</h3></div></div>
        <div className="mobdrops">{mob.drops.length ? mob.drops.map((drop) => <button key={drop.name} onClick={() => onOpenLoot?.(drop.name)} title={`Open ${drop.name} in the loot index`}><PackageOpen/><span>{drop.name}</span>{drop.observations !== undefined && <b>{drop.observations} seen</b>}</button>) : <p>No reliable drop name is bundled for this NPC yet.</p>}</div>
        {mob.note && <p className="moblootnote">{mob.note}</p>}
        <footer className={mob.provenance === 'Measured EQL sightings' ? 'measured' : mob.provenance === 'EQL-specific reference' ? 'eql' : 'legacy'}>{mob.provenance}</footer>
      </article>)}</div> : <div className="moblootempty"><PackageOpen/><div><b>No matching mob records yet</b><p>No measured EQL drop sightings or sourced named-NPC drops are bundled for this instance. The dossier stays visible so evidence can be added without inventing it.</p></div></div>}
      {filteredMobs.length > 12 && <button className="moblootmore" onClick={() => setShowAllMobs((shown) => !shown)}>{showAllMobs ? 'Show the first 12 mobs' : `Show all ${filteredMobs.length} mobs`}</button>}
    </section>
    {!dungeon && <article className="reference-dossier"><div className="reference-sigil" aria-hidden="true">{selected.continent[0]}</div><div><small>ATLAS REFERENCE</small><h2>{selected.name}</h2><p>Locate the entrance and plan a route on the Atlas. Detailed floor maps and named-NPC records are not yet available for this location.</p><div className="reference-facts"><span><b>Continent</b>{selected.continent}</span><span><b>Suggested range</b>{selected.range} · legacy reference</span><span><b>Coverage</b>Atlas + routing</span></div>{onShowAtlas && <button onClick={() => onShowAtlas(selected.name)}><Compass size={17}/> Locate and route on Atlas</button>}</div></article>}
    {dungeon && notes && <>
      <div className="dossiergrid">
        <DungeonMap key={dungeon.id} id={dungeon.id} name={dungeon.name} spawns={shownSpawns} onSelect={setActive}/>
        <aside className="dossierintel">
          <small>DUNGEON BRIEF</small><h2>{dungeon.name}</h2><div className="rangeflag">Suggested monster range {dungeon.range}</div>
          <dl><div><dt><Route/> Adjacent</dt><dd>{notes.adjacent}</dd></div><div><dt>Layout</dt><dd>{notes.character}</dd></div><div><dt><AlertTriangle/> Dangers</dt><dd>{notes.danger}</dd></div><div><dt><MapPin/> Getting there</dt><dd>{notes.travel}</dd></div></dl>
          <label className="verifiedtoggle"><input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)}/><ShieldCheck/> Show stronger EQL evidence only</label>
        </aside>
      </div>
      <section className="namedindex"><header><div><small>POINTS OF INTEREST</small><h2>Named NPC intelligence</h2></div><span>{shownSpawns.length} records</span></header><div>{shownSpawns.map((spawn, index) => <button key={spawn.name} className={active?.name === spawn.name ? 'active' : ''} onClick={() => setActive(spawn)}><b>{index + 1}</b><span><strong>{spawn.name}</strong><small>Level {spawn.level} · X {spawn.loc[0]} · Y {spawn.loc[1]} · Z {spawn.loc[2]}</small></span><em className={`badge ${sourceClass(spawn.source)}`}>{spawn.source}</em><ChevronRight/></button>)}{!shownSpawns.length && <p>No records meet this evidence filter. Turn it off to view the other sourced entries.</p>}</div></section>
      {active && <article className="dossierdetail"><button onClick={() => setActive(null)} aria-label="Close NPC details">×</button><small>NAMED NPC · LEVEL {active.level}</small><h2>{active.name}</h2><dl><div><dt>Approximate /loc</dt><dd>X {active.loc[0]} · Y {active.loc[1]} · Z {active.loc[2]}</dd></div><div><dt>Reported drops</dt><dd>{active.loot}</dd></div><div><dt>Quest intelligence</dt><dd>{active.quest}</dd></div></dl><p><Eye/> {active.source}</p></article>}
    </>}
  </section>;
}
