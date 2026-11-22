# Build Advisor 1.3 — zones, faction goals, and build comparisons

This update works offline in the browser file and Windows app. It adds 127 searchable locations, a faction field guide, a build workbench, and refined background art. Existing build scores, combat parsing, maps, loot, logs, and command-center code are retained.

## Find a zone

In **Where & what you hunt**, type a name or part of one. **Dagnor’s**, **Dagnor's**, and **Cauldron** find Dagnor's Cauldron. Use the arrow to browse. Arrow keys and Enter choose a result; Escape closes the list. Selecting a known zone fills its continent. You can still use your own zone name.

Zone names are separate from hunting scores. The list includes city sections and planning locations; Kunark and Velious entries marked **Out of era** are not a claim that those zones are open. The six existing hunting dossiers remain unchanged.

The roster combines [EQL Wiki](https://eqlwiki.com/Zones), [EQ Legends Tools](https://eqlegendstools.com/zones/), and the zone-name/continent records from [lab1702's EQL map project](https://github.com/lab1702/eql-maps/blob/main/data/zones.json). Reviewed September 11, 2026. No remote data is fetched when a player types.

## Track faction points

Choose **Zone factions**. Enter points by hand, or use `/outputfile faction` in EQL and import `Character_Server-Factions.txt`. The usual filename selects the character and server. A differently named file loads into the character shown in the panel.

The blue dot shows current points; the gold marker shows the goal. Blank means unknown. Zero is a real value. The default goal is +1, the first positive point. This does not mean Amiable and does not guarantee safe access to an NPC. Refresh the export after hunting; this feature does not read game memory or follow live faction changes.

Each card lists reviewed ways to gain points, losses to other factions, sources, confidence, and missing information. Protected factions suppress repeat estimates for conflicting actions. When a rate is available, the estimate is `ceil(max(0, goal - current) / gain)`. Goals above the last exported maximum are flagged. Travel, quest access, faction caps, and mob difficulty can still limit a plan.

Reviewed starting coverage includes Dagnor's Cauldron, Crushbone, several dwarf/elf areas, Blackburrow, Splitpaw, the Warrens, Stonebrunt, Erudin, Paineel, and Kerra Island. It is **not** a complete NPC or instance database. For other locations, link a faction from the catalog or your export. Manual links are local notes. Instance notes separate those links while retaining the same character standing.

Evidence distinguishes EQLBase's verified entries from its classic baselines. Blackburrow measurements establish faction movement but do not establish per-mob gain rates; that plan stays marked **heuristic/inference**. EQL-sourced labels identify supporting sites, not independent in-game verification by this app. No user-verified label was invented.

## Compare and keep builds

Choose **Build & compare**. The contribution table shows the existing 0–5 planning ratings for each class and the build's highest rating in each area. It does not add overlapping ratings or claim exact spell unlocks. Search the table or show only ratings below 3.

Open **Save, compare & share builds** to keep four named builds locally. Compare the class ratings, workload, and gaps; the buddy row uses your current buddy and play mode. Loading a build restores its own full settings. Download/import a build JSON file to move it between computers. It contains build and hunt settings, without faction standing records or combat logs. Imports are bounded and checked against the active rule pack.

## Extend the data

| File | Purpose |
| --- | --- |
| `data/zone-catalog.json` | Names, aliases, continents, era flags, and roster sources. |
| `data/zone-factions.json` | Faction names/aliases, zone links, gain/loss actions, source links, confidence, and review date. |
| `data/build-advisor.json` | Existing class ratings, weights, synergy rules, and hunting scores. |
| `data/build-evidence.json` | Existing class evidence and community opinions. |

Add a faction with a unique ID, then reference that ID in a zone and action. Use `direction: up` or `down`; omit `points` when the rate is unknown. Use **User-verified EQL**, **EQL-sourced**, or **heuristic/inference** with supporting evidence. Keep incomplete coverage visible. Rebuild to distribute catalog/faction edits; the existing build-rule import does not replace these separate catalogs.

`lib/zone-factions.ts` parses four columns: ID, name, current points, and **points remaining to maximum**. Maximum is current plus remaining. Tab, pipe, caret, and quoted CSV formats are supported. Bad rows are counted; repeated faction rows reject the file to avoid merging characters accidentally.

Faction saves use `eqlsak-zone-factions-v1`, separated by character/server, with timestamps and local zone links. Saved builds use `eqlsak-saved-builds-v1`. Existing advisor saves use their original keys. Browser saves and desktop saves are separate; keep game exports and downloaded build files as backups.

Optional Windows source checks now include the zone and faction references. Checks remain off until requested, and changed pages never rewrite rules automatically. Updated zone/faction packs ship in a rebuilt app. Build advice has no AI API or remote model.

## EQLBuilds review

[EQLBuilds](https://eqlbuilds.com/) was reviewed through its public interface on September 11, 2026. Its race/class selection, capability comparison, share control, and searchable spell/skill progression are useful planner patterns. This update implements an original class contribution table and portable saved-build comparisons using EQLSaK's existing rules. It retains EQLSaK's own visual design, plain-language explanations, buddy scoring, faction plans, and meter. No EQLBuilds source code, artwork, spell descriptions, or bulk database was copied. This is not a claim of full feature parity: complete race, spell, and skill progression need separate authoritative data verification.

## Checks

55 automated checks passed: 8 new zone/faction/build-file checks, 19 recommendation checks (including all 560 unordered trios), 3 wording checks, 12 meter/state checks, and 13 desktop checks. Type checking passed. Browser checks covered zone typing/keyboard selection and manual faction chart updates. Final packaging and responsive checks are recorded in the release delivery.
