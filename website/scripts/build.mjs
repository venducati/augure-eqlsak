import { accessSync, constants, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {spawnSync} from 'node:child_process';
import { writeSpellIconManifest } from './spell-icon-manifest.mjs';

// Compile current sources before packaging; stale prebuilt bundles must never pass as an updated release.
// Static SPA build: everything lands in dist/client, hostable on any web server.
const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
if(built.error)throw built.error;
if(built.status!==0)process.exit(built.status||1);
accessSync('dist/client/index.html', constants.R_OK);
const assetDirs=readdirSync(join('dist/client','assets'));
if(!assetDirs.some((n)=>/\.js$/.test(n)))throw new Error('dist/client/assets contains no JavaScript bundle');
cpSync('public', 'dist/client', { recursive: true, force: true });
// Ship the item catalog as a runtime-fetched asset (multi-MB; must not enter
// the JS bundle). Keep this path in sync with CATALOG_URL in LootFacets.
if(existsSync('data/eqlwiki-items.json')){mkdirSync('dist/client/data',{recursive:true});cpSync('data/eqlwiki-items.json','dist/client/data/eqlwiki-items.json');}
writeSpellIconManifest('dist/client');
// SPA fallback is handled by public/_redirects ("/* /index.html 200") at the
// host. Do NOT copy index.html to 404.html here: on Cloudflare Pages a static
// 404.html takes precedence over _redirects and shadows the wildcard rule,
// breaking deep links (verified live 2026-11-22).
console.log('Compiled current EQLSaK sources into dist/client (standalone static site).');
