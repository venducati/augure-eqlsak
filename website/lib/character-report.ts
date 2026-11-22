export type ImportedRow = { id: number; fields: string[]; raw: string };

export function splitReportRow(line: string) {
  const delimiter = line.includes('\t') ? '\t' : line.includes('|') ? '|' : line.includes('^') ? '^' : ',';
  const fields: string[] = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { fields.push(field.trim()); field = ''; }
    else field += char;
  }
  fields.push(field.trim());
  return fields;
}

export function parseCharacterReport(text: string): ImportedRow[] {
  if (text.length > 5_000_000) throw new Error('Choose a character report under 5 MB. Large client tables belong in the installation scanner.');
  const rows: ImportedRow[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    if (raw.includes('\0') || raw.length > 8192) throw new Error('This is not a readable character text report.');
    if (rows.length >= 25000) throw new Error('This report has more than 25,000 rows. Choose a single character export.');
    rows.push({ id: rows.length, raw, fields: splitReportRow(raw) });
  }
  return rows;
}

export function isFactionReport(name: string, rows: ImportedRow[]) {
  if (/(?:^|[-_])factions?\.txt$/i.test(name)) return true;
  const fields = rows[0]?.fields || [];
  return /^(faction\s*)?id$/i.test(fields[0] || '') && /name|faction/i.test(fields[1] || '') && /point|standing|value/i.test(fields[2] || '') && /max|remain/i.test(fields[3] || '');
}
