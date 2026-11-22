'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, Map, Search, ShieldCheck, Swords } from 'lucide-react';

const sources=[
  {name:'EQL Source',grade:'Measured EQL evidence',url:'https://eqlsource.com/tools/index-search',about:'Items, named mobs, surveyed dungeons, coordinates, drops, and visible sourcing dates.'},
  {name:'EQL Tools Atlas',grade:'EQL-specific tool',url:'https://eqltools.com/atlas',about:'Game-mesh dungeon geometry, multi-level views, mobs, and loot locations.'},
  {name:'EQLBase',grade:'Observed + labelled baseline',url:'https://eqlbase.com/',about:'Zones, items, bestiary, quests, factions, spells, and player-confirmed discoveries.'},
  {name:'EQL Wiki',grade:'Community-maintained',url:'https://eqlwiki.com/',about:'Broad community reference; inherited classic information still requires verification.'},
] as const;

function focusedSearch(query:string,domain?:string){const terms=`EverQuest Legends ${query}${domain?` site:${domain}`:''}`;return `https://www.google.com/search?q=${encodeURIComponent(terms)}`}

export default function SourceFinder({initialQuery=''}:{initialQuery?:string}){
  const [query,setQuery]=useState(initialQuery),[searched,setSearched]=useState(initialQuery);
  useEffect(()=>{if(initialQuery){setQuery(initialQuery);setSearched(initialQuery)}},[initialQuery]);
  function submit(event:FormEvent){event.preventDefault();if(query.trim())setSearched(query.trim())}
  return <section className="sourcefinder" aria-labelledby="source-finder-title"><header><div><small>NO API KEY · CURRENT WEB SOURCES</small><h2 id="source-finder-title">EQL Source Finder</h2><p>Search the Knife first, then continue into current EQL-specific community and official web sources without sending character files or logs anywhere.</p></div><span><ShieldCheck/>Source boundaries stay visible</span></header><form onSubmit={submit}><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Loot, named mob, zone, map, quest, or dungeon…" aria-label="Search current EQL sources"/><button type="submit">Build source searches</button></form>{searched&&<div className="sourceactions"><a href={focusedSearch(searched)} target="_blank" rel="noreferrer"><Search/>Search the EQL web for “{searched}”<ExternalLink/></a><a href={focusedSearch(searched,'everquest.com')} target="_blank" rel="noreferrer"><ShieldCheck/>Check official EverQuest pages<ExternalLink/></a><a href={focusedSearch(`${searched} loot drops named mob`)} target="_blank" rel="noreferrer"><Swords/>Find drops and named mobs<ExternalLink/></a><a href={focusedSearch(`${searched} map dungeon mesh wireframe 3D`)} target="_blank" rel="noreferrer"><Map/>Find maps and dungeon geometry<ExternalLink/></a></div>}<div className="sourcecards">{sources.map(source=><article key={source.name}><small>{source.grade}</small><h3>{source.name}</h3><p>{source.about}</p><div>{searched&&<a href={focusedSearch(searched,new URL(source.url).hostname)} target="_blank" rel="noreferrer">Search this source<ExternalLink/></a>}<a href={source.url} target="_blank" rel="noreferrer">Open source<ExternalLink/></a></div></article>)}</div><footer><b>Honesty rule:</b> opening a result does not make it verified. Daybreak statements and direct EQL measurements outrank community summaries; inherited classic EQ claims remain unverified until EQL evidence confirms them.</footer></section>
}
