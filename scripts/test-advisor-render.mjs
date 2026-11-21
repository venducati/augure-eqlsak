import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultInput, defaultRules } from '../lib/build-advisor.ts';

// Compile these UI modules for server rendering; no browser or network is used.
const root = resolve('work/advisor-render-test');
for (const file of [
  'components/PartyAdvisor.tsx',
  'components/AdvisorIcon.tsx',
  'components/ZoneGuideLink.tsx',
  'components/LocalMapContext.tsx',
  'lib/zone-navigation.ts',
  'lib/zone-catalog.ts',
  'lib/party-advisor.ts',
  'lib/build-advisor.ts',
]) {
  let code = readFileSync(file, 'utf8').replace(
    /^import ['"].*\.css['"];?$/gm,
    '',
  );
  code = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  code = code.replace(
    /from (['"])(\.\.?\/[^'"]+)\1/g,
    (_all, quote, path) =>
      `from ${quote}${path.endsWith('.json') ? path : path.replace(/\.(ts|tsx)$/, '') + '.js'}${quote}`,
  );
  const target = resolve(root, file.replace(/\.(ts|tsx)$/, '.js'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, code);
}
for (const file of [
  'build-advisor.json',
  'build-evidence.json',
  'party-advisor.json',
  'zone-catalog.json',
  'companion-site.json',
]) {
  mkdirSync(resolve(root, 'data'), { recursive: true });
  copyFileSync(resolve('data', file), resolve(root, 'data', file));
}
const { PartyZoneChart, PartyEditor } = await import(
  pathToFileURL(resolve(root, 'components/PartyAdvisor.js'))
);
const { default: ZoneGuideLink } = await import(
  pathToFileURL(resolve(root, 'components/ZoneGuideLink.js'))
);
const input = {
  ...defaultInput,
  tertiary: 'BRD',
  mode: 'group',
  buddy: ['MNK', 'CLR', 'ENC'],
  party: [
    ['WAR', 'CLR', 'ENC'],
    ['DRU', 'SHM', 'MAG'],
  ],
};
test('zone cards render four real trios and ten accessible coverage bars', () => {
  const html = renderToStaticMarkup(
    createElement(PartyZoneChart, {
      input,
      pack: defaultRules,
      zone: defaultRules.zones[0],
    }),
  );
  assert.equal((html.match(/class="ba-party-player /g) || []).length, 4);
  assert.equal((html.match(/role="meter"/g) || []).length, 10);
  assert(html.includes('4 of 4 players entered'));
  assert(html.includes('Zone target'));
  assert(html.includes('heuristic/inference'));
  assert(html.includes('Lowest coverage'));
});
test('party editor exposes all nine teammate class selectors and four player counts', () => {
  const html = renderToStaticMarkup(
    createElement(PartyEditor, {
      input,
      pack: defaultRules,
      onChange: () => {},
    }),
  );
  for (let player = 2; player <= 4; player++)
    for (let slot = 1; slot <= 3; slot++)
      assert(html.includes(`aria-label="Player ${player} class ${slot}"`));
  assert(html.includes('4 players'));
});
test('zone guide link hides when no companion origin is configured; encodes path URL when one is set', async () => {
  // Shipped config ships an empty origin: the standalone link must not render.
  const off = renderToStaticMarkup(
    createElement(ZoneGuideLink, { zone: 'Castle Mistmoore' }),
  );
  assert(!off.includes('href='));
  // Stage a sibling copy whose data/companion-site.json has an origin.
  // Separate module URLs dodge the JSON module cache.
  const confRoot = resolve('work/advisor-render-test-origin');
  mkdirSync(resolve(confRoot, 'lib'), { recursive: true });
  mkdirSync(resolve(confRoot, 'data'), { recursive: true });
  copyFileSync(
    resolve(root, 'lib/zone-navigation.js'),
    resolve(confRoot, 'lib/zone-navigation.js'),
  );
  copyFileSync(
    resolve(root, 'lib/zone-catalog.js'),
    resolve(confRoot, 'lib/zone-catalog.js'),
  );
  copyFileSync(
    resolve(root, 'data/zone-catalog.json'),
    resolve(confRoot, 'data/zone-catalog.json'),
  );
  writeFileSync(
    resolve(confRoot, 'data/companion-site.json'),
    JSON.stringify({ origin: 'https://guides.example.org/eqlsak' }),
  );
  const nav2 = await import(
    pathToFileURL(resolve(confRoot, 'lib/zone-navigation.js')).href
  );
  assert.equal(
    nav2.zoneGuideURL('Castle Mistmoore'),
    'https://guides.example.org/eqlsak/zone/castle-mistmoore',
  );
  const button = renderToStaticMarkup(
    createElement(ZoneGuideLink, {
      zone: 'Castle Mistmoore',
      onZone: () => {},
    }),
  );
  assert(button.startsWith('<button'));
  assert(!button.includes('href='));
});
