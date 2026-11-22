import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const classes = [
  ['BRD', 'Bard', 'Bard Spells'],
  ['BST', 'Beastlord', 'Beastlord Spells'],
  ['CLR', 'Cleric', 'Cleric Spells'],
  ['DRU', 'Druid', 'Druid Spells'],
  ['ENC', 'Enchanter', 'Enchanter Spells'],
  ['MAG', 'Magician', 'Magician Spells'],
  ['NEC', 'Necromancer', 'Necromancer Spells'],
  ['PAL', 'Paladin', 'Paladin Spells'],
  ['RNG', 'Ranger', 'Ranger Spells'],
  ['SHD', 'Shadow Knight', 'Shadowknight Spells'],
  ['SHM', 'Shaman', 'Shaman Spells'],
  ['WIZ', 'Wizard', 'Wizard Spells'],
];

const entities = new Map([
  ['&mdash;', '—'], ['&ndash;', '–'], ['&nbsp;', ' '], ['&amp;', '&'],
  ['&quot;', '"'], ['&#39;', "'"], ['&lt;', '<'], ['&gt;', '>'],
]);

function clean(value = '') {
  return value
    .replace(/<!--.*?-->/gs, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:mdash|ndash|nbsp|amp|quot|#39|lt|gt);/g, (entity) => entities.get(entity) || entity)
    .replace(/''+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTables(wikitext, code) {
  const rows = [];
  let headers = [];
  let inTable = false;
  for (const line of wikitext.split(/\r?\n/)) {
    if (line.startsWith('{|')) { inTable = true; headers = []; continue; }
    if (!inTable) continue;
    if (line.startsWith('|}')) { inTable = false; headers = []; continue; }
    if (line.startsWith('!')) {
      headers = line.slice(1).split('!!').map(clean);
      continue;
    }
    if (!line.startsWith('| ') || !headers.length) continue;
    const values = line.slice(2).split('||').map(clean);
    if (values.length < 2) continue;
    const record = Object.fromEntries(headers.map((header, index) => [header.toLowerCase(), values[index] || '']));
    const name = record.spell || record.song || record.name || values[1];
    const level = Number.parseInt(record.lvl || record.level || '', 10);
    if (!name || !Number.isFinite(level)) continue;
    rows.push({
      id: record.id || '',
      name,
      level,
      mana: record.mana || '',
      cast: record.cast || '',
      resist: record.resist || '',
      target: record.target || '',
      damage: record.damage || '',
      duration: record.duration || '',
      effect: record.effect || record.description || record['song description'] || '',
      classCode: code,
    });
  }
  return rows;
}

async function readPage(title) {
  const params = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', format: 'json', formatversion: '2' });
  const response = await fetch(`https://eqlwiki.com/api.php?${params}`, {
    headers: { 'user-agent': 'EQLSaK/1.0 open-source community companion' },
  });
  if (!response.ok) throw new Error(`${title}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${title}: ${payload.error.info || payload.error.code}`);
  return payload.parse?.wikitext || '';
}

const spells = [];
for (const [code, className, pageTitle] of classes) {
  const parsed = parseTables(await readPage(pageTitle), code);
  if (!parsed.length) throw new Error(`${pageTitle}: no spell rows were found`);
  spells.push(...parsed);
  console.log(`${className}: ${parsed.length}`);
}

spells.sort((a, b) => a.classCode.localeCompare(b.classCode) || a.level - b.level || a.name.localeCompare(b.name));
const output = resolve('data/eqlwiki-spells.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: 'EverQuest Legends Wiki',
    url: 'https://eqlwiki.com/Category:Spells',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  classes: classes.map(([code, name, page]) => ({ code, name, page })),
  spells,
}, null, 2)}\n`);
console.log(`Wrote ${spells.length} class spell records to ${output}`);
