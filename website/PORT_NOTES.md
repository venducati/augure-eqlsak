# EQLSaK companion website — Augure port notes

This tree is the former **ChatGPT Sites edition** of EQLSaK (`sites-project`,
published once at `numbuh-one-eql-companion.cipherlox.chatgpt.site`). Its
source of record is the git clone at
`C:\Users\jessjames\Documents\Codex\2026-08-29\...\work\eql-companion-publish-v119`
(122 commits, newest 2026-10-04, `Add animated Atlas sea routes`). It was
ported here on 2026-11-21 so the site can be built and hosted anywhere, with
no OpenAI or Cloudflare account involved.

## What was converted

| Before (hosted) | After (standalone) |
| --- | --- |
| `vinext` + `@vitejs/plugin-rsc` + `react-server-dom-webpack` (React Server Components pipeline) | Plain `@vitejs/plugin-react` SPA build; `app/page.tsx` was already `'use client'` |
| `@openai/sites-vite-plugin`, `.openai/hosting.json` (project id lock) | Removed; `index.html` + `main.tsx` bootstrap the app directly |
| `@cloudflare/vite-plugin` + `wrangler` + workers-types + d1/r2 bindings (all null anyway) | Removed; `npm run build` → `dist/client` static folder |
| `next/font/google` (Geist) + `next` `Metadata`/`Viewport` exports in `app/layout.tsx` | Same tags hand-written in `index.html`; `--font-geist-*` CSS vars fall back to Arial/Lucida Console in `app/layout.tsx` |
| `next/image` in `components/SpellbookView.tsx` (used with `unoptimized`) | Native lazy `<img>` with the same width/height/alt/onError behaviour |
| Hard-coded companion origin in `lib/zone-navigation.ts` | Same config as the desktop advisor: `data/companion-site.json` (empty = zone-guide links hide themselves) |
| Deep links `/?zone=X#zone-guide` | Still work; `main.tsx` also rewrites `/zone/<Slug>` guide URLs back to the `?zone=` form so static-guide and app links converge |
| `scripts/build.mjs` checking `dist/server/index.js` | Checks `dist/client/index.html` + bundled JS; writes `404.html` for hosts without rewrite rules |
| release gate checking title in layout | Checks `index.html` |

## Folded in from the 2026-09-10 branch

The 09-10 copy (`Documents\Codex\2026-09-10\...\work\eql-companion`) carried
log-finder/encounter-journal pages the v119 tree never had. Their newest
evolution already lives in this repo's desktop advisor, so the website takes
those same **root-fork versions** (supersets of the 09-10 originals — 09-10's
copies are byte-identical to the fork's for the shared libraries):

- `components/LogFinder.tsx`, `EncounterJournal.tsx`, `CombatDashboard.tsx`,
  `LogSetupHelp.tsx` — mounted inside `components/CombatMeter.tsx` (same
  integration the desktop app uses; LogReader stays the quick text importer)
- `lib/log-discovery.ts`, `encounter-journal.ts`, `combat-visuals.ts`,
  `advisor-audio.ts`, `log-history.ts`, `combat-overlay.ts`
- `data/trip-strategy.json`, `data/interface-sounds.json`,
  `data/companion-site.json`
- `app/log-finder.css`, `encounter-journal.css`, `combat-dashboard.css`,
  `live-combat-meter.css` (rebuilt version), `combat-overlay-controls.css`
- root's `lib/combat-meter.ts` parser (adds `(Critical)` tag stripping,
  shoot/smash melee verbs, a `critical` flag and `isDamage`/`isSelf`;
  oversized amounts now degrade to a visible `unknown` event — the website
  regression test was updated to that contract)

The website's Combat Meter receives the live profile advisor input/pack
(`advisorInput`/`advisorPack` props), so the trip journal's pulls and loot
advice match the Build Advisor state, same as in the desktop app.

## Commands

```bash
npm install        # in this folder (or: npm run website:build from repo root)
npm run dev        # vite dev server on :5175
npm test           # 12 suites (advisor, wording, combat meter, factions,
                   # party, zone-navigation, render, regressions, answer,
                   # pwa, crafting, spellbook) — 87 tests, 0 failures
npm run typecheck && npm run lint
npm run build      # → dist/client (static; copy anywhere)
npm run release:check
```

## Honest caveats

- This website tree predates the desktop fork's 1.6–1.8 map/travel features
  (LocalMapContext, map folders, wireframe, travel planner). Those remain
  desktop-side; the website shows the `?zone=` app guide instead.
- Desktop-only affordances detect and label themselves: log auto-detection
  and the game overlay show "Windows app feature" text in the browser, as
  designed upstream.
- `data/` provenance labels (User-Verified EQL / EQL-specific source /
  Legacy EQ unverified) are unchanged; release-gates warnings about proxy
  coordinates and legacy records are pre-existing and intentional.
- The service worker (`public/sw.js`) caches app shell for offline PWA use;
  when re-hosting under a new origin nothing needs changing, but bump the
  cache version in `sw.js` if replacing a previous deployment there.
