import type { ImportedRow } from './character-report.ts';

const normalized = (field: string) => field.toLowerCase().replace(/[^a-z]/g, '');
export function spellColumns(rows: ImportedRow[]) {
  const fields = rows[0]?.fields.map(normalized) || [];
  const name = fields.findIndex((field) => ['spell', 'spellname', 'name'].includes(field));
  return name < 0 ? null : {
    headerId: rows[0].id, name,
    level: fields.findIndex((field) => ['level', 'spelllevel', 'requiredlevel'].includes(field)),
    id: fields.findIndex((field) => ['id', 'spellid'].includes(field)),
  };
}
export function spellFields(row: ImportedRow, columns: ReturnType<typeof spellColumns>, classNames: string[]) {
  if (columns && row.id === columns.headerId) return null;
  const names = new Set(classNames.map((name) => name.toLowerCase()));
  const name = columns ? row.fields[columns.name] : row.fields.filter((field) => field && !/^[-+]?\d+(?:\.\d+)?$/.test(field) && !names.has(field.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  if (!name) return null;
  const levelText = columns && columns.level >= 0 ? row.fields[columns.level] : row.raw.match(/\blevel\s*[:=]?\s*(\d+)\b/i)?.[1];
  const level = levelText && /^\d+$/.test(levelText) && Number(levelText) >= 1 && Number(levelText) <= 125 ? Number(levelText) : undefined;
  const id = columns && columns.id >= 0 && /^\d+$/.test(row.fields[columns.id] || '') ? row.fields[columns.id] : undefined;
  return { name, level, id };
}
