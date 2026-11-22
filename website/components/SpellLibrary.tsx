'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Axe, BicepsFlexed, BookOpen, ChevronRight, Cross, Eye, FileUp, Flame,
  Footprints, HeartPulse, Leaf, Music, Orbit, PawPrint, Search, Shield,
  Skull, Snowflake, Sparkles, Swords, Target, WandSparkles, Wind,
} from 'lucide-react';
import spellData from '@/data/eqlwiki-spells.json';
import { parseCharacterReport } from '@/lib/character-report';
import { spellColumns, spellFields } from '@/lib/spell-report';
import CharacterAbilityWorkspace from './CharacterAbilityWorkspace';

type Spell = (typeof spellData.spells)[number];
type TrioSpell = Spell & { classLevels: Array<{ code: string; level: number }> };
type StatusFilter = 'all' | 'needed' | 'known' | 'future';
type SigilKind = 'song' | 'heal' | 'fire' | 'cold' | 'nature' | 'shadow' | 'pet' | 'travel' | 'control' | 'shield' | 'vision' | 'magic';

const classIcons: Record<string, typeof Music> = {
  BRD: Music, BST: PawPrint, CLR: Cross, DRU: Leaf, ENC: Orbit,
  MAG: WandSparkles, NEC: Skull, PAL: Shield, RNG: Target, SHD: Swords,
  SHM: Sparkles, WIZ: Flame, BER: Axe, MNK: BicepsFlexed, ROG: Eye,
  WAR: Shield,
};

const classIconMeaning: Record<string, string> = {
  BRD:'song and rhythm', BST:'animal warder', CLR:'divine healing',
  DRU:'nature magic', ENC:'enchantment and control', MAG:'summoned magic',
  NEC:'death magic', PAL:'holy defense', RNG:'tracking and archery',
  SHD:'dark martial magic', SHM:'spirit magic', WIZ:'elemental power',
  BER:'battle fury', MNK:'disciplined strength', ROG:'stealth and precision',
  WAR:'martial defense',
};

const classOptions = [
  ...spellData.classes.map((entry) => ({ code: entry.code, name: entry.name, category: 'caster' as const })),
  { code: 'BER', name: 'Berserker', category: 'melee' as const }, { code: 'MNK', name: 'Monk', category: 'melee' as const },
  { code: 'ROG', name: 'Rogue', category: 'melee' as const }, { code: 'WAR', name: 'Warrior', category: 'melee' as const },
].sort((left, right) => left.name.localeCompare(right.name));

const classGroups = [
  { id: 'caster', title: 'Caster Classes', note: 'Classes with spell or song lists' },
  { id: 'melee', title: 'Melee Classes', note: 'Classes without a class spell list' },
] as const;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function spellUrl(name: string) {
  return `https://eqlwiki.com/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
}

function sigilFor(spell: Spell): SigilKind {
  const text = normalize(`${spell.name} ${spell.effect} ${spell.resist} ${spell.target}`);
  if (spell.classCode === 'BRD') return 'song';
  if (/heal|mend|remedy|renew|cure|reviv|resur|reanimation|reconstitution/.test(text)) return 'heal';
  if (/fire|flame|burn|blaze|inferno|lava|combust/.test(text)) return 'fire';
  if (/cold|frost|ice|blizzard|chill/.test(text)) return 'cold';
  if (/poison|disease|venom|plant|animal|wolf|bear|thorn|root/.test(text)) return 'nature';
  if (/shadow|death|dead|necro|lifetap|fear|terror|dark|undead|curse/.test(text)) return 'shadow';
  if (/summon|pet|animation|companion|familiar|warder/.test(text)) return 'pet';
  if (/gate|portal|transloc|teleport|evacu|succor|movement|levitat|spirit of wolf/.test(text)) return 'travel';
  if (/charm|mesmer|stun|lull|calm|slow|snare|blind|silence|pacif/.test(text)) return 'control';
  if (/armor|shield|rune|ward|protect|resist|endure|aegis|barrier/.test(text)) return 'shield';
  if (/sense|vision|sight|identify|true north|invisibility/.test(text)) return 'vision';
  return 'magic';
}

const sigilIcons = {
  song: Music, heal: HeartPulse, fire: Flame, cold: Snowflake, nature: Wind,
  shadow: Skull, pet: PawPrint, travel: Footprints, control: Orbit,
  shield: Shield, vision: Eye, magic: Sparkles,
};

function SpellSigil({ spell }: { spell: Spell }) {
  const kind = sigilFor(spell);
  const Icon = sigilIcons[kind];
  return <span className={`catalogsigil ${kind}`} title={`Original EQLSaK ${kind} spell symbol`} aria-label={`${kind} spell symbol`}><Icon aria-hidden="true" /></span>;
}

function ClassGem({ code }: { code: string }) {
  const Icon = classIcons[code] || BookOpen;
  return <i className={`classgem ${code.toLowerCase()}`} aria-hidden="true">
    <Icon />
    <span>{code}</span>
  </i>;
}

export default function SpellLibrary({ playerBuild, playerLevel }: { playerBuild: string; playerLevel: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLElement>(null);
  const buildCodes = [...new Set(playerBuild.split(/\s*(?:\/|\+|,|\||-)\s*/).map((part) => {
    const key = normalize(part);
    return classOptions.find((entry) => normalize(entry.code) === key || normalize(entry.name) === key)?.code;
  }).filter((code): code is string => Boolean(code)))].slice(0, 3);
  const parsedLevel = Number.parseInt(playerLevel, 10);
  const [classCodes, setClassCodes] = useState<string[]>(buildCodes.length ? buildCodes : ['CLR']);
  const [level, setLevel] = useState(Number.isFinite(parsedLevel) ? Math.min(60, Math.max(1, parsedLevel)) : 60);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [known, setKnown] = useState<Set<string>>(() => new Set());
  const [reportNames, setReportNames] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [reportError, setReportError] = useState('');

  const classSpells = useMemo<TrioSpell[]>(() => {
    const grouped = new Map<string, TrioSpell>();
    for (const spell of spellData.spells) {
      if (!classCodes.includes(spell.classCode)) continue;
      const key = normalize(spell.name);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, { ...spell, classLevels: [{ code: spell.classCode, level: spell.level }] });
        continue;
      }
      const classLevels = [...current.classLevels, { code: spell.classCode, level: spell.level }].sort((left, right) => left.level - right.level || left.code.localeCompare(right.code));
      grouped.set(key, spell.level < current.level ? { ...spell, classLevels } : { ...current, classLevels });
    }
    return [...grouped.values()].sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
  }, [classCodes]);
  const allCatalogNames = useMemo(() => new Set(spellData.spells.map((spell) => normalize(spell.name))), []);
  const nonSpellNames = useMemo(() => reportNames.filter((name) => !allCatalogNames.has(normalize(name))), [reportNames, allCatalogNames]);
  const actionNames = nonSpellNames;
  const rogueReport = classCodes.includes('ROG') || /(?:^|[-_])(rog|rogue)(?:[-_.]|$)/i.test(reportName) || actionNames.length > 0;
  const eligible = classSpells.filter((spell) => spell.level <= level);
  const knownSpells = classSpells.filter((spell) => known.has(normalize(spell.name)));
  const knownEligible = eligible.filter((spell) => known.has(normalize(spell.name))).length;
  const needed = eligible.length - knownEligible;
  const visible = useMemo(() => {
    const needle = normalize(query);
    return classSpells.filter((spell) => {
      const isKnown = known.has(normalize(spell.name));
      const isFuture = spell.level > level;
      if (status === 'known' && !isKnown) return false;
      if (status === 'needed' && (isKnown || isFuture)) return false;
      if (status === 'future' && !isFuture) return false;
      return !needle || normalize(`${spell.name} ${spell.effect} ${spell.target} ${spell.resist}`).includes(needle);
    });
  }, [classSpells, known, level, query, status]);

  async function loadSpellbook(file?: File) {
    if (!file) return;
    setReportError('');
    try {
      if (!file.size) throw new Error('That report is empty. Choose the file produced by /outputfile spellbook.');
      if (file.size > 5_000_000) throw new Error('Choose a spellbook text report smaller than 5 MB.');
      const rows = parseCharacterReport(await file.text());
      const columns = spellColumns(rows.slice(0, 1));
      const classNames = spellData.classes.flatMap((entry) => [entry.code, entry.name]);
      const names = rows.map((row) => spellFields(row, columns, classNames)?.name).filter((name): name is string => Boolean(name));
      if (!names.length) throw new Error('No spell names were recognized. Choose an EQL Spellbook export rather than a userdata settings file.');
      setKnown(new Set(names.map(normalize)));
      setReportNames([...new Set(names)]);
      setReportName(file.name);
      showSpellList('needed');
    } catch (cause) {
      setKnown(new Set()); setReportNames([]); setReportName('');
      setReportError(cause instanceof Error ? cause.message : 'The spellbook report could not be read.');
    }
  }

  const selectedNames = classCodes.map((code) => classOptions.find((entry) => entry.code === code)?.name || code);
  const selectedLabel = selectedNames.join(' / ');
  const progress = eligible.length ? Math.round((knownEligible / eligible.length) * 100) : 0;

  function toggleClass(code: string) {
    setClassCodes((current) => current.includes(code)
      ? (current.length === 1 ? current : current.filter((entry) => entry !== code))
      : (current.length < 3 ? [...current, code] : current));
  }

  function showSpellList(nextStatus: StatusFilter) {
    setStatus(nextStatus);
    setQuery('');
    window.setTimeout(() => {
      results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      results.current?.focus({ preventScroll: true });
    }, 0);
  }

  const reportTitle = status === 'known'
    ? 'Acquired / known spells'
    : status === 'needed'
      ? `Still needed at level ${level}`
      : status === 'future'
        ? `Available above level ${level}`
        : 'All spells for this trio';

  return <section className="spelllibrary" aria-labelledby="spell-library-title">
    <header className="spelllibraryhero">
      <div><small>CLASS SPELL LIBRARY · {spellData.spells.length.toLocaleString()} CLASS RECORDS</small><h2 id="spell-library-title">My Spell Book</h2><p>Choose your full trio, browse its combined EQL spell list, then compare a private local spellbook export against the spells available at your level.</p></div>
      <button type="button" onClick={() => picker.current?.click()}><FileUp aria-hidden="true" /> Compare my spellbook</button>
      <input ref={picker} hidden type="file" accept=".txt,text/plain" onChange={(event) => { void loadSpellbook(event.target.files?.[0]); event.target.value=''; }} />
    </header>

    <div className="spelltriopicker"><div className="spelltriosummary"><b>YOUR TRIO · {classCodes.length}/3</b><span>{selectedLabel}{classCodes.length < 3 ? ' · Choose another class' : ' · Trio ready'}</span></div><div className="spellclassgroups">{classGroups.map((group) => <section key={group.id} aria-labelledby={`spell-class-group-${group.id}`}><header><div><b id={`spell-class-group-${group.id}`}>{group.title}</b><span>{group.note}</span></div><strong>{classOptions.filter((entry) => entry.category === group.id).length}</strong></header><div className="spellclassrail" aria-label={`Choose ${group.title.toLowerCase()} for your trio`}>{classOptions.filter((entry) => entry.category === group.id).map((entry) => { const count = spellData.spells.filter((spell) => spell.classCode === entry.code).length; const selected = classCodes.includes(entry.code); const full = classCodes.length === 3 && !selected; return <button type="button" key={entry.code} className={selected ? 'active' : ''} aria-pressed={selected} disabled={full} title={full ? 'Remove a selected class before adding another' : `${selected ? 'Remove' : 'Add'} ${entry.name} — ${classIconMeaning[entry.code] || 'class symbol'}`} onClick={() => toggleClass(entry.code)}><ClassGem code={entry.code} /><b>{entry.name}</b><small>{count ? `${count} spells` : 'No class spells'}</small></button>; })}</div></section>)}</div></div>

    <section className="spellcompare" aria-labelledby="spell-compare-title">
      <header><div><small>MY SPELL CHECK</small><h3 id="spell-compare-title">{reportName || 'Load your EQL spellbook report'}</h3></div><span>{reportName ? 'Processed locally' : '/outputfile spellbook'}</span></header>
      <div className="spellcomparecontrols"><label>Current level<input type="number" min="1" max="60" value={level} onChange={(event) => setLevel(Math.min(60, Math.max(1, Number(event.target.value) || 1)))} /></label><div className="spellprogress"><span><b>{progress}%</b> of the trio’s level-eligible spells found</span><i><em style={{width:`${progress}%`}} /></i></div></div>
      <div className="spellcomparefacts"><button type="button" disabled={!reportName} aria-controls="spell-check-results" onClick={() => showSpellList('known')} className={status === 'known' ? 'active' : ''} title="Show the complete numbered list of spells found in your report"><b>{reportName ? knownSpells.length : '—'}</b><span>{reportName ? 'Acquired / known' : 'Known after import'}</span><small>View full list</small></button><button type="button" disabled={!reportName} aria-controls="spell-check-results" onClick={() => showSpellList('needed')} className={status === 'needed' ? 'active' : ''} title="Show every level-eligible spell not found in your report"><b>{reportName ? needed : eligible.length}</b><span>{reportName ? 'Still needed' : `Eligible at level ${level}`}</span><small>View full list</small></button><button type="button" aria-controls="spell-check-results" onClick={() => showSpellList('future')} className={status === 'future' ? 'active' : ''} title={`Show spells available above level ${level}`}><b>{classSpells.length-eligible.length}</b><span>Above level</span><small>View full list</small></button><article><b>{reportName ? actionNames.length : '—'}</b><span>{reportName ? actionNames.length ? 'Rogue actions recognized' : 'No separate actions found' : 'Actions after import'}</span></article></div>
      {reportError && <p className="spellreporterror" role="alert">{reportError}</p>}
    </section>

    <section ref={results} id="spell-check-results" className="spellcheckresults" tabIndex={-1} aria-labelledby="spell-check-results-title">
      <header><div><small>NUMBERED SPELL REPORT</small><h3 id="spell-check-results-title">{reportTitle}</h3><p>{reportName ? `Compared with ${reportName}. Select a spell to see its complete report fields.` : 'Import your spellbook report to separate acquired spells from those you still need.'}</p></div><strong>{visible.length.toLocaleString()} spells</strong></header>
      <div className="spellstatusnav" role="group" aria-label="Choose which spells to list"><button type="button" className={status === 'all' ? 'active' : ''} onClick={() => showSpellList('all')}>All</button><button type="button" disabled={!reportName} className={status === 'known' ? 'active' : ''} onClick={() => showSpellList('known')}>Acquired / known</button><button type="button" disabled={!reportName} className={status === 'needed' ? 'active' : ''} onClick={() => showSpellList('needed')}>Still needed</button><button type="button" className={status === 'future' ? 'active' : ''} onClick={() => showSpellList('future')}>Above level</button></div>
      <div className="spellfilters"><label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${selectedLabel} spells…`} /></label><select value={status} onChange={(event) => showSpellList(event.target.value as StatusFilter)} aria-label="Filter spell status"><option value="all">All trio spells</option><option value="needed" disabled={!reportName}>Still needed at my level</option><option value="known" disabled={!reportName}>Known from my report</option><option value="future">Above my level</option></select><span>{visible.length.toLocaleString()} matches</span></div>

      <ol className="spellstatuslist">{visible.map((spell) => {
      const isKnown = known.has(normalize(spell.name));
      const isFuture = spell.level > level;
      const statusLabel = isKnown ? 'Acquired' : isFuture ? 'Above level' : 'Still needed';
      return <li key={normalize(spell.name)} className={isKnown ? 'known' : isFuture ? 'future' : 'needed'}><details><summary><SpellSigil spell={spell} /><span className="spelllistnumber" aria-hidden="true" /><span className="spelllistidentity"><b>{spell.name}</b><small>{spell.classLevels.map((entry) => `${entry.code} · level ${entry.level}`).join('   |   ')}{spell.mana ? ` · ${spell.mana} mana` : ''}</small></span><em>{statusLabel}</em><ChevronRight aria-hidden="true" /></summary><div className="spellcardmain"><small className="spellreportlabel">SPELL DETAILS</small><dl className="spellreportfields"><div className="spelldescription"><dt>Description</dt><dd>{spell.effect || 'The licensed source does not provide a description for this spell.'}</dd></div><div><dt>Target</dt><dd>{spell.target || '—'}</dd></div><div><dt>Resist</dt><dd>{spell.resist || '—'}</dd></div><div><dt>Cast</dt><dd>{spell.cast || '—'}</dd></div><div><dt>Duration</dt><dd>{spell.duration || '—'}</dd></div><div><dt>Source</dt><dd>EQL Wiki · CC BY-SA 4.0</dd></div></dl><a href={spellUrl(spell.name)} target="_blank" rel="noreferrer">Open source record <ChevronRight aria-hidden="true" /></a></div></details></li>;
    })}</ol>
      {!visible.length && <p className="nospells">No spells match these filters.</p>}
    </section>

    <CharacterAbilityWorkspace actionNames={actionNames} rogueReport={rogueReport} />
    <footer><BookOpen aria-hidden="true" /><p><b>Source and license:</b> spell facts are adapted from <a href={spellData.source.url} target="_blank" rel="noreferrer">EverQuest Legends Wiki</a> under <a href={spellData.source.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Community data is useful but not automatically user-verified. The colorful category sigils are original EQLSaK interface artwork—not copied EverQuest spell icons.</p><small>Catalog synchronized {new Date(spellData.generatedAt).toLocaleDateString()}</small></footer>
  </section>;
}
