# EQLSaK engineering review — 11 September 2026

This pass reviews the first-party website, shared data/parsers, release checks, and desktop log/network safeguards. It is not a certification that every path is bug-free or that every historical game-data record is accurate. Generated bundles, dependencies, and third-party artwork are not presented as manually audited source.

## Improvements delivered

- **Dungeon maps:** batch thousands of individual SVG lines into at most eight colored paths; coalesce mouse updates to animation frames; simplify geometry only during dragging. Camera bounds remain fixed during rotation and Z movement, instead of recentering and cancelling the requested height adjustment. Keyboard pan/zoom/reset, retryable loading errors, and bounded map parsing are included.
- **Consistent navigation:** one shared 32-entry dungeon catalog drives dossier searches and Atlas-to-dossier navigation. The six detailed mapped dossiers are distinguished from the 26 Atlas references. No geometry or named coordinates were invented for missing dossiers.
- **Lighter initial load:** load the Dungeon Dossiers, Character Lab, Log Reader, and Combat Meter when needed. The production page chunk fell from 517.83 kB to 383.57 kB (approximately 26%; gzip 159.06 kB to 118.91 kB). This is the page chunk, not a claim that the entire site or every visit is 26% faster. Each heavy tool has its own loading and recovery boundary.
- **Saved logs:** read in bounded chunks with progress, cancellation, and visible import errors. Avoid fragmenting an enemy encounter at every returning hit; prevent chart-boundary hits from being counted twice. Preserve unknown lines and reject non-finite damage values. Imports are limited to 100,000 readable lines; longer live sessions belong in the Combat Meter.
- **Character reports:** preserve quoted comma-separated item names, require identifiable faction reports before making faction charts, and paginate large tables instead of mounting every row. Invalid, empty, or oversized imports display actionable messages. A new import cannot replace data after the user clears it.
- **Gear planning:** show the new item's bonuses and the replaced item's bonuses separately; projected changes subtract the old gear, including losses. These remain explicit arithmetic, not invented EQL scaling formulas.
- **Spellbooks:** use identified columns for levels and spell IDs; unidentified numeric values are not assumed to be spell levels. Generate an index of available icon images at build time, avoiding repeated requests for nonexistent artwork. Class-symbol fallbacks remain when spell artwork is absent.
- **Combat Meter:** memoize summaries, stop the idle clock, preserve the paused rolling window, ignore stale polling failures, and show desktop pause/stop errors. No desktop installer was rebuilt in this website release.

## Verification

- `npm test`: 69 tests passed, including 13 new regression tests.
- `node --test desktop/test/*.cjs`: 13 tests passed (log tailing, file replacement, split UTF-8, bounded reads, URL/DNS/redirect restrictions, and source extraction).
- `npm run typecheck` and `npm run lint`: passed.
- `npm run build`: production build passed. Two framework-level ineffective-dynamic-import warnings remain; they do not concern the newly split tool modules.
- `npm run release:check`: private pre-release gates passed, 17/17 required assets present.
- Browser checks: Lower Guk selection, floor/wireframe switching, mouse rotation, Z-height adjustment and reset; quoted inventory import remains a table rather than becoming a faction chart.

## Remaining release limits

The gate still reports three proxy NPC coordinates and eleven legacy field records. These must remain visibly non-authoritative. Dungeon floor elevations are derived from map-line data, not verified architectural floors or finished solid meshes. Existing NPC positions were not re-surveyed in this code-quality pass. A public launch still needs data verification and broader real-device/real-log testing; passing these engineering checks does not remove that requirement.

Local reports remain local to the browser. This release does not enable AI APIs, upload game installations, or change the site's owner-private access.
