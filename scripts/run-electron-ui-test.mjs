// Cross-platform runner for the Electron UI test tiers. cmd.exe cannot
// launch slash-path binaries, so npm scripts delegate the spawn to Node.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(resolve(root, 'desktop/package.json'));
const electronBin = require('electron');

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/run-electron-ui-test.mjs <script.cjs>');
  process.exit(2);
}
const result = spawnSync(String(electronBin), [resolve(root, 'scripts', target)], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
