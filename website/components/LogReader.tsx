'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {csvCell} from '../lib/local-state';
import { buildEncounters, encounterBuckets, readLogFile } from '../lib/log-report';
import type { Event, Kind } from '../lib/log-report';
import {
  BarChart3,
  Clock3,
  Download,
  FileText,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';

function fmt(n: number) { return new Intl.NumberFormat().format(n); }

export default function LogReader() {
  const input = useRef<HTMLInputElement>(null),
    [events, setEvents] = useState<Event[]>([]),
    [fileName, setFileName] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState<'all' | Kind>('all'),
    [selectedEncounter, setSelectedEncounter] = useState(0),
    [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const importController = useRef<AbortController | null>(null);
  useEffect(() => () => importController.current?.abort(), []);
  const encounters = useMemo(() => buildEncounters(events).reverse(), [events]);
  const encounterReport = useMemo(() => {
    const encounter = encounters[selectedEncounter] || encounters[0];
    if (!encounter) return null;
    const duration = Math.max(1, Math.ceil((encounter.end - encounter.start) / 1000));
    const total = encounter.damage.reduce((sum, event) => sum + (event.amount || 0), 0);
    const actors = new Map<string, { total:number; hits:number; crits:number; max:number }>();
    const methods = new Map<string, { total:number; hits:number }>();
    encounter.damage.forEach((event) => {
      const actor = event.actor === 'You' ? 'You' : event.actor;
      const row = actors.get(actor) || { total:0, hits:0, crits:0, max:0 };
      row.total += event.amount || 0; row.hits += 1; row.crits += event.critical ? 1 : 0; row.max = Math.max(row.max, event.amount || 0); actors.set(actor,row);
      const method = event.method || 'damage', methodRow = methods.get(method) || {total:0,hits:0};
      methodRow.total += event.amount || 0; methodRow.hits += 1; methods.set(method,methodRow);
    });
    const sortedActors=[...actors.entries()].sort((a,b)=>b[1].total-a[1].total);
    const sortedMethods=[...methods.entries()].sort((a,b)=>b[1].total-a[1].total);
    const peakMethod=Math.max(1,...sortedMethods.map(([,row])=>row.total));
    const buckets = encounterBuckets(encounter);
    const peakBucket=Math.max(1,...buckets);
    return { encounter, duration, total, dps:Math.round(total/duration), hits:encounter.damage.length, crits:encounter.damage.filter(event=>event.critical).length, maxHit:encounter.damage.reduce((peak,event)=>Math.max(peak,event.amount||0),0), actors:sortedActors, methods:sortedMethods, peakMethod, buckets, peakBucket };
  }, [encounters, selectedEncounter]);
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (kind === 'all' || e.kind === kind) &&
          `${e.actor} ${e.target} ${e.detail} ${e.raw}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [events, kind, query],
  );
  const totals = useMemo(
    () =>
      (['damage', 'chat', 'loot', 'faction', 'system', 'text'] as Kind[]).map(
        (name) =>
          [name, events.filter((event) => event.kind === name).length] as const,
      ),
    [events],
  );
  const glance = useMemo(() => {
    const damageEvents = events.filter((event) => event.kind === 'damage');
    const byActor = new Map<string, number>();
    damageEvents.forEach((event) => byActor.set(event.actor || 'Unknown', (byActor.get(event.actor || 'Unknown') || 0) + (event.amount || 0)));
    const actors = [...byActor.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
    const peak = actors[0]?.[1] || 1;
    const recognized=events.filter(event=>event.kind!=='text').length;
    const peakKind=Math.max(1,...totals.map(([,value])=>value));
    const lootCounts=new Map<string,number>(),factionCounts=new Map<string,{better:number;worse:number}>();
    events.forEach(event=>{if(event.kind==='loot')lootCounts.set(event.target,(lootCounts.get(event.target)||0)+1);if(event.kind==='faction'){const current=factionCounts.get(event.target)||{better:0,worse:0};current[event.detail==='worse'?'worse':'better']+=1;factionCounts.set(event.target,current)}});
    const bins=Array.from({length:12},(_,index)=>{const start=Math.floor(index*events.length/12),end=Math.floor((index+1)*events.length/12);return events.slice(start,end).filter(event=>event.kind!=='text').length});
    const peakBin=Math.max(1,...bins);
    const dated=events.filter((event):event is Event&{date:number}=>event.date!==null);
    const duration=dated.length>1?Math.max(0,dated.at(-1)!.date-dated[0].date):0;
    const plainSummary=damageEvents.length
      ? `This file includes ${fmt(damageEvents.length)} recognizable damage lines, so a damage breakdown is available.`
      : events.some(event=>event.kind==='loot'||event.kind==='faction')
        ? 'This is mainly an activity record: it contains loot or faction changes, but no recognizable combat-damage lines.'
        : 'This file is mostly chat, system messages, or unclassified text. Combat statistics cannot be recovered from lines that were never recorded.';
    return {
      totalDamage: damageEvents.reduce((sum,event) => sum + (event.amount || 0), 0),
      actors: actors.map(([name,value]) => ({name,value,width:Math.max(4,value/peak*100)})),
      factionBetter: events.filter((event) => event.kind === 'faction' && event.detail === 'better').length,
      factionWorse: events.filter((event) => event.kind === 'faction' && event.detail === 'worse').length,
      loot: events.filter((event) => event.kind === 'loot').length,
      coverage:events.length?Math.round(recognized/events.length*100):0,
      kindBars:totals.map(([name,value])=>({name:name==='text'?'Other text':name,value,width:value?Math.max(3,value/peakKind*100):0})),
      bins:bins.map((value,index)=>({label:`Part ${index+1}`,value,height:value?Math.max(5,value/peakBin*100):0})),
      topLoot:[...lootCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),
      topFactions:[...factionCounts.entries()].sort((a,b)=>(b[1].better+b[1].worse)-(a[1].better+a[1].worse)).slice(0,5),
      duration,
      plainSummary,
    };
  }, [events, totals]);
  async function choose(file?: File) {
    if (!file) return;
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    setError(''); setProgress(0);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Choose a log smaller than 100 MB for this browser session.');
      const parsed = await readLogFile(file, { signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return;
      setEvents(parsed); setFileName(file.name); setSelectedEncounter(0);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'That file could not be read as a text log.');
    } finally {
      if (importController.current === controller) setProgress(null);
    }
  }
  function exportCsv() {
    const header = [
      'timestamp',
      'type',
      'actor',
      'target',
      'detail',
      'original',
    ];
    const rows = filtered.map((e) => [
      e.timestamp,
      e.kind,
      e.actor,
      e.target,
      e.detail,
      e.raw,
    ]);
    const blob = new Blob(
        [[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')],
        { type: 'text/csv;charset=utf-8' },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download =
      (fileName.replace(/\.[^.]+$/, '') || 'eql-session') + '-readable.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="logdesk" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
      <header className="loghero">
        <div>
          <small>LOCAL-ONLY EQL LOG READER</small>
          <h2>Turn the scroll into a field report.</h2>
          <p>
            Your selected log is parsed inside this browser tab. Its contents
            are not sent to EQLSaK or stored on the site.
          </p>
        </div>
        <button className="logpick" onClick={() => input.current?.click()}>
          <Upload />
          Choose EQL log
        </button>
        <input
          ref={input}
          type="file"
          accept=".txt,.log,text/plain"
          hidden
          onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }}
        />
      </header>
      {progress !== null && <div className="import-status" role="status"><span>Reading {progress}% · You can keep using the page.</span><progress max={100} value={progress}/><button onClick={() => { importController.current?.abort(); setProgress(null); }}>Cancel import</button></div>}
      {error && <p className="import-status" role="alert">{error}</p>}
      <div className="logsetup">
        <strong>Choose a file that actually exists</strong>
        <span>
          Open the EQL Logs folder and select any existing readable text file:
        </span>
        <code>
          C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest
          Legends\Logs
        </code>
        <em className="badge verified">User-provided EQL location</em>
      </div>
      {!events.length ? (
        <div
          className="logdrop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation(); void choose(e.dataTransfer.files[0]);
          }}
        >
          <FileText />
          <h3>{error || 'Choose or drop a character log here'}</h3>
          <p>
            EQLSaK does not assume a character/server filename. If that folder
            contains a .txt or .log file, this viewer can organize its readable
            lines. If the folder contains no text log, there is nothing for the
            browser to import—and this tool cannot manufacture one.
          </p>
          <span>Nothing leaves your device.</span>
        </div>
      ) : (
        <>
          <div className="logfile">
            <span>
              <ShieldCheck />
              LOCAL PARSE
            </span>
            <b>{fileName}</b>
            <small>{fmt(events.length)} readable lines</small>
            <button onClick={() => input.current?.click()}>Change file</button>
            <button onClick={exportCsv}>
              <Download />
              Readable CSV
            </button>
          </div>
          {encounterReport && (
            <section className="combatmeter" aria-label="Combat encounter report">
              <aside>
                <header><small>FIGHTS</small><b>{encounters.length} detected</b></header>
                <div>
                  {encounters.slice(0, 60).map((encounter, index) => {
                    const seconds=Math.max(1,Math.ceil((encounter.end-encounter.start)/1000));
                    const total=encounter.damage.reduce((sum,event)=>sum+(event.amount||0),0);
                    return <button key={`${encounter.id}-${index}`} className={index===selectedEncounter?'active':''} onClick={()=>setSelectedEncounter(index)}>
                      <b>{encounter.target}</b><span>{seconds}s · {Math.round(total/seconds)} group DPS · {encounter.slain?'kill':'engagement'}</span>
                    </button>;
                  })}
                </div>
              </aside>
              <main>
                <header>
                  <div><small>COMBAT</small><h3>{encounterReport.encounter.target}</h3><span>{encounterReport.encounter.slain?'Confirmed kill':'Recorded engagement'}</span></div>
                  <dl>
                    <div><dt>Duration</dt><dd>{encounterReport.duration}s</dd></div>
                    <div><dt>Total</dt><dd>{fmt(encounterReport.total)}</dd></div>
                    <div><dt>Group DPS</dt><dd>{fmt(encounterReport.dps)}</dd></div>
                    <div><dt>Max hit</dt><dd>{fmt(encounterReport.maxHit)}</dd></div>
                  </dl>
                </header>
                <div className="combatcards">
                  <article><span>Hits recorded</span><b>{encounterReport.hits}</b></article>
                  <article><span>Critical hits</span><b>{encounterReport.crits}</b></article>
                  <article><span>Participants</span><b>{encounterReport.actors.length}</b></article>
                  <article><span>Result</span><b>{encounterReport.encounter.slain?'Slain':'No kill line'}</b></article>
                </div>
                <section className="damagecurve">
                  <header><b>Damage over time</b><span>Taller columns show heavier damage moments during this fight.</span></header>
                  <div>{encounterReport.buckets.map((value,index)=><i key={index} title={`${value} damage`} style={{height:`${Math.max(4,value/encounterReport.peakBucket*100)}%`}}><span>{value}</span></i>)}</div>
                </section>
                <section className="combatactors">
                  <header><b>Who contributed</b><span>Damage attributed by the lines EQL recorded.</span></header>
                  {encounterReport.actors.map(([name,row])=><article key={name}><div><b>{name}</b><span>{row.hits} hits · {row.crits} crits · max {row.max}</span></div><strong>{fmt(row.total)} <small>· {Math.round(row.total/encounterReport.duration)} DPS</small></strong></article>)}
                </section>
              </main>
              <aside className="methodbreakdown">
                <header><small>BREAKDOWN</small><b>Attack types</b></header>
                {encounterReport.methods.map(([name,row])=><article key={name}><label><b>{name}</b><span>{fmt(row.total)} · {row.hits} hit{row.hits===1?'':'s'}</span></label><i><em style={{width:`${Math.max(5,row.total/encounterReport.peakMethod*100)}%`}}/></i></article>)}
                <footer><b>What this means</b><p>These are observed totals from this encounter—not promised damage, a ranking, or an invented drop rate.</p></footer>
              </aside>
            </section>
          )}
          <div className="logstats">
            {totals.map(([name, value]) => (
              <article key={name}>
                <FileText />
                <span>{name === 'text' ? 'Other text' : name}</span>
                <b>{fmt(value)}</b>
              </article>
            ))}
          </div>
          <section className="sessionglance" aria-label="Session charts at a glance">
            <header><div><small>VISUAL FIELD REPORT</small><h3>What this file contains—and what it means</h3></div><span className="badge verified">Local evidence</span></header>
            <p className="plainfinding">{glance.plainSummary}</p>
            <div className="reportindices">
              <article><BarChart3/><span><b>{glance.coverage}%</b> of lines recognized</span><p>Higher means more of this file could be placed into useful categories. Unrecognized lines are kept, not discarded.</p></article>
              <article><Clock3/><span><b>{glance.duration?`${Math.max(1,Math.round(glance.duration/60000))} min`:'Unknown'}</b> recorded time span</span><p>A time span appears only when the selected file contains readable timestamps.</p></article>
              <article><FileText/><span><b>{fmt(events.length)}</b> readable lines</span><p>This is the amount of evidence in the file, not a score for the player.</p></article>
            </div>
            <div className="reportvisuals">
              <article><header><b>Contents of the file</b><span>Each bar is a share of the busiest category.</span></header><div className="kindbars">{glance.kindBars.map(row=><div key={row.name}><label><span>{row.name}</span><b>{fmt(row.value)}</b></label><i><em style={{width:`${row.width}%`}}/></i></div>)}</div></article>
              <article><header><b>Activity through the file</b><span>The file is divided into 12 equal parts; taller columns mean more recognized activity.</span></header><div className="activityhistogram">{glance.bins.map(bin=><div key={bin.label} title={`${bin.label}: ${bin.value} recognized events`}><i style={{height:`${bin.height}%`}}/><span>{bin.label.replace('Part ','')}</span></div>)}</div></article>
            </div>
            <div className="glancegrid">
              <article><b>{fmt(glance.totalDamage)}</b><span>parsed damage points</span><div className="actorbars">{glance.actors.length ? glance.actors.map((actor)=><div key={actor.name}><label><span>{actor.name}</span><b>{fmt(actor.value)}</b></label><i><em style={{width:`${actor.width}%`}}/></i></div>) : <p>No recognizable damage lines in this file.</p>}</div></article>
              <article><b>{glance.factionBetter + glance.factionWorse}</b><span>faction movements</span><div className="splitbar"><i style={{flex:glance.factionBetter || 0.001}}>Better {glance.factionBetter}</i><em style={{flex:glance.factionWorse || 0.001}}>Worse {glance.factionWorse}</em></div></article>
              <article><b>{glance.loot}</b><span>loot or receipt events</span><p>Inventory status requires an `/outputfile inventory` export; loot lines alone cannot prove what is still carried.</p></article>
            </div>
            {(glance.topLoot.length>0||glance.topFactions.length>0)&&<div className="reportlists">{glance.topLoot.length>0&&<article><b>Most-seen loot</b>{glance.topLoot.map(([name,count])=><div key={name}><span>{name}</span><strong>{count} sighting{count===1?'':'s'}</strong></div>)}</article>}{glance.topFactions.length>0&&<article><b>Faction movement</b>{glance.topFactions.map(([name,count])=><div key={name}><span>{name}</span><strong>{count.better} better · {count.worse} worse</strong></div>)}</article>}</div>}
            <footer><b>How to read this:</b> bars and counts describe only recognized lines in this selected file. Damage totals are not DPS unless timing and ownership are reliable; loot sightings are not drop rates; faction messages show direction, not exact points.</footer>
          </section>
          <div className="loggrid">
            <section className="logleaders">
              <small>USER-VERIFIED EQL</small>
              <h3>What this reader does</h3>
              <p>
                Reads and searches the text EQL actually records. It can total
                recognizable damage lines, but it will not claim DPS, healing,
                or other statistics that the file does not support.
              </p>
              <p>Every non-empty line remains available under All lines.</p>
            </section>
            <section className="logevents">
              <header>
                <div className="logsearch">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search names, chat, zones, or any text…"
                  />
                </div>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  <option value="all">All events</option>
                  {(
                    [
                      'damage',
                      'loot',
                      'faction',
                      'chat',
                      'system',
                      'text',
                    ] as Kind[]
                  ).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </header>
              <div className="eventlist">
                {filtered
                  .slice(-500)
                  .reverse()
                  .map((e) => (
                    <article className={`event ${e.kind}`} key={e.id}>
                      <time>{e.timestamp || 'No timestamp'}</time>
                      <span>{e.kind}</span>
                      <p>{e.raw}</p>
                    </article>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
      <footer className="loglimits">
        <b>Confirmed EQL workflow:</b> Enter <code>/log on</code> in the game,
        then choose the real <code>eqlog_&lt;Character&gt;_&lt;Server&gt;.txt</code> file
        EQL creates in the Logs folder. The name uses the player&apos;s actual
        character and server. EQLSaK reads it locally and never uploads or alters it.
      </footer>
    </section>
  );
}
