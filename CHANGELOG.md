# Changelog

## Unreleased — 2026-11-22 (quest detail)

- **Quest facet now carries its detail.** Items linked to a quest expand in the
  facet finder to show **quest giver, start zone, level (min or recommended),
  eligible classes, and the Epic / Heroic / Regular classification**, plus the
  wiki's reward list (reward names click through to the evidence search).
- New `scripts/sync-eqlwiki-quests.mjs` (`npm run sync:quests`, ≈1 min):
  resolves all 1,578 quest names the item catalog references against
  eqlwiki.com, fetches the 948 quest pages that exist, parses each
  `questTopTable` and reward section, and classifies epics via
  `Category:Epic Quests Era` / `{{Epics Era}}` markers →
  `data/eqlwiki-quests.json` (0.25 MB, CC BY-SA headed). 622 referenced names
  have no wiki page; those items keep a neutral "Quest?" badge instead of a
  fake classification.
- `lib/item-catalog.ts`: `readQuests()` + `attachQuests()` (epic-first sort),
  `epicOnly` gate in `filterCatalog` (fails closed without the sidecar), and
  text search extended across quest names/givers/zones/classes.
- `LootFacets` gained an "Epic/heroic only" chip (disabled until the quest map
  loads) and expandable quest cards; sidecar ships as `/data/eqlwiki-quests.json`.
- Tests: +4 (17 total in `test-item-catalog.mjs`); full suite, gates, and
  browser tour on the preview build all pass.

## Unreleased — 2026-11-22 (loot faceter)

- **Faceted item finder (Loot tab).** New `LootFacets` explorer: filter by class (falls back to ALL-class items), equipment slot, desired +stats (AND semantics), measured-drops-only, quest-connected, and a text filter across names/mobs/zones. Deterministic and offline — filters run entirely on shipped data; no query ever leaves the browser.
- **Full EQLWiki item catalog synced** (`npm run sync:items`, 11,439 {{Itempage}} records: slot, class lists, AC/DMG/+stats, flags, drop zones/mobs, quest links; CC BY-SA header, politeness-limited batch fetch). Join against the measured combat-log feed: **757/762** (99%) — the 5 gaps are enhancement/alt-name variants with no wiki page.
- The catalog ships as a runtime-fetched asset (`/data/eqlwiki-items.json`, 6.3 MB, copied by the build step) rather than entering the JS bundle; graceful states for loading and offline.
- New `lib/item-catalog.ts` (hardened loader, measured-overlay join, facet filter with evidence-first ranking) + 13 tests → website suite now **100 tests / 0 failures**; gates, typecheck, and build pass; verified live at eqlsak.pages.dev.
- Honest-limitation banner retained: the wiki asserts drops it never measured; measured sightings remain separately badged.

## Unreleased — 2026-11-22

- **CI deploy pipeline wired.** `.github/workflows/deploy-website.yml`: any push to `main` touching `website/` runs install → 87 tests → release gates → build, then deploys `website/dist/client` to Cloudflare Pages via `wrangler-action` with scoped account secrets. A red test or gate can no longer reach the live site; the last known-good deploy stays published. Proven end-to-end with three production deploys on 2026-11-22.
- **Build no longer emits `dist/client/404.html`.** The legacy copy of `index.html` to `404.html` shadowed the `_redirects` wildcard on Cloudflare Pages and 404'd every SPA deep link; `_redirects` (`/* /index.html 200`) is now the only fallback mechanism. Verified: `/`, `/zone/Castle-Mistaire`, `/combat-meter`, `/logs`, `/maps` all serve 200 on production.
- **`.gitattributes` added** forcing LF endings so the byte-exact release-gate regexes behave identically on Linux CI runners (CRLF carry-over from the Windows robocopy import would otherwise fail them there).
- **`website/` ported edition published publicly at `https://eqlsak.pages.dev`** with a work-in-progress banner (visible pre-JS via `<noscript>`) while development continues.

## 1.8.0 — 2026-11-21 (continued)

- **Companion website ported into the fork (`website/`).** The ChatGPT Sites edition (`sites-project`, canonical copy `eql-companion-publish-v119`, 122 commits upstream) is now a standalone Vite SPA: vinext/RSC, `@openai/sites-vite-plugin`, `.openai/hosting.json`, wrangler/Cloudflare bindings, `next/font` and `next/image` all removed; `npm run website:build` writes `website/dist/client` for any static host. Deep `/zone/<Slug>` guide URLs map to the app's `?zone=` view; zone-guide links follow the same empty-origin-hides-links rule as the desktop app.
- **Log finder + encounter journal folded in** from the 2026-09-10 branch using the desktop fork's newer versions of those modules (plus the current combat parser with `(Critical)` stripping and `isDamage`/`isSelf`); the website Combat Meter receives the live profile advisor input, same as the desktop app. 12 test suites (87 tests), typecheck, lint and `release:check` pass in `website/`; conversions and caveats documented in `website/PORT_NOTES.md`.

## 1.8.0 — 2026-11-21

- **Travel across Norrath.** A point-to-point world route planner lives inside **Maps & Routes**: choose From and To zones and BA lists every hop (walk, boat, dock translocator, druid/wizard port, planar portal) with minutes and an **Open map of …** button that loads each step's local map.
- Travel graph ships as `data/norrath-travel.json`: zone-to-zone links, the Qeynos⇄Erudin and Freeport⇄Butcherblock boat legs with measured durations, six dock translocator NPCs, druid rings and wizard gates, and three end-game planar orb crossings. EQL era only — Kunark and Velious are deliberately absent.
- Options mirror the EQLWiki travel guide: tick what the group can use (translocators / boats / one druid or wizard flex port / planar portals). Ports off and shortcuts unticked reproduces "the old way" (walking the Karanas).
- Safety and honesty rules: every edge is validated at load against the zone catalog and bundled EQL spell catalog (unvalidated edges never enter the planner), generic city names resolve to their hub zones, plane steps always carry a danger warning, and out-of-era or unknown zones simply produce no plan.
- Data provenance recorded in the file header (EQLWiki Travel Guide read 2026-11-21, Norrath Route Atlas zone links cross-checked against client maps). Community reference — EQL compatibility **not verified** in game.
- New suite `scripts/test-travel-routes.mjs` (12 tests) joined `npm test`.

## 1.7.0 — 2026-11-21 (Augure take-over)

- Removed every OpenAI/ChatGPT Sites and Cloudflare-specific dependency (`@openai/sites-vite-plugin`, `wrangler`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `vinext`, `@vitejs/plugin-rsc`, `react-server-dom-webpack`). The app was already fully offline; only the hosted companion used those tools.
- **Zone guide links are now owner-configurable.** `data/companion-site.json` holds an optional origin. With it empty (the shipped default), the "Open zone guide" action hides itself everywhere; with one set, links point at `<origin>/zone/<zone-slug>`. The hard-coded `cipherlox.chatgpt.site` address is gone.
- Added `npm run build:site` — a static companion-site generator (`site/build.mjs`) that writes a landing page plus one zone guide per catalog entry (127 zones) into `site/dist`, ready for GitHub Pages, Netlify, Cloudflare Pages or any web host.
- Fork continues the reviewed 1.6.x data files, rules, tests and desktop app unchanged.

## 1.6.15 — 2026-09-30

- Rename the Windows app and Store listing to **EQLSaK Character Build Advisor**.
- Prepare a Microsoft Store AppX package with the reserved `Venducati.EQLSaKCharacterBuildAdvisor` identity and publisher.
- Add original compass tile artwork and a repeatable local Store-package build that uses the installed Windows SDK when available.

## 1.6.14 — 2026-09-30

- Add **Wireframe view** to Maps & Routes. It redraws the selected local map using a high-contrast structural palette for routes, layers and landmarks, and works in both the embedded and expanded map views.
- Add **3D wireframe view** with pointer yaw/pitch, scroll zoom, arrow-key turning, a reset control and adjustable Floor lift for separating recorded map heights.
- Add 3D mouse navigation across all map axes: Shift-drag slides X/Y and Alt-drag vertically moves the camera through Z height.
- Add **Spell & hotbars**: a bundled, source-labeled 500-record EQL spell catalog with class, level, mana, timing, duration, target and type filters.
- Add deterministic spell-bar, preparation/travel set and melee-action recommendations based on the selected trio, level, role, priorities and group mode. Keep spell facts and heuristic placement reasons clearly separate.

## 1.6.10 — 2026-09-29

- Add a multi-select faction picker to **Factions to protect or avoid**.
- Show selected factions as removable tags and preserve custom faction names when the local catalog has no matching record.

## 1.6.9 — 2026-09-29

- Add Race & trio fit: a local, explainable comparison for all 15 EQL launch races.
- Show race strengths, tradeoffs, start region, icons, and source labels alongside any selected trio.
- Store the editable race roster separately in `data/race-advisor.json`; race advice makes no network or AI calls.

## 1.6.8 — 2026-09-13

- Click a loaded map or use Expand map to open a full-screen view with zoom, direction, Fit map and Close controls inside the map.
- Add pointer-centered wheel zoom, click/drag separation, keyboard controls and a collapsible tools panel for layers, labels, landmarks and height filters.
- Preserve the map position, zoom, filters and marker across expansion and closing. Support Escape, focus return, background scroll locking, native fullscreen exit and a window-filling fallback.
- Redraw the map at the current display size. Keep fullscreen permission limited to the trusted local main app document; other permissions stay denied.


## 1.6.7 — 2026-09-13

- Find installed EQL map folders automatically in the Windows app, preferring Brewall. Remember the folder and last successfully opened map.
- Add a searchable dungeon/zone list built from local files; load base and numbered layers together. Support friendly names and common aliases, with filenames for unknown locations.
- Open exact matching local maps from zone cards. Keep manual browsing available and show mismatched planning zones clearly.
- Let browser users choose a whole folder once per session. Collapse setup and individual-file tools. Add a refresh action for changed map packs.
- Keep map reads local and bounded. Preserve existing tools and distribute no third-party map pack.


## 1.6.6 — 2026-09-13

- Add a Windows game overlay with local log stats, critical-hit rate, damage taken, healing, damage graph and up to three estimated spell timers. Keep updates running while BA is minimized; label demo, saved, paused and stale data.
- Add drag placement, click-through locking, three sizes, opacity, optional show/hide and lock shortcuts, saved display preferences and monitor recovery. Keep the overlay hidden at startup and release it when BA closes.
- Add Maps & Routes with credited Brewall and Good’s source pages, local EQ text-map import, base/numbered layers, landmark search, height filters, pan/zoom, an accessible label list and manual /loc markers.
- Add Open local map actions to zone and trip cards. Include map pages in optional source checks. Imported map details are labeled as community EverQuest references with unverified EQL compatibility; no map pack is redistributed or used to change build scores.
- Update the color-coded installation guide and add focused overlay/map guides. Preserve sounds, guild, advisor, combat, faction and trip tools.


## 1.6.5 — 2026-09-13

- Add original offline fantasy sounds for buttons, navigation, report completion and finished trips. Include saved Sound On/Off and volume controls with previews. Start silent and stop active or pending sound immediately when muted.
- Add restrained fantasy button finishes while keeping readable spacing, focus outlines and the distinct Combat Meter tab.
- Add **My Guild**, an original parchment roster with local Guild Dump import, class icons, member search, class/rank filters, level sorting, class-presence bars, pagination and expandable exported details.
- Support the observed 15-column EQL guild dump and tables with named columns, including UTF-8 and UTF-16 files. Keep imports local, label their source and date, preserve the old roster on failed imports, and allow clearing BA's saved copy.
- Include no private guild roster or game recordings in public downloads.

## 1.6.4 — 2026-09-13

- Make the Combat Meter tab stand out with a teal background, bright border, larger waveform icon and clear selected state.
- Show the app version beside the Build Advisor title in both downloadable editions. Read it from the app package version and verify it during packaged startup checks.

## 1.6.3 — 2026-09-13

- Add more space inside and between instruction panels, headings, paragraphs, glossary cells, class-fit reports and combat help.
- Increase text line spacing and separate numbered steps, table rows and colored callouts in the installation and update guide.
- Let teammate class fields stack when their panel is narrow; restore readable field text and padding.
- Document shared layout rules so future contributions preserve readable spacing.

## 1.6.2 — 2026-09-13

- Add **Find loot log** beside the trip report; it starts the existing character-log search and moves keyboard focus to it.
- Explain the current reader, the selected report's source file, and its recorded time span. Clarify when trips become complete and which entries the player supplies.
- Open simple `/log on` and loot-chat setup steps automatically when no character logs are found.
- Add **Load recent trips** for a user-selected log. Read at most its last 4 MB locally and label incomplete coverage. Large saved-log imports use the same bounded snapshot instead of failing at 25 MB.
- Preserve old data when an empty snapshot is selected, show read errors, and block changing the source during live reading.
- Show a trip from the log just loaded, even when saved history contains a newer trip from another file.
- Add regression checks for byte limits, incomplete lines, unchanged source files, desktop/browser agreement, trip completion and the new interface actions.

## 1.6.1 — 2026-09-13

First public source snapshot and Windows community preview.

- Add class-fit reports with bullet reasons, tradeoffs, goals, alternatives, source labels and text downloads.
- Keep report viewing separate from choosing a third class. Explain this build opens the report for entered classes.
- Remove the example-profile action from the standalone app.
- Add a free-use notice and optional donation-link configuration. Hide the donation link until configured.
- Include all entered teammates in optional class source checks.
- Keep live log subscriptions current without restarting them on each render; improve log-control error and cancellation messages.
- Hide ineffective timer save/remove actions in the demo.
- Include the glossary matrix, searchable zones, faction charts, party comparisons, live combat graphs, spell timers, log discovery and loot-trip reports from the local development version.
- Add isolated interface action checks using invented data.

Earlier development occurred privately. This public history starts with the source represented by this release, so that future changes can be reviewed through commits and pull requests.
