'use client';

import { useMemo, useState } from 'react';
import { Check, Clipboard, ExternalLink, Search, ShieldAlert } from 'lucide-react';
import commands from '@/data/eqlwiki-commands.json';

const categories = ['All','Combat & targeting','Spells & abilities','Loot & inventory','Group, raid & guild','Chat & social','Travel & navigation','Interface & display','Character & account','System & other'] as const;
type Category = (typeof categories)[number];
const dangerous = new Set(['/destroyitem','/guilddelete','/decaycorpse','/exit','/quit','/system','/fastdrop','/safelock']);
const verified = new Set(['/faction','/log']);

type CommandEntry = { syntax: string; description: string };
const commandEntries = commands as CommandEntry[];

function rootOf(syntax: string) { return syntax.split(/[\s[]/)[0]; }
function categoryOf(syntax: string): Category {
  const root = rootOf(syntax);
  if (/attack|assist|aggro|combat|disc|shield|target|track|autofire|autoskill|stopdisc|yell|consider/.test(root)) return 'Combat & targeting';
  if (/cast|spell|melody|ability|alternateadv|pet|familiar|stopsong|stopcast|swarm/.test(root)) return 'Spells & abilities';
  if (/loot|inventory|bank|barter|bazaar|buyer|trader|finditem|useitem|bandolier|overflow|tribute|trophy/.test(root)) return 'Loot & inventory';
  if (/group|raid|guild|task|dz|leader|invite|disband|role|consent|marknpc|kickplayer/.test(root)) return 'Group, raid & guild';
  if (/say|tell|chat|auction|ooc|shout|emote|reply|friends|ignore|afk|anon|motd|language|voice|vgroup|vraid|vtell|ttell/.test(root)) return 'Chat & social';
  if (/loc|waypoint|map|findpc|rewind|pickzone|open|run|dismount|realestate|camp/.test(root)) return 'Travel & navigation';
  if (/ui|font|fullscreen|viewport|show|hide|particle|shadow|color|skin|indicator|inspect|filter|mousespeed|dynamiclights/.test(root)) return 'Interface & display';
  if (/achievement|character|surname|name|racechange|played|setstartcity|keyring|keys|claim|reward|marketplace|servertransfer/.test(root)) return 'Character & account';
  return 'System & other';
}
function summaryFor(entry: CommandEntry) {
  return entry.description || 'No plain-language description is recorded for this command yet.';
}

export default function CommandDirectory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [copied, setCopied] = useState('');
  const filtered = useMemo(() => commandEntries.filter((entry) => {
    const matchesCategory = category === 'All' || categoryOf(entry.syntax) === category;
    const needle = query.trim().toLowerCase();
    return matchesCategory && (!needle || `${entry.syntax} ${summaryFor(entry)} ${categoryOf(entry.syntax)}`.toLowerCase().includes(needle));
  }), [query, category]);
  const groups = useMemo(() => {
    const byLetter = new Map<string, CommandEntry[]>();
    filtered.forEach((entry) => {
      const letter = rootOf(entry.syntax).slice(1,2).toUpperCase() || '#';
      byLetter.set(letter, [...(byLetter.get(letter) || []), entry]);
    });
    return [...byLetter.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [filtered]);

  return <section className="commanddirectory" aria-labelledby="command-directory-title">
    <header><div><small>EQL WIKI COMMAND INDEX · CURRENT REFERENCE</small><h2 id="command-directory-title">Search {commandEntries.length} slash commands</h2><p>Each command now includes its plain-language EQL Wiki description on the same card. Confirm commands in your client before relying on them.</p></div><a href="https://eqlwiki.com/Commands" target="_blank" rel="noreferrer">Open source page <ExternalLink aria-hidden="true" /></a></header>
    <div className="commandsearch"><Search aria-hidden="true"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search commands, functions, or categories…" aria-label="Search command directory"/><span>{filtered.length} matches</span></div>
    <nav className="commandcategories" aria-label="Command categories">{categories.map((item)=><button type="button" key={item} className={category===item?'active':''} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}<span>{item==='All'?commandEntries.length:commandEntries.filter((entry)=>categoryOf(entry.syntax)===item).length}</span></button>)}</nav>
    <div className="commandletters">{groups.map(([letter, entries])=><section key={letter}><header><b>{letter}</b><span>{entries?.length || 0}</span></header><div>{entries?.map((entry)=>{
      const { syntax } = entry;
      const root=rootOf(syntax); const isDangerous=dangerous.has(root); const isVerified=verified.has(root);
      return <article key={syntax} className={isDangerous?'commandcaution':''}><div><code>{syntax}</code>{isVerified&&<span className="badge verified">User-Verified EQL</span>}{isDangerous&&<span className="commandwarning"><ShieldAlert aria-hidden="true"/>Can alter or destroy state</span>}</div><p>{summaryFor(entry)}</p><footer><small>{categoryOf(syntax)}</small><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(syntax);setCopied(syntax)}catch{setCopied('')}}}>{copied===syntax?<Check aria-hidden="true"/>:<Clipboard aria-hidden="true"/>}{copied===syntax?'Copied':'Copy syntax'}</button></footer></article>;
    })}</div></section>)}</div>
    {!filtered.length&&<p className="commandnomatch">No commands match that search and category.</p>}
    <footer><b>Source boundary:</b> Descriptions are adapted from the EQL Wiki command index under CC BY-SA 4.0. Inclusion here is not proof that every command is enabled or unchanged in EverQuest Legends. User-verified EQL behavior takes priority.</footer>
  </section>;
}
