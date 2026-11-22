import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeSpellIconManifest(output) {
  const folder = join(output, 'spell-icons');
  const files = existsSync(folder) ? readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && /^[a-z0-9-]+\.(png|webp)$/i.test(entry.name)).map((entry) => entry.name).sort() : [];
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.json'), JSON.stringify(files));
  return files.length;
}
