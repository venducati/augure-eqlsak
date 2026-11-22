'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Clipboard, FileUp, Search, ShieldCheck, Trash2 } from 'lucide-react';
import InstallScanner from './InstallScanner';
import ClassConfigurator from './ClassConfigurator';
import SpellbookView from './SpellbookView';
import CharacterSyncReadiness from './CharacterSyncReadiness';
import eqlCommands from '@/data/eqlwiki-commands.json';

import { parseCharacterReport, isFactionReport } from '../lib/character-report';
import { parseFactionExport } from '../lib/zone-factions';

const installRoot = String.raw`C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest Legends`;
const modules = [
  { id:'character', name:'Read a character report', description:'Open a supported report and turn its rows into a clear table.', command:null, source:'Built-in tool', file:'Choose a report listed below. An empty userdata GN_… file is not a character report.', steps:['Create a report in EQL with one of the commands below.','Return here and choose or drop that .txt file.','Read the summary and table. Open the original text only if you need it.'] },
  { id:'logs', name:'Read game logs', description:'See damage, loot, faction changes, chat, zones, deaths, and other recorded events.', command:'/log on', source:'Seen in EQL', file:String.raw`Logs\eqlog_<Character>_<Server>.txt`, steps:['Enter /log on in EQL.','Play until EQL confirms that logging is on.','Open the Log Reader and choose the file named for your real character and server.'] },
  { id:'inventory', name:'Check inventory and gear', description:'See carried, equipped, banked, keyring, and loaded Hoard items in one report.', command:'/outputfile inventory', source:'EQL community source', file:'<Character>_<Server>-Inventory.txt', steps:['Open your bank and Dragon’s Hoard first if you want those loaded items included.','Enter /outputfile inventory in EQL.','Choose the new Inventory text file here.'] },
  { id:'spells', name:'Check spells', description:'See spells you know and a separate list of spells you still need.', command:'/outputfile spellbook', secondaryCommand:'/outputfile missingspells', source:'Seen in EQL', file:'<Character>_<Server>-Spellbook.txt or -MissingSpells.txt', steps:['Enter /outputfile spellbook for spells you know.','Enter /outputfile missingspells for usable spells you do not know yet.','Load either report here. Make new reports after leveling or changing classes.'] },
  { id:'faction', name:'Check faction', description:'Turn EQL faction numbers into a chart that shows how far each one is from its maximum.', command:'/outputfile faction', source:'Seen in EQL', file:'<Character>_<Server>-Factions.txt', steps:['Enter /outputfile faction in EQL.','Choose the new Factions text file here.','Use the chart to compare current points with the maximum shown by EQL.'] },
  { id:'achievements', name:'Check achievements', description:'Read achievement progress if your EQL client can create this report.', command:'/outputfile achievements', source:'EQL source · test in game', file:'<Character>_<Server>-Achievements.txt', steps:['Enter /outputfile achievements in EQL.','If EQL creates a file, choose it here.','If no file appears, use the in-game Achievements window. This export is not yet confirmed for your install.'] },
  { id:'commands', name:'Build a game button', description:'Search the command list and build a five-line social button.', command:null, source:'Several source types', file:'No report needed.', steps:['Search or choose a command below.','Replace words shown in angle brackets or braces, then place the command on one of five lines.','Copy the result and paste each line into an EQL social button.'] },
] as const;

const commandStarters = [
  { label: 'Inventory export', source: 'EQL-specific source', lines: ['/outputfile inventory'] },
  { label: 'Faction export', source: 'User-Verified EQL', lines: ['/outputfile faction'] },
  { label: 'Start session log', source: 'User-Verified EQL', lines: ['/log on'] },
  { label: 'Assist then cast', source: 'Legacy EQ unverified', lines: ['/pause 5, /assist main', '/cast 1'] },
  { label: 'Follow a player', source: 'Legacy EQ unverified', lines: ['/target <player name>', '/pause 3', '/stand', '/pause 3', '/follow'] },
] as const;

function commandSource(syntax: string) {
  const normalized = syntax.trim().toLowerCase();
  if (normalized === '/faction' || normalized === '/log' || normalized === '/log on' || normalized === '/outputfile faction') return 'User-Verified EQL';
  if (['/outputfile inventory','/outputfile spellbook','/outputfile missingspells'].includes(normalized)) return 'EQL-specific source';
  return 'Verify in game';
}

function hasPlaceholders(value: string) {
  return ['<', '{', '[', '|'].some((marker) => value.includes(marker));
}

export default function CharacterLab({ playerName, playerBuild, playerLevel, onOpenLogs, onOpenMaps, initialGuideId = 'character' }: { playerName: string; playerBuild: string; playerLevel: string; onOpenLogs: () => void; onOpenMaps: () => void; initialGuideId?: (typeof modules)[number]['id'] }) {
  const picker = useRef<HTMLInputElement>(null);
  const [sourceName, setSourceName] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandDraft, setCommandDraft] = useState('/outputfile inventory');
  const [macroLines, setMacroLines] = useState(['/outputfile inventory', '', '', '', '']);
  const [activeMacroLine, setActiveMacroLine] = useState(0);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState<(typeof modules)[number]>(modules[0]);
  const [guideCopied, setGuideCopied] = useState('');
  const [factionSort, setFactionSort] = useState<'gap' | 'closest' | 'name'>('gap');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    const requested = modules.find((item) => item.id === initialGuideId);
    if (requested) setGuide(requested);
  }, [initialGuideId]);
  const report = useMemo(() => {
    try { return { rows: parseCharacterReport(text), error: '' }; }
    catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : 'The report could not be read.' }; }
  }, [text]);
  const rows = report.rows;
  useEffect(() => setPage(0), [text, query]);
  const factions = useMemo(() => {
    if (!rows.length || !isFactionReport(sourceName, rows)) return { rows: [], error: '' };
    try {
      const parsed = parseFactionExport(text);
      return { rows: Object.entries(parsed.standings).map(([id, standing]) => ({
        id, name: standing.name, value: standing.points, maximum: standing.maximum!,
        gap: standing.maximum! - standing.points,
      })), error: parsed.skipped ? `${parsed.skipped} lines were not valid faction rows and were excluded from the chart.` : '' };
    } catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : 'Faction columns could not be identified.' }; }
  }, [text, sourceName, rows]);
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? rows.filter((row) => row.raw.toLowerCase().includes(needle)) : rows;
  }, [query, rows]);
  const readableReport = useMemo(() => {
    const first = rows[0];
    const firstLooksLikeHeader = Boolean(first && first.fields.length > 1 && first.fields.every((field) => /[A-Za-z]/.test(field)) && new Set(first.fields.map((field) => field.toLowerCase())).size === first.fields.length);
    const headers = firstLooksLikeHeader ? first.fields : Array.from({ length: Math.max(1, ...rows.map((row) => row.fields.length)) }, (_, index) => `Field ${index + 1}`);
    const dataRows = firstLooksLikeHeader ? rows.slice(1) : rows;
    const name = sourceName.toLowerCase();
    const kind = /faction/.test(name) ? 'Faction report' : /inventory/.test(name) ? 'Inventory report' : /spell|missing/.test(name) ? 'Spell report' : /achievement/.test(name) ? 'Achievement report' : 'Character report';
    const unique = new Set(dataRows.map((row) => row.fields[0]).filter(Boolean)).size;
    return { headers, dataRows, kind, unique, firstLooksLikeHeader };
  }, [rows, sourceName]);
  const readableVisibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? readableReport.dataRows.filter((row) => row.raw.toLowerCase().includes(needle)) : readableReport.dataRows;
  }, [readableReport, query]);
  const commandMatches = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase();
    return eqlCommands.filter((entry) => !needle || `${entry.syntax} ${entry.description}`.toLowerCase().includes(needle)).slice(0, 40);
  }, [commandQuery]);
  const macro = macroLines.filter((line) => line.trim()).join('\n');
  const currentCommandSource = commandSource(commandDraft);
  const factionRows = factions.rows;
  const factionGlance = useMemo(() => {
    const values = factionRows;
    const sorted = [...values].sort((a,b) => factionSort === 'name' ? a.name.localeCompare(b.name) : factionSort === 'closest' ? a.gap-b.gap || a.name.localeCompare(b.name) : b.gap-a.gap || a.name.localeCompare(b.name));
    return {
      values:sorted,
      positive:values.filter((item)=>item.value>0).length,
      negative:values.filter((item)=>item.value<0).length,
      neutral:values.filter((item)=>item.value===0).length,
      maxed:values.filter((item)=>item.gap===0).length,
      near:values.filter((item)=>item.gap>0 && item.gap<=250).length,
      largest:[...values].sort((a,b)=>b.gap-a.gap)[0],
      closest:[...values].filter((item)=>item.gap>0).sort((a,b)=>a.gap-b.gap)[0],
    };
  }, [factionRows, factionSort]);

  async function loadFile(file?: File) {
    if (!file) return;
    const request = ++generation.current;
    setError(''); setLoading(true);
    try {
      if (!file.size) throw new Error(`${file.name} is empty. Choose the text report generated by /outputfile, rather than a userdata placeholder.`);
      if (file.size > 5_000_000) throw new Error('Choose a character text report smaller than 5 MB.');
      const contents = await file.text();
      if (request !== generation.current) return;
      if (!parseCharacterReport(contents).length) throw new Error(`${file.name} contains no readable text.`);
      setText(contents); setSourceName(file.name); setQuery(''); setPage(0);
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : 'That file could not be read.');
    } finally { if (request === generation.current) setLoading(false); }
  }

  return (
    <section
      className={`characterlab ${dragging ? 'filedragging' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files[0]); }}
    >
      <header className="labhero">
        <div>
          <small>CHARACTER REPORT READER · {playerName.toUpperCase()}</small>
          <h2>Open an EQL character report</h2>
          <p>
            Choose an inventory, spell, achievement, or other readable EQL text report.
            EQLSaK reads it only in this browser and never uploads it.
          </p>
        </div>
        <button type="button" onClick={() => picker.current?.click()}>
          <FileUp aria-hidden="true" /> Choose text file
        </button>
        <input
          ref={picker}
          type="file"
          accept=".txt,.log,text/plain"
          hidden
          onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ''; }}
        />
      </header>

      {(error || report.error || factions.error || loading) && <p className="import-status" role={error || report.error ? 'alert' : 'status'}>{loading ? 'Reading character report…' : error || report.error || factions.error}</p>}
      <div className="labprivacy">
        <ShieldCheck aria-hidden="true" />
        <b>Private by design.</b> Processing stays on this device. This independent parser does
        not copy EQLTools code or claim an export format that has not been verified here.
      </div>

      <CharacterSyncReadiness />

      <ClassConfigurator playerName={playerName} playerBuild={playerBuild} playerLevel={playerLevel} />

      <InstallScanner onOpenReport={(file)=>{void loadFile(file)}} onOpenLogs={onOpenLogs} onOpenMaps={onOpenMaps} />

      <section className="labframework" aria-labelledby="framework-title">
        <header><div><small>CHARACTER TOOLS</small><h3 id="framework-title">Choose what you want to do</h3></div><span className="badge verified">Sources shown</span></header>
        <div className="labmodules">
          {modules.map((item) => <button type="button" className={guide.id === item.id ? 'active' : ''} aria-pressed={guide.id === item.id} key={item.id} onClick={() => setGuide(item)}><b>{item.name}</b><p>{item.description}</p><small>{item.id === 'logs' ? 'See log steps' : item.command ? 'See report steps' : 'See how it works'} <ChevronRight aria-hidden="true" /></small></button>)}
        </div>
        <article className="reportguide" aria-live="polite">
          <header><div><small>HOW TO USE THIS TOOL</small><h3>{guide.name}</h3></div><span className={guide.source.includes('verify') ? 'guidecaution' : ''}>{guide.source}</span></header>
          <ol>{guide.steps.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}</ol>
          {guide.command && <div className="guidecommands"><code>{guide.command}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(guide.command || ''); setGuideCopied(guide.id); } catch { setGuideCopied(''); } }}>{guideCopied === guide.id ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{guideCopied === guide.id ? 'Copied' : 'Copy command'}</button>{'secondaryCommand' in guide && guide.secondaryCommand && <><code>{guide.secondaryCommand}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(guide.secondaryCommand || ''); setGuideCopied(`${guide.id}-second`); } catch { setGuideCopied(''); } }}>{guideCopied === `${guide.id}-second` ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{guideCopied === `${guide.id}-second` ? 'Copied' : 'Copy command'}</button></>}</div>}
          <dl><div><dt>Look in</dt><dd>{guide.id === 'logs' ? `${installRoot}\\Logs` : installRoot}</dd></div><div><dt>Expected name</dt><dd>{guide.file}</dd></div></dl>
          <footer>{guide.id === 'logs' ? <button type="button" onClick={onOpenLogs}>Open Log Reader <ChevronRight aria-hidden="true" /></button> : guide.id === 'commands' ? <a href="#eql-command-center">Go to Command Center <ChevronRight aria-hidden="true" /></a> : <button type="button" onClick={() => picker.current?.click()}>Choose this report <FileUp aria-hidden="true" /></button>}</footer>
        </article>
      </section>

      {!rows.length ? (
        <div className="labempty">
          <FileUp aria-hidden="true" />
          <h3>{error || (dragging ? 'Release the text file here' : 'Drop in a real export when you have one')}</h3>
          <p>
            {error ? 'An empty EQL userdata file is only a placeholder; use an export that contains readable lines.' : 'You may also paste its contents below. Lines separated by tabs, pipes, or commas are broken into readable fields; unfamiliar lines remain visible instead of being discarded.'}
          </p>
          <textarea
            value={text}
            onChange={(event) => {
              generation.current++; setLoading(false); setText(event.target.value);
              setSourceName('Pasted text');
              setError('');
            }}
            placeholder="Paste the contents of a player-created EQL text export…"
            aria-label="Paste EQL text export"
          />
        </div>
      ) : (
        <div className="labresults">
          <div className="labtools">
            <div>
              <small>ACTIVE LOCAL SOURCE</small>
              <b>{sourceName || 'Pasted text'}</b>
              <span>{rows.length.toLocaleString()} readable lines</span>
            </div>
            <label>
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this export…" />
            </label>
            <button type="button" onClick={() => { generation.current++; setLoading(false); setText(''); setSourceName(''); setQuery(''); setError(''); setPage(0); }}>
              <Trash2 aria-hidden="true" /> Clear
            </button>
          </div>
          <section className="readablereport" aria-labelledby="readable-report-title">
            <header><div><small>YOUR REPORT</small><h3 id="readable-report-title">{readableReport.kind}</h3><p>{readableReport.firstLooksLikeHeader ? 'The file headings are used as column names below.' : 'This file has no clear headings, so its values are shown in numbered fields without guessing what they mean.'}</p></div><span>{sourceName}</span></header>
            <div className="reportfacts"><article><b>{readableReport.dataRows.length.toLocaleString()}</b><span>entries</span></article><article><b>{readableReport.headers.length}</b><span>fields per entry</span></article><article><b>{readableReport.unique.toLocaleString()}</b><span>unique first values</span></article></div>
            <div className="report-pagination"><span>{readableVisibleRows.length ? `Showing ${page * 200 + 1}–${Math.min((page + 1) * 200, readableVisibleRows.length)} of ${readableVisibleRows.length.toLocaleString()}` : 'No matching entries'}</span><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Back</button><button type="button" disabled={(page + 1) * 200 >= readableVisibleRows.length} onClick={() => setPage((value) => value + 1)}>Next</button></div>
            <div className="readabletable" role="region" aria-label="Readable EQL report"><table><thead><tr>{readableReport.headers.map((header,index)=><th key={`${header}-${index}`}>{header || `Field ${index+1}`}</th>)}</tr></thead><tbody>{readableVisibleRows.slice(page*200,(page+1)*200).map((row)=><tr key={row.id}>{readableReport.headers.map((_,index)=><td key={`${row.id}-${index}`}>{row.fields[index] || '—'}</td>)}</tr>)}</tbody></table>{!readableVisibleRows.length&&<p>No entries match “{query}”.</p>}</div>
            <details className="originalreport"><summary>View original text</summary><p>This is the unchanged file content for troubleshooting. Most players will not need it.</p><pre>{text}</pre></details>
          </section>
        </div>
      )}

      <SpellbookView key={sourceName} rows={visibleRows.slice(page * 200, (page + 1) * 200)} headerRows={rows.slice(0, 1)} sourceName={sourceName} />

      {factionRows.length > 0 && <section id="faction-tracker" className="factionglance" aria-label="Faction standings at a glance">
        <header><div><small>FACTION GAP REPORT · LOCAL EXPORT</small><h3>Current standing versus maximum</h3></div><span className="badge verified">User-provided EQL evidence</span></header>
        <div className="factiontotals"><article><b>{factionGlance.maxed}</b><span>at exported maximum</span></article><article><b>{factionGlance.near}</b><span>within 250 points</span></article><article><b>{factionRows.length-factionGlance.maxed}</b><span>still below maximum</span></article></div>
        <div className="factioninsights">
          <p><small>Closest unfinished</small><b>{factionGlance.closest?.name || 'All imported factions are maxed'}</b><span>{factionGlance.closest ? `${factionGlance.closest.gap.toLocaleString()} points remain` : 'No remaining gap'}</span></p>
          <p><small>Largest gap</small><b>{factionGlance.largest?.name || 'None'}</b><span>{factionGlance.largest ? `${factionGlance.largest.gap.toLocaleString()} points remain` : 'No imported factions'}</span></p>
          <label>Order<select value={factionSort} onChange={(event)=>setFactionSort(event.target.value as typeof factionSort)}><option value="gap">Largest gap first</option><option value="closest">Closest to max first</option><option value="name">Faction name</option></select></label>
        </div>
        <div className="factiongaplegend"><span><i className="earned"/>Current points above zero</span><span><i className="remaining"/>Points still needed for maximum</span></div>
        <div className="factiongaplist">{factionGlance.values.map((item)=>{
          const scale=Math.max(1,item.maximum);
          const earned=Math.max(0,Math.min(100,(item.value/scale)*100));
          const remaining=Math.max(0,100-earned);
          return <article key={`${item.id}-${item.name}`}><header><div><b>{item.name}</b><small>ID {item.id}</small></div><strong className={item.gap===0?'complete':''}>{item.gap===0?'At maximum':`${item.gap.toLocaleString()} short`}</strong></header><div className="factiongapbar" aria-label={`${item.name}: current standing ${item.value}, ${item.gap} points to maximum`}><i style={{width:`${earned}%`}}/><em style={{width:`${remaining}%`}}/></div><footer><span>Standing <b>{item.value>0?'+':''}{item.value.toLocaleString()}</b></span><span>Exported max <b>{item.maximum.toLocaleString()}</b></span><span>Gap <b>{item.gap.toLocaleString()}</b></span></footer></article>})}</div>
        <footer><b>How to read this:</b> blue shows positive standing earned from the zero baseline; copper shows the exact PointsToMax delta supplied by your EQL report. “At maximum” is definitive. A quest or vendor may require less than maximum, so “enough” for that specific purpose needs its documented target and is not guessed here.</footer>
      </section>}

      <section className="commandcenter" id="eql-command-center" aria-labelledby="command-center-title">
        <header><div><small>EQL COMMAND CENTER · {eqlCommands.length} INDEXED SYNTAXES</small><h3 id="command-center-title">Build a copy-ready in-game macro</h3></div><span className={`badge ${currentCommandSource.startsWith('User') ? 'verified' : currentCommandSource.startsWith('EQL-specific') ? 'eql' : 'legacy'}`}>{currentCommandSource}</span></header>
        <div className="commandbuilder">
          <aside className="commandcatalog">
            <label><Search aria-hidden="true"/><input value={commandQuery} onChange={(event)=>setCommandQuery(event.target.value)} placeholder="Search every indexed command…" aria-label="Search indexed EQL commands"/></label>
            <div className="commandstarters" aria-label="Macro starters">{commandStarters.map((starter)=><button type="button" key={starter.label} onClick={()=>{setMacroLines([...starter.lines, ...Array(5-starter.lines.length).fill('')]);setCommandDraft(starter.lines[0]);setActiveMacroLine(0);setCopied(false)}}><b>{starter.label}</b><small>{starter.source}</small></button>)}</div>
            <div className="commandmatches" aria-label="Matching command syntax"><header><b>Command index</b><span>{commandMatches.length}{commandMatches.length === 40 ? '+' : ''} shown</span></header>{commandMatches.map((entry)=><button type="button" key={entry.syntax} className={commandDraft===entry.syntax?'active':''} onClick={()=>{setCommandDraft(entry.syntax);setCopied(false)}}><code>{entry.syntax}</code><small>{entry.description}</small></button>)}</div>
          </aside>
          <div className="macrocomposer">
            <label className="commanddraft">Selected command — edit parameters before use<input value={commandDraft} onChange={(event)=>{setCommandDraft(event.target.value);setCopied(false)}} /></label>
            {hasPlaceholders(commandDraft)&&<p className="commandplaceholder" role="status">Replace every value in <code>&lt;angle brackets&gt;</code>, <code>[square brackets]</code>, or <code>{'{braces}'}</code> before using this command.</p>}
            <button type="button" className="useline" onClick={()=>{setMacroLines((lines)=>lines.map((line,index)=>index===activeMacroLine?commandDraft:line));setCopied(false)}}>Use in line {activeMacroLine+1}</button>
            <fieldset><legend>Five-line EQL social / hotbutton</legend>{macroLines.map((line,index)=><label key={index} className={activeMacroLine===index?'active':''}><button type="button" onClick={()=>setActiveMacroLine(index)} aria-label={`Select macro line ${index+1}`}>{index+1}</button><input value={line} onFocus={()=>setActiveMacroLine(index)} onChange={(event)=>{const value=event.target.value;setMacroLines((lines)=>lines.map((item,lineIndex)=>lineIndex===index?value:item));setCopied(false)}} placeholder={index===0?'Choose a command or type a slash command':'Optional next command'}/></label>)}</fieldset>
            <div className="macrooutput"><pre>{macro || 'Add at least one command line.'}</pre><button type="button" disabled={!macro} onClick={async () => { try { await navigator.clipboard.writeText(macro); setCopied(true); } catch { setCopied(false); } }}><Clipboard aria-hidden="true" />{copied ? 'Copied' : 'Copy macro'}</button></div>
          </div>
        </div>
        <p className="commandnote"><b>Evidence boundary:</b> the complete syntax index comes from the EQL Wiki command page. A listing is not proof that the command is enabled or unchanged in EQL, so non-verified entries are labelled for an in-client check. Socials accept up to five lines; <code>/pause</code> values use tenths of a second and can make a macro slow to interrupt.</p>
      </section>

      <footer>
        <b>Provenance:</b> file contents are user-provided EQL evidence. Interpretation remains
        provisional until the exact export type and columns are verified in EQL.
      </footer>
    </section>
  );
}
