import { accessSync, constants, readFileSync } from 'node:fs';

const requiredCommunityFiles = ['LICENSE', 'README.md', 'OPEN_SOURCE.md', 'CONTRIBUTING.md'];

const requiredAssets = [
  'public/eqlsak-races-mural-v2.png',
  'public/downloads/eqlsak-source-v52.zip',
  'public/art/map-antonica.png',
  'public/art/map-faydwer.png',
  'public/art/map-odus.png',
  ...['blackburrow', 'mistmoore', 'paw', 'befallen', 'najena', 'gukbottom'].flatMap((zone) => [
    `public/maps/${zone}.txt`,
    `public/models/${zone}.glb`,
  ]),
];
const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  dungeon: readFileSync('components/DungeonGuide.tsx', 'utf8'),
  map: readFileSync('components/DungeonMap.tsx', 'utf8'),
  dungeonData: readFileSync('data/dungeons.ts', 'utf8'),
  logs: readFileSync('components/LogReader.tsx', 'utf8'),
  logParser: readFileSync('lib/log-report.ts', 'utf8'),
  layout: readFileSync('app/layout.tsx', 'utf8'),
  shell: readFileSync('index.html', 'utf8'),
};
const failures = [];
const warnings = [];
const requireText = (name, text, pattern) => {
  if (!pattern.test(text)) failures.push(name);
};

for (const asset of requiredAssets) {
  try { accessSync(asset, constants.R_OK); } catch { failures.push(`Missing required asset: ${asset}`); }
}
for (const file of requiredCommunityFiles) {
  try { accessSync(file, constants.R_OK); } catch { failures.push(`Missing community source file: ${file}`); }
}
requireText('Route picker must expose an application-owned listbox', files.page, /role="listbox"/);
requireText('Route picker must expose both endpoints', files.page, /quick-route-from[\s\S]*quick-route-to/);
requireText('Global search must have an accessible label', files.page, /aria-label="Search EQL field records"/);
requireText('Log input must remain device-local', files.logParser, /file\.slice\(start, end\)\.arrayBuffer\(\)/);
if (/eqlog_Character_Server\.txt/.test(files.logs)) failures.push('Unsupported EQL log filename has returned');
requireText('Missing-log limitation must remain explicit', files.logs, /there is nothing for the[\s\S]*browser to import/);
requireText('Details must use the native dialog element', files.page, /<dialog[\s\S]*open/);
requireText('Public branding disclaimer is required', files.page, /not affiliated with, endorsed by, or sponsored by Daybreak/);
requireText('Privacy disclosure is required', files.page, /not uploaded by this version/);
requireText('Open-source disclosure is required', files.page, /application code is licensed under MIT/);
requireText('Production metadata title is required', files.shell, /EQL Swiss Army Knife/);
requireText('Dungeon dossiers must expose floor layers', files.map, /All mapped levels/);
requireText('Dungeon dossiers must expose evidence filtering', files.dungeon, /Show stronger EQL evidence only/);

const proxyCount = (files.dungeonData.match(/source: '.*proxy/gi) || []).length;
const legacyCount = (files.page.match(/source: 'Legacy EQ unverified'/g) || []).length;
if (proxyCount) warnings.push(`${proxyCount} proxy NPC coordinates remain visibly non-authoritative.`);
if (legacyCount) warnings.push(`${legacyCount} legacy field records remain visibly unverified.`);

if (failures.length) {
  console.error('RELEASE GATES FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('RELEASE GATES PASSED FOR PRIVATE PRE-RELEASE');
console.log(`Assets: ${requiredAssets.length}/${requiredAssets.length}`);
console.log('Core safeguards: routes, search, logs, dialogs, branding, privacy, metadata, dungeon dossiers');
warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));
console.log('Public release remains locked while warnings affect release-critical guidance.');
