#!/usr/bin/env node
// Builds the EQLSaK companion site into site/dist: a landing page plus one
// static zone guide per catalog entry, generated from the project's reviewed
// data files. Pure static output — deployable on GitHub Pages, Netlify,
// Cloudflare Pages (without wrangler-specific config), or any web host.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(here, 'dist');

const catalog = JSON.parse(readFileSync(resolve(root, 'data/zone-catalog.json'), 'utf8'));
const factionData = JSON.parse(readFileSync(resolve(root, 'data/zone-factions.json'), 'utf8'));

const slugify = (text) =>
  text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const factionById = new Map(factionData.factions.map((f) => [f.id, f]));
const zoneFactions = new Map();
for (const entry of factionData.zones)
  for (const name of entry.names) zoneFactions.set(name, entry);

const page = ({ title, body, path }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · EQLSaK Zone Guides</title>
<link rel="stylesheet" href="${path ?? '.'}/style.css">
</head>
<body>
<header><a class="brand" href="${path ?? '.'}/index.html">EQLSaK <small>Zone Guides</small></a>
<nav><a href="${path ?? '.'}/index.html">All zones</a></nav></header>
<main>${body}</main>
<footer>
<p>Community reference compiled from the EQLSaK project's reviewed data files. EQL-sourced entries cite the EQL Wiki; none are independent in-game verification. Positive faction points do not guarantee friendly NPCs — confirm one kill or turn-in before repeating a plan.</p>
<p>EQLSaK is an independent fan project, not affiliated with Daybreak Game Company or EverQuest Legends.</p>
</footer>
</body></html>`;

rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'zone'), { recursive: true });

const zones = [...catalog.zones].sort((a, b) => a.name.localeCompare(b.name));

// Landing page
const continents = new Map();
for (const z of zones) {
  if (!continents.has(z.continent)) continents.set(z.continent, []);
  continents.get(z.continent).push(z);
}
const landing = [...continents.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(
    ([continent, list]) => `<section><h2>${esc(continent)}</h2><ul class="zone-list">${list
      .map((z) => `<li><a href="./zone/${slugify(z.name)}.html">${esc(z.name)}</a></li>`)
      .join('')}</ul></section>`,
  )
  .join('\n');
writeFileSync(
  resolve(out, 'index.html'),
  page({
    title: 'All zones',
    body: `<h1>EverQuest Legends zone guides</h1>
<p>${zones.length} planning locations from the EQLSaK zone catalog (${esc(catalog.reviewedOn)} review).</p>
${landing}`,
  }),
);

// One page per zone
for (const z of zones) {
  const entry = zoneFactions.get(z.name);
  const factions = (entry?.factions || [])
    .map((id) => factionById.get(id))
    .filter(Boolean);
  const aliasLine = z.aliases.length ? `<p>Also known as: ${z.aliases.map(esc).join(', ')}.</p>` : '';
  const factionBlock = factions.length
    ? `<section><h2>Factions recorded for this zone</h2><ul>${factions
        .map(
          (f) =>
            `<li><strong>${esc(f.name)}</strong>${
              f.sources?.length
                ? ` — <a href="${esc(f.sources[0])}" rel="noopener noreferrer" target="_blank">source</a>`
                : ''
            }</li>`,
        )
        .join('')}</ul>${
        entry?.note ? `<p class="note">${esc(entry.note)}</p>` : ''
      }</section>`
    : `<section><h2>Factions</h2><p class="note">No faction record has been reviewed for this zone yet. Check one kill in game before planning around it.</p></section>`;
  writeFileSync(
    resolve(out, 'zone', `${slugify(z.name)}.html`),
    page({
      title: z.name,
      path: '..',
      body: `<h1>${esc(z.name)}</h1>
<p><strong>Continent:</strong> ${esc(z.continent)} · <strong>Availability:</strong> ${esc(z.availability)}</p>
${aliasLine}
${factionBlock}
<section><h2>Sources</h2><ul>${(z.sources || [])
      .map((s) => {
        const src = catalog.sources.find((c) => c.id === s);
        return src ? `<li><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.id)}</a></li>` : `<li>${esc(s)}</li>`;
      })
      .join('')}</ul></section>
<p><a href="../index.html">← All zones</a></p>`,
    }),
  );
}

writeFileSync(
  resolve(out, 'style.css'),
  `:root{color-scheme:dark;background:#10181b;color:#ede8da;font:16px/1.65 system-ui,sans-serif}
a{color:#8fd3ba}header{display:flex;justify-content:space-between;align-items:center;padding:18px clamp(16px,4vw,40px);border-bottom:1px solid #2c3a3b}
.brand{font-weight:700;font-size:20px;color:#ffe0a1;text-decoration:none}.brand small{font-weight:400;color:#b8c4bd}
main{max-width:880px;margin:0 auto;padding:28px clamp(16px,4vw,40px) 56px}footer{max-width:880px;margin:0 auto;padding:22px clamp(16px,4vw,40px);border-top:1px solid #2c3a3b;color:#a7b1ab;font-size:13px}
h1{font-size:30px;color:#ffe0a1}h2{font-size:20px;color:#d9e6dd;margin-top:30px}.zone-list{columns:2;column-gap:34px;padding-left:18px}@media(max-width:640px){.zone-list{columns:1}}
.note{background:#1a262a;border-left:3px solid #8fd3ba;padding:10px 14px;border-radius:0 8px 8px 0}
`,
);

console.log(`site/dist written: 1 landing page + ${zones.length} zone guides + stylesheet (static, any host).`);
