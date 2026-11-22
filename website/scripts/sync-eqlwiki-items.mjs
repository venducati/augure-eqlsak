// Sync the EQLWiki item catalog into data/eqlwiki-items.json.
// Enumerates Category:Items (direct members), fetches wikitext in batches of
// 50, parses {{Itempage}} templates into flat records, and reports join
// coverage against the measured loot feed (eqlsource-drops.json).
// Etiquette: declared user-agent, sequential batches, 250 ms pacing.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const API = 'https://eqlwiki.com/api.php';
const HEADERS = { 'user-agent': 'EQLSaK/1.0 open-source community companion' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 429) {
      await sleep(2000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${params.action}`);
    return res.json();
  }
  throw new Error(`Rate-limited beyond retries for ${params.action}`);
}

// ---------- 1. enumerate ----------
async function categoryTitles(category) {
  const titles = [];
  let cont = null;
  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'page',
      cmlimit: '500',
      format: 'json',
    };
    if (cont) params.cmcontinue = cont;
    const j = await api(params);
    for (const m of j.query.categorymembers) if (m.ns === 0) titles.push(m.title);
    cont = j.continue?.cmcontinue || null;
    process.stdout.write(`\r${category}: ${titles.length} members`);
  } while (cont);
  console.log('');
  return [...new Set(titles)];
}

// ---------- 2. fetch wikitext in batches ----------
async function fetchContents(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      format: 'json',
      redirects: '1',
      titles: batch.join('|'),
    });
    for (const p of Object.values(j.query.pages)) {
      const content = p?.revisions?.[0]?.slots?.main?.['*'];
      if (content && content.length < 200000) out.set(p.title, content);
    }
    process.stdout.write(`\rfetched ${Math.min(i + 50, titles.length)}/${titles.length}`);
    if ((i / 50) % 10 === 9) await sleep(400);
    else await sleep(250);
  }
  console.log('');
  return out;
}

// ---------- 3. parse ----------
const ENTITIES = new Map([
  ['&mdash;', '—'], ['&ndash;', '–'], ['&nbsp;', ' '], ['&amp;', '&'],
  ['&quot;', '"'], ['&#39;', "'"], ['&lt;', '<'], ['&gt;', '>'],
]);
const decode = (s) => s.replace(/&(?:mdash|ndash|nbsp|amp|quot|#39|lt|gt);/g, (m) => ENTITIES.get(m) || m);
const clean = (v = '') =>
  decode(String(v))
    .replace(/<!--.*?-->/gs, '')
    .replace(/\{\{[^{}]*\}\}/gi, '')
    .replace(/\[\[(?:Image|File):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Split an Itempage template body into named fields anchored on "|name ="
// line starts (tolerant of nested braces like {{Item Lore|X}}).
function itempageFields(wikitext) {
  const start = wikitext.match(/\{\{\s*Itempage/i);
  if (!start || start.index === undefined) return null;
  const body = wikitext.slice(start.index + start[0].length);
  // End at the closing of onlyinclude (usual) or 8k chars.
  const end = body.search(/\}\}\s*<\/onlyinclude>|\}<\}|<\/onlyinclude>/i);
  const region = (end > 0 ? body.slice(0, end) : body.slice(0, 8000));
  const anchors = [];
  const re = /\n\|\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
  let m;
  while ((m = re.exec(region))) anchors.push({ name: m[1], at: m.index, valAt: m.index + m[0].length });
  if (!anchors.length) return null;
  const fields = {};
  for (let i = 0; i < anchors.length; i++) {
    const stop = i + 1 < anchors.length ? anchors[i + 1].at : region.length;
    fields[anchors[i].name.toLowerCase()] = region.slice(anchors[i].valAt, stop);
  }
  return fields;
}

function parseStats(statsRaw) {
  const s = String(statsRaw || '').replace(/<br\s*\/?>/gi, '\n');
  const rec = {};
  const grab = (re, key) => {
    const m = s.match(re);
    if (m) rec[key] = m[1];
  };
  grab(/Slot:\s*([A-Z0-9 ]+)/i, 'slotRaw');
  grab(/Skill:\s*(.+?)\s+(?:Atk\s+)?Delay:/i, 'skill');
  grab(/(?:Atk\s+)?Delay:\s*(\d+)/i, 'delay');
  grab(/DMG:\s*(\d+)/i, 'dmg');
  grab(/\bAC:\s*(\d+)/i, 'ac');
  grab(/\bHDR:\s*(\d+)/i, 'hdr');
  grab(/\bDS:\s*(\d+)/i, 'ds');
  grab(/\bRange:\s*(\d+)/i, 'range');
  grab(/\bLight:\s*(\d+)/i, 'light');
  grab(/\bWT:\s*([\d.]+)/i, 'wt');
  grab(/Size:\s*([A-Z]+)/i, 'size');
  grab(/\bHP:\s*([+-]\d+)/i, 'hp');
  grab(/\bMANA:\s*([+-]\d+)/i, 'mana');
  grab(/^Class:\s*(.+)$/im, 'classRaw');
  grab(/^Race:\s*(.+)$/im, 'race');
  const stats = {};
  for (const m of s.matchAll(/\b(STR|STA|AGI|DEX|WIS|INT|CHA|HASTE|MEND|HYSTER|SPELLDMG):\s*([+-]\d+)/gi)) {
    stats[m[1].toUpperCase()] = Number.parseInt(m[2], 10);
  }
  // Item resist shorthand: "SV MAGIC/CRUSH/DIVINE" plus the abbreviated forms.
  for (const m of s.matchAll(/\b(?:SV\s+(MAGIC|CRUSH|DIVINE)|(MSV|CSV|DSV|SR|MR|CR|DR|TR|PR)):\s*([+-]?\d+)/gi)) {
    const kind = (m[1] || m[2]).toUpperCase();
    const map = { MAGIC: 'MSV', MSV: 'MSV', CRUSH: 'CSV', CSV: 'CSV', DIVINE: 'DSV', DSV: 'DSV' };
    stats[map[kind] || kind] = Number.parseInt(m[3], 10);
  }
  if (Object.keys(stats).length) rec.stats = stats;
  const cast = s.match(/Cast:\s*(.+)/i) || s.match(/Effect:\s*(.+)/i);
  if (cast) rec.clicky = clean(cast[1]);
  const flagsLine = s.split('\n').find((l) => l.trim()) || '';
  const flags = [];
  if (/attunable/i.test(s)) flags.push('Attunable');
  if (/\bLORE\b/i.test(flagsLine) || /LORE (?:ITEM|NO DROP)/i.test(s)) flags.push('Lore');
  if (/QUEST ITEM|QUEST FLAG/i.test(s)) flags.push('Quest');
  if (/NO[- ]?RENT/i.test(s)) flags.push('NoRent');
  if (/NO ?DROP/i.test(s)) flags.push('NoDrop');
  if (/SUMMONED/i.test(s)) flags.push('Summoned');
  if (/Faded|Pleaded/i.test(s)) flags.push('Faded');
  if (/\bQty\b|\bstackable\b/i.test(s)) flags.push('Stackable');
  if (flags.length) rec.flags = flags;
  return rec;
}

function parseDrops(raw) {
  const out = [];
  let current = null;
  for (const line of String(raw || '').split(/\r?\n/)) {
    const zone = line.match(/^\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/);
    if (zone) {
      current = { zone: clean(zone[1]), mobs: [] };
      out.push(current);
      continue;
    }
    const mob = line.match(/^\s*[*:]\s*\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/);
    if (mob && current) current.mobs.push(clean(mob[2] || mob[1]));
  }
  return out.filter((d) => d.mobs.length);
}

function parseQuests(raw) {
  const out = [];
  for (const m of String(raw || '').matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    out.push(clean(m[2] || m[1]));
  }
  return out;
}

function parseItem(title, wikitext) {
  const fields = itempageFields(wikitext);
  if (!fields) return null;
  const name = clean(fields.itemname || title);
  if (!name) return null;
  const rec = { name, ...parseStats(fields.statsblock) };
  if (fields.merchant_value) rec.price = clean(fields.merchant_value);
  const notes = clean(fields.notes || '');
  if (notes && notes.length <= 480) rec.notes = notes;
  if (fields.focus_effect) rec.focus = clean(fields.focus_effect);
  const drops = parseDrops(fields.dropsfrom);
  if (drops.length) rec.drops = drops;
  const quests = parseQuests(fields.relatedquests);
  if (quests.length) rec.quests = quests;
  const cats = [...wikitext.matchAll(/^\[\[Category:([^\]|]+)\]\]/gm)].map((m) => clean(m[1]));
  const useful = cats.filter((c) => /Equipment$/.test(c) || /^(Primary|Secondary|Secondary[^O]|Range|Ammo|Combat Abilities|1H|2H|Two-Handed|Throwing|Bowing|Class\d|Common|Uncommon|Rare|Epic|Legendary)/.test(c)).slice(0, 24);
  if (useful.length) rec.tags = useful;
  if (rec.slotRaw) rec.slots = rec.slotRaw.trim().split(/\s+/);
  if (rec.classRaw) {
    rec.allClasses = /^ALL$/i.test(rec.classRaw.trim());
    if (!rec.allClasses) rec.classes = rec.classRaw.trim().toUpperCase().split(/\s+/).slice(0, 16);
  }
  // drop raw intermediates
  delete rec.slotRaw;
  delete rec.classRaw;
  return rec;
}

// ---------- 4. run ----------
const titles = await categoryTitles('Category:Items');
console.log(`Category:Items direct members: ${titles.length}`);
const contents = await fetchContents(titles);
console.log(`pages with content: ${contents.size}`);

const items = {};
let skippedNonItem = 0;
for (const [title, text] of contents) {
  if (!/\{\{\s*Itempage/i.test(text)) {
    skippedNonItem++;
    continue;
  }
  const rec = parseItem(title, text);
  if (rec) items[rec.name] = rec;
}
console.log(`parsed Itempage records: ${Object.keys(items).length} (non-Itempage pages skipped: ${skippedNonItem})`);

// join coverage against measured feed
const snapshotPath = resolve('data/eqlsource-drops.json');
const measured = Object.keys(JSON.parse(readFileSync(snapshotPath, 'utf8')).data.items);
const normKey = (n) => n.toLowerCase().replace(/[`´′']/g, "'").replace(/\s*\+\d+$/, '').replace(/\s+/g, ' ').trim();
const catNorm = new Map(Object.keys(items).map((k) => [normKey(k), k]));
let joined = 0;
for (const m of measured) if (catNorm.has(normKey(m))) joined++;
console.log(`measured-feed join coverage: ${joined}/${measured.length} (${Math.round((joined / measured.length) * 100)}%)`);

const output = resolve('data/eqlwiki-items.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: 'EverQuest Legends Wiki',
    url: 'https://eqlwiki.com/Category:Items',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  joinReport: { measuredFeedItems: measured.length, joinedByNormalizedName: joined },
  items,
}, null, 1)}\n`);
console.log(`Wrote ${Object.keys(items).length} item records to ${output}`);
