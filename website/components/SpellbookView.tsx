'use client';

import { useEffect, useMemo, useState } from 'react';
import { spellColumns, spellFields } from '../lib/spell-report';

type ImportedRow = { id: number; fields: string[]; raw: string };

const classInfo: Record<string, { name: string; icon: string }> = {
  WAR:{name:'Warrior',icon:'🛡️'}, CLR:{name:'Cleric',icon:'✨'}, PAL:{name:'Paladin',icon:'⚜️'}, RNG:{name:'Ranger',icon:'🏹'},
  SHD:{name:'Shadow Knight',icon:'🌑'}, DRU:{name:'Druid',icon:'🌿'}, MNK:{name:'Monk',icon:'🥋'}, BRD:{name:'Bard',icon:'🎵'},
  ROG:{name:'Rogue',icon:'🗡️'}, SHM:{name:'Shaman',icon:'🌩️'}, NEC:{name:'Necromancer',icon:'💀'}, WIZ:{name:'Wizard',icon:'🔥'},
  MAG:{name:'Magician',icon:'🪄'}, ENC:{name:'Enchanter',icon:'🔮'}, BST:{name:'Beastlord',icon:'🐾'}, BER:{name:'Berserker',icon:'🪓'},
};

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function fileClass(sourceName: string) {
  const match = sourceName.toUpperCase().match(/(?:^|[-_])(WAR|CLR|PAL|RNG|SHD|DRU|MNK|BRD|ROG|SHM|NEC|WIZ|MAG|ENC|BST|BER)(?:[-_.]|$)/);
  return match?.[1] || '';
}
function rowClass(row: ImportedRow, fallback: string) {
  for (const field of row.fields) {
    const code = field.trim().toUpperCase();
    if (classInfo[code]) return code;
    const found = Object.entries(classInfo).find(([, info]) => info.name.toUpperCase() === code);
    if (found) return found[0];
  }
  return fallback || 'OTHER';
}
let manifest: Promise<string[]> | undefined;
function spellImages() {
  return manifest ??= fetch('/spell-icons/index.json').then((response) => response.ok ? response.json() : []).then((files: unknown) => Array.isArray(files) ? files.filter((file): file is string => typeof file === 'string' && /^[a-z0-9-]+\.(png|webp)$/i.test(file)) : []).catch(() => []);
}
function SpellIcon({ name, id, fallback, available }: { name: string; id?: string; fallback: string; available: Set<string> }) {
  const candidate = [`${slug(name)}.webp`, `${slug(name)}.png`, ...(id ? [`${id}.webp`, `${id}.png`] : [])].find((file) => available.has(file));
  const [failed, setFailed] = useState(false);
  if (!candidate || failed) return <span className="spellfallback" aria-label="Class symbol; no matching spell image available">{fallback}</span>;
  // oxlint-disable-next-line next/no-img-element -- standalone build has no next/image; icons are small local files with lazy loading
  return <img src={`/spell-icons/${candidate}`} width={46} height={46} alt={`${name} spell icon`} loading="lazy" onError={() => setFailed(true)} />;
}

export default function SpellbookView({ rows, headerRows = rows, sourceName }: { rows: ImportedRow[]; headerRows?: ImportedRow[]; sourceName: string }) {
  const fallbackClass = fileClass(sourceName);
  const [available, setAvailable] = useState<Set<string>>(() => new Set());
  useEffect(() => { let active = true; void spellImages().then((files) => { if (active) setAvailable(new Set(files)); }); return () => { active = false; }; }, []);
  const columns = useMemo(() => spellColumns(headerRows), [headerRows]);
  const groups = useMemo(() => {
    const result = new Map<string, Array<{ row: ImportedRow; name: string; level?: number; id?: string }>>();
    rows.forEach((row) => {
      const fields = spellFields(row, columns, [...Object.keys(classInfo), ...Object.values(classInfo).map((info) => info.name)]);
      if (!fields) return;
      const code = rowClass(row, fallbackClass);
      const group = result.get(code) || [];
      group.push({ row, ...fields });
      result.set(code, group);
    });
    return [...result.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [rows, fallbackClass, columns]);

  if (!/spellbook|missingspells/i.test(sourceName)) return null;
  return <section className="spellbookview" aria-labelledby="spellbook-title">
    <header><div><small>CLASS-SORTED SPELLBOOK · LOCAL REPORT</small><h3 id="spellbook-title">Spellbook by class</h3><p>The class code in the report name—such as <b>RNG</b>—is used when individual rows do not contain a class.</p></div><span>{groups.reduce((count, [, spells]) => count + spells.length, 0).toLocaleString()} spells on this report page</span></header>
    <div className="spellgroups">{groups.map(([code, spells]) => {
      const info = classInfo[code] || { name:'Unclassified', icon:'📖' };
      return <article key={code}><header><i aria-hidden="true">{info.icon}</i><div><h4>{info.name}</h4><small>{code === 'OTHER' ? 'Class not present in report' : code} · {spells.length} spells</small></div></header><div className="spellgrid">{spells.map(({ row, name, level, id }) => <div className="spellcard" key={row.id}><SpellIcon key={`${name}-${id || ""}`} name={name} id={id} fallback={info.icon} available={available} /><div><b>{name}</b><span>{level ? `Level ${level}` : 'Level not identified'}</span></div><details><summary>Report fields</summary><p>{row.fields.join(' · ')}</p></details></div>)}</div></article>;
    })}</div>
    <footer><b>Icon matching:</b> EQLSaK uses the available PNG and WebP images in <code>/spell-icons/</code> by spell name or numeric ID. When no licensed local image exists, the class symbol appears instead—never a broken image.</footer>
  </section>;
}
