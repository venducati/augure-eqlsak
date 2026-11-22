'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {parseBuild} from '../lib/build-advisor';

import { statNames as stats, emptyStats, gearDelta, statValue } from '../lib/gear-plan';
import type { Stat, StatBlock } from '../lib/gear-plan';

type GearPiece = { id: number; slot: string; name: string; bonuses: StatBlock; replaced: StatBlock };

const classes = [
  ['🛡️','Warrior','WAR'],['✨','Cleric','CLR'],['⚜️','Paladin','PAL'],['🏹','Ranger','RNG'],
  ['🌑','Shadow Knight','SHD'],['🌿','Druid','DRU'],['🥋','Monk','MNK'],['🎵','Bard','BRD'],
  ['🗡️','Rogue','ROG'],['🌩️','Shaman','SHM'],['💀','Necromancer','NEC'],['🔥','Wizard','WIZ'],
  ['🪄','Magician','MAG'],['🔮','Enchanter','ENC'],
  ['🐾','Beastlord','BST'],['🪓','Berserker','BER'],
] as const;
const slots = ['Primary','Secondary','Head','Chest','Arms','Hands','Legs','Feet','Neck','Face','Ear','Finger','Waist','Back','Shoulders','Wrist','Range'];

function classesFromBuild(build: string) {
  return parseBuild(build).map(id=>classes.find(item=>item[2]===id)?.[1]).filter((name):name is typeof classes[number][1]=>Boolean(name));
}

export default function ClassConfigurator({ playerName, playerBuild, playerLevel }: { playerName: string; playerBuild: string; playerLevel: string }) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() => classesFromBuild(playerBuild));
  const [level, setLevel] = useState(() => Math.max(1, Math.min(60, Number.parseInt(playerLevel, 10) || 1)));
  const [base, setBase] = useState<StatBlock>(emptyStats);
  const [gear, setGear] = useState<GearPiece[]>([]);
  const nextId = useRef(0);

  const gearTotals = useMemo(() => gearDelta(gear), [gear]);
  const totals = useMemo(() => stats.reduce((all, stat) => {
    all[stat] = base[stat] + gearTotals[stat];
    return all;
  }, emptyStats()), [base, gearTotals]);

  function toggleClass(name: string) {
    setSelectedClasses((current) => current.includes(name) ? current.filter((item) => item !== name) : current.length < 3 ? [...current, name] : current);
  }
  function addGear() {
    const id = ++nextId.current;
    setGear((current) => current.length >= 24 ? current : [...current, { id, slot: 'Primary', name: '', bonuses: emptyStats(), replaced: emptyStats() }]);
  }
  function updateGear(id: number, patch: Partial<GearPiece>) {
    setGear((current) => current.map((piece) => piece.id === id ? { ...piece, ...patch } : piece));
  }
  function updateBonus(id: number, stat: Stat, value: number, field: 'bonuses' | 'replaced' = 'bonuses') {
    setGear((current) => current.map((piece) => piece.id === id ? { ...piece, [field]: { ...piece[field], [stat]: value } } : piece));
  }

  return <section className="classconfig" aria-labelledby="classconfig-title">
    <header className="classconfighead">
      <div><small>CHARACTER LAB · WHAT-IF PLANNER</small><h2 id="classconfig-title">Class &amp; Gear Configurator</h2><p>Model {playerName}&apos;s current build, then see exactly what each proposed item adds or removes.</p></div>
      <label><span>Level</span><input type="number" min="1" max="60" value={level} onChange={(event) => setLevel(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></label>
    </header>

    <div className="classpicker" aria-label="Select up to three classes">
      <div className="classpickertitle"><b>Choose the trio</b><span>{selectedClasses.length}/3 selected</span></div>
      {classes.map(([icon, name, abbreviation]) => <button key={name} type="button" className={selectedClasses.includes(name) ? 'active' : ''} aria-pressed={selectedClasses.includes(name)} title={`${name} (${abbreviation}) — add or remove this class`} onClick={() => toggleClass(name)}><i aria-hidden="true">{icon}</i><span>{name}<small>{abbreviation}</small></span></button>)}
      {selectedClasses.length === 3 && <p className="classlimit">Three classes selected. Remove one before choosing another.</p>}
    </div>

    <div className="buildsnapshot">
      <article><small>ACTIVE CHARACTER</small><h3>{playerName} · Level {level}</h3><p>{selectedClasses.length ? selectedClasses.join(' / ') : 'Choose one to three class icons above.'}</p></article>
      <article><small>PROPOSED GEAR CHANGE</small><h3>{gear.length} {gear.length === 1 ? 'piece' : 'pieces'}</h3><p>{stats.filter((stat) => gearTotals[stat] !== 0).map((stat) => `${gearTotals[stat] > 0 ? '+' : ''}${gearTotals[stat]} ${stat}`).join(' · ') || 'Add gear below to begin a comparison.'}</p></article>
    </div>

    <div className="statplanner">
      <div className="statplannerhead"><b>Current stats and projected totals</b><span>Use the spinners to enter the numbers shown in game.</span></div>
      {stats.map((stat) => <label key={stat}><b>{stat}</b><input aria-label={`Current ${stat}`} type="number" value={base[stat]} onChange={(event) => setBase((current) => ({ ...current, [stat]: statValue(event.target.value) }))} /><span className={gearTotals[stat] > 0 ? 'gain' : gearTotals[stat] < 0 ? 'loss' : ''}>{gearTotals[stat] > 0 ? '+' : ''}{gearTotals[stat]}</span><strong>{totals[stat]}</strong></label>)}
      <div className="statlegend"><span>Current</span><span>Gear delta</span><span>Projected</span></div>
    </div>

    <div className="gearplanner">
      <header><div><small>GEAR WORKBENCH</small><h3>Compare equipment piece by piece</h3></div><button type="button" onClick={addGear} disabled={gear.length >= 24} title={gear.length >= 24 ? "Maximum of 24 planned items" : "Compare a new item against the one it replaces"}><Plus aria-hidden="true" /> Add gear piece</button></header>
      {!gear.length && <button className="gearstarter" type="button" onClick={addGear}><Plus aria-hidden="true" /><b>Add the first proposed item</b><span>Choose its slot, name it, and enter the new bonuses and the bonuses of any item it replaces.</span></button>}
      {gear.map((piece) => <article className="gearpiece" key={piece.id}>
        <div className="gearidentity"><select aria-label="Equipment slot" value={piece.slot} onChange={(event) => updateGear(piece.id, { slot: event.target.value })}>{slots.map((slot) => <option key={slot}>{slot}</option>)}</select><input aria-label="Item name" value={piece.name} placeholder="Item name" onChange={(event) => updateGear(piece.id, { name: event.target.value })} /><button type="button" title="Remove this gear piece" aria-label={`Remove ${piece.name || piece.slot}`} onClick={() => setGear((current) => current.filter((item) => item.id !== piece.id))}><Trash2 aria-hidden="true" /></button></div>
        <div className="gearstats">{stats.map((stat) => <div key={stat}><label><span>{stat} · new</span><input type="number" aria-label={`${piece.name || piece.slot} ${stat} bonus`} value={piece.bonuses[stat]} onChange={(event) => updateBonus(piece.id, stat, statValue(event.target.value))} /></label><label><small>Replaces</small><input type="number" aria-label={`${piece.name || piece.slot} replaced ${stat} bonus`} value={piece.replaced[stat]} onChange={(event) => updateBonus(piece.id, stat, statValue(event.target.value), 'replaced')} /></label></div>)}</div>
        <p><b>{piece.name || `Unnamed ${piece.slot}`}</b>{stats.some((stat) => piece.bonuses[stat] - piece.replaced[stat] !== 0) ? stats.filter((stat) => piece.bonuses[stat] - piece.replaced[stat] !== 0).map((stat) => <span className={piece.bonuses[stat] - piece.replaced[stat] > 0 ? 'gain' : 'loss'} key={stat}>{piece.bonuses[stat] - piece.replaced[stat] > 0 ? '+' : ''}{piece.bonuses[stat] - piece.replaced[stat]} {stat}</span>) : <em>No net stat change entered yet.</em>}</p>
      </article>)}
    </div>

    <footer className="configprovenance"><b>Planning arithmetic · local only.</b> Projected totals equal your current stats plus the new item bonuses, minus the bonuses of the item being replaced. Leave replacement values at zero only for an empty slot. EQLSaK does not invent class caps, hidden scaling, mitigation, or derived-stat formulas; verify the projected result in EQL.</footer>
  </section>;
}
