# EQLSaK code review and upgrade — 1.2.0

Reviewed the full local project, including navigation, profiles, atlas/dungeon views, loot integration, character imports, faction presentation, command tools, spellbook, Build Advisor, optional updates, and Windows packaging. This is a source review and automated verification, not a certification of all gameplay data or all runtime paths.

## Changes made

- Added a local live Combat Meter with DPS/HPS, damage taken, healing received, DD/DoT/HoT separation, observed effects, bounded log streaming, pause/resume, replay, and event export. Integrated it into both the full companion and the focused Windows app. Exact HP and effect timers remain explicitly unavailable.
- Restored missing UI dependencies so the full project can be typechecked, including the previously unused component library. Restored the missing formatter referenced by the existing format command.
- Updated the Cloudflare Vite plugin, Wrangler, and matching worker types to compatible releases fixing the dependency advisory reported through Sharp/libheif. Root and desktop dependency audits reported zero known advisories at review time.
- Fixed profile startup persistence: saved profiles are validated before use, and defaults cannot overwrite saved values before restoration. Storage failures now show a session-only notice rather than throwing. Applied storage-error handling to tonight's plan and checklist.
- Cancelled stale dungeon-map fetches and checked HTTP failures. Added cancellation/disposal guards to the 3D map loader, disposed GPU textures, and handled empty/malformed map responses.
- Removed name-hashed city-service pins. Exact coordinates are unknown; the illustration and written location notes now make that explicit.
- Updated the character/gear planner to include Beastlord and Berserker and use the shared class-name/alias parser, including multiword names.
- Validated the remote loot feed before it reaches search and totals. The live feed passed for 762 items and 1,521 sightings.
- Reused named spell/DoT damage parsing in the existing Log Reader. Neutralized spreadsheet formulas in CSV exports without changing the stored log text.
- Fixed accessible labels/content in advisor and shared UI controls. Expanded the normal lint command to all application, component, library, and offline-entry sources using the same three compatibility exceptions as the existing lint setup: React compiler migration, deprecated library APIs, and native-tag style preferences.
- Replaced the stale-bundle build check with a real compile of current sources before packaging. Added normal typecheck and test commands and excluded generated/dependency directories from source checks.

## Validation

- Full project TypeScript check passed; an advisor-only exception is no longer needed.
- Configured application-wide lint check passed.
- 19 Build Advisor tests passed, including finite deterministic rankings for all 560 unordered trios.
- 12 combat/parser/local-state/loot tests and 5 actual-file tail tests passed.
- The existing 8 network/update helper tests remain part of the desktop suite.
- Release checks passed for the private pre-release, including all 17 required assets and existing route/search/log/privacy/source-boundary checks.
- Full companion compilation and the final packaged Windows startup check passed. The installer payload also passed its integrity check.

## Remaining limits

- Eleven legacy field records remain visibly unverified. Code checks do not validate map coordinates, item drops, faction mechanics, or class balance against the live game.
- The meter has been tested with synthetic fixtures matching documented community formats, not a live game session from your installation. Its beneficial-effect mapping is intentionally small; current HP and remaining spell duration are not claimed.
- The Windows package remains unsigned. No clean-machine installation or browser interaction/visual test has been performed in this review.
- Online source checks flag changed pages. They do not rewrite advice. A reviewed structured rule package is needed to change rankings; no hosted rule feed is configured.
- The website already published at your Sites address is not automatically redeployed by this local review. The updated source and installer are delivered separately.

The Windows installer contains Build Advisor plus Combat Meter. The full source package retains maps, loot, factions, logs, the command center, and character tools.

