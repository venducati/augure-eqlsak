import { accessSync, constants, cpSync, existsSync, readdirSync } from 'node:fs';
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
writeSpellIconManifest('dist/client');
// SPA hosts should serve index.html for unknown paths; copy it so the site works
// on hosts without rewrite rules configured too.
if(existsSync('dist/client/index.html'))cpSync('dist/client/index.html','dist/client/404.html');
console.log('Compiled current EQLSaK sources into dist/client (standalone static site).');
