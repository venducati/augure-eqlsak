// Sync EQLWiki quest metadata for the quests the item catalog references,
// into data/eqlwiki-quests.json. Resolves every quest name items link to,
// fetches each quest page, parses its questTopTable (giver, start zone,
// level, classes, related zones/NPCs) and reward list, and classifies epic
// vs heroic vs regular via the Epic Quests Era category + {{Epics Era}} marker.
// Etiquette: declared user-agent, batched queries, paced requests.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://eqlwiki.com/api.php';
const HEADERS = { 'user-agent': 'EQLSaK/1.0 open-source community companion' };
const OUT = resolve('data/eqlwiki-quests.json');
const ITEMS = resolve('data/eqlwiki-items.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 429) { await sleep(2000 * attempt); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${params.action}`);
    return res.json();
  }
  throw new Error(`Rate-limited beyond retries for ${params.action}`);
}

// ---------- referenced-quest universe ----------
function collectQuestNames() {
  const items = JSON.parse(readFileSync(ITEMS, 'utf8')).items;
  const names = new Set();
  for (const it of Object.values(items)) for (const q of it.quests || []) names.add(q);
  return [...names];
}

// ---------- resolve names -> pageid/canonical (+ epic category) ----------
async function resolveTitles(names) {
  const map = new Map(); // refName -> {pageid, canonical, missing}
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const j = await api({ action: 'query', titles: batch.join('|'), redirects: '1', format: 'json' });
    // Build from->to chains for normalized/redirected requests.
    const alias = new Map();
    for (const n of j.query.normalized || []) alias.set(n.from, n.to);
    for (const r of j.query.redirects || []) alias.set(r.from, r.to);
    // Map each requested name through any alias chain to the returned page title.
    const byTitle = new Map();
    for (const p of Object.values(j.query.pages)) byTitle.set(p.title, p);
    for (const req of batch) {
      const target = alias.get(req) || req;
      const page = byTitle.get(target) || byTitle.get(req);
      if (page) map.set(req, { pageid: page.pageid, canonical: page.title, missing: page.missing !== undefined });
      else map.set(req, { pageid: undefined, canonical: target, missing: true });
    }
    process.stdout.write(`\rresolved ${Math.min(i + 50, names.length)}/${names.length}`);
    await sleep(250);
  }
  console.log('');
  return map;
}

async function categoryMembers(category) {
  const titles = new Set();
  let cont = null;
  do {
    const params = { action: 'query', list: 'categorymembers', cmtitle: category, cmtype: 'page', cmlimit: '500', format: 'json' };
    if (cont) params.cmcontinue = cont;
    let j;
    try { j = await api(params); } catch { return titles; } // category may not exist
    for (const m of j.query?.categorymembers || []) if (m.ns === 0) titles.add(m.title);
    cont = j.continue?.cmcontinue || null;
  } while (cont);
  return titles;
}

// ---------- fetch content by pageid ----------
async function fetchByIds(pageids) {
  const out = new Map();
  for (let i = 0; i < pageids.length; i += 50) {
    const batch = pageids.slice(i, i + 50);
    const j = await api({ action: 'query', pageids: batch.join('|'), prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json' });
    for (const p of Object.values(j.query.pages)) {
      const c = p?.revisions?.[0]?.slots?.main?.['*'];
      if (c && c.length < 200000) out.set(p.pageid, { title: p.title, content: c });
    }
    process.stdout.write(`\rcontent ${Math.min(i + 50, pageids.length)}/${pageids.length}`);
    if ((i / 50) % 10 === 9) await sleep(400); else await sleep(250);
  }
  console.log('');
  return out;
}

// ---------- parse ----------
const ENTITIES = new Map([['&mdash;', '—'], ['&ndash;', '–'], ['&nbsp;', ' '], ['&amp;', '&'], ['&quot;', '"'], ['&#39;', "'"], ['&lt;', '<'], ['&gt;', '>']]);
const decode = (s) => String(s).replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES.get(e.toLowerCase()) ?? e).trim();
const linkNames = (cell) => {
  const names = [];
  for (const m of String(cell).matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    const n = decode(m[2] || m[1]);
    if (n) names.push(n);
  }
  return names;
};

function parseTable(content) {
  // The questTopTable is a wikitable whose rows alternate "! ''' Label: '''" then "| value".
  const table = content.match(/\{\|[^}]*?class="questTopTable"(.*?)\n\|\}/is)?.[1];
  if (!table) return null;
  const cells = {};
  let pending = null;
  for (const rawLine of table.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('!')) {
      const m = line.match(/'''([^']+?):/);
      if (m) pending = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
    } else if (line.startsWith('|') && pending && !line.startsWith('|-') && !line.startsWith('!')) {
      cells[pending] = line.replace(/^\|/, '').trim();
      pending = null;
    }
  }
  return cells;
}

function parseRewards(content) {
  const sec = content.match(/==+\s*Rewards?\s*==+([\s\S]*?)(?:\n==+|\{\{Checkbox|$)/i)?.[1] || '';
  const out = [];
  for (const m of sec.matchAll(/\{\{\s*:\s*([^}|]+)(?:\|[^}]*)?\}\}|\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    const n = decode(m[1] || m[3] || m[2]);
    if (n && !/^(File|Category|Template):/i.test(n)) out.push(n);
  }
  return [...new Set(out)].slice(0, 12);
}

function classify(canonical, content, epicTitles, heroicTitles) {
  if (epicTitles.has(canonical) || /\{\{\s*Epic/i.test(content)) return 'epic';
  if (heroicTitles.has(canonical) || /\{\{\s*Heroic/i.test(content)) return 'heroic';
  if (/\bepic\b/i.test(canonical)) return 'epic';
  return 'regular';
}

// ---------- run ----------
const names = collectQuestNames();
console.log(`quest names referenced by items: ${names.length}`);
const resolution = await resolveTitles(names);
const epicTitles = await categoryMembers('Category:Epic Quests Era');
const heroicTitles = await categoryMembers('Category:Heroic Quests Era');
console.log(`epic category members: ${epicTitles.size} | heroic: ${heroicTitles.size}`);

const idsToFetch = [...new Set([...resolution.values()].filter((r) => !r.missing && r.pageid).map((r) => r.pageid))];
console.log(`distinct quest pages to fetch: ${idsToFetch.length}`);
const content = await fetchByIds(idsToFetch);

const quests = {}; // keyed by referenced name (what items point at)
let parsedTables = 0;
for (const refName of names) {
  const info = resolution.get(refName);
  if (!info || info.missing || !info.pageid) continue;
  const page = content.get(info.pageid);
  if (!page) continue;
  const cells = parseTable(page.content);
  const giverCells = cells ? (cells['quest giver'] || '') : '';
  const givers = linkNames(giverCells || '');
  const startZone = cells ? linkNames(cells['start zone'] || '')[0] || decode(cells['start zone'] || '').split(/[,;]/)[0] : '';
  const levelRaw = cells ? (cells['minimum level'] || cells['recommended level'] || cells['level'] || '') : '';
  const kind = classify(page.title, page.content, epicTitles, heroicTitles);
  const rec = {
    name: page.title,
    giver: givers[0] || null,
    givers: givers.slice(0, 6),
    startZone: startZone || null,
    level: decode(levelRaw).replace(/^\|/, '').trim() || null,
    levelKind: cells && cells['minimum level'] ? 'min' : cells && cells['recommended level'] ? 'recommended' : null,
    classes: cells ? linkNames(cells['classes'] || '').concat(/\ball\b/i.test(cells['classes'] || '') ? ['All'] : []).slice(0, 16) : [],
    relatedZones: cells ? linkNames(cells['related zones'] || '').slice(0, 10) : [],
    rewards: parseRewards(page.content),
    kind,
  };
  if (!rec.classes.length && cells) {
    const plain = decode(cells['classes'] || '');
    if (plain && !/^\[\[/.test(plain)) rec.classes = plain.split(/[,;]/).map(decode).filter(Boolean).slice(0, 16);
  }
  if (cells) parsedTables++;
  quests[refName] = rec; // key by BOTH the referenced alias so item lookup is exact
}

const outDoc = {
  source: { name: 'EQLWiki quest pages', url: 'https://eqlwiki.com/', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Structured from questTopTable boxes and reward lists; not official Daybreak data.' },
  generatedAt: new Date().toISOString(),
  schema: { key: 'referenced quest name -> record', kind: 'epic|heroic|regular', giver: 'first listed quest-giver NPC', startZone: 'quest start zone', level: 'as written on the wiki', rewards: 'reward item names (wiki-asserted)' },
  stats: { referencedNames: names.length, withPage: Object.keys(quests).length, epic: Object.values(quests).filter((q) => q.kind === 'epic').length, heroic: Object.values(quests).filter((q) => q.kind === 'heroic').length, regular: Object.values(quests).filter((q) => q.kind === 'regular').length, withGiver: Object.values(quests).filter((q) => q.giver).length, parsedTables },
  quests,
};
writeFileSync(OUT, JSON.stringify(outDoc));
const kb = Math.round(outDoc.length || JSON.stringify(outDoc).length / 1024);
console.log(`Wrote ${outDoc.stats.withPage} quest records (${(JSON.stringify(outDoc).length / 1024 / 1024).toFixed(2)} MB) to ${OUT}`);
console.log(`  epic:${outDoc.stats.epic} heroic:${outDoc.stats.heroic} regular:${outDoc.stats.regular} withGiver:${outDoc.stats.withGiver} parsedTables:${outDoc.stats.parsedTables}`);
