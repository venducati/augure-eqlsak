# Party charts and zone guides

Choose **Your party → Players to compare**. You can compare one to four players. Your main class choices are Player 1. Each other player can have up to three classes. Player 2 also fills the existing buddy slot.

Each zone card shows your party’s class icons and strength bars. Green means a strong rating. Gold means useful coverage. Peach means low coverage or a gap below the zone target. Numbers and text give the same information as the colors. The white mark shows the saved healing or enemy-control target for that zone.

The chart calls out your strongest jobs, lowest coverage, backup players, and jobs that depend on one busy player. An empty player slot does not add strength. Solo counts only you. Duo adds Player 2. Group includes Players 3 and 4 when entered.

These bars are planning estimates from the saved class rules. They do not measure damage or predict a fight. Each character uses its highest class rating for a job. The party uses its highest player rating. Other players are counted as backups at 3/5 or better. Shared skills are not added together. Faction-tool ratings do not show your faction standing.

Players 3 and 4 also count in class suggestions and zone healing/control scores. Companion rules are checked against each separate trio and counted once per rule. The app does not combine classes from different players into a made-up character.

Your level is used for XP checks and to check whether your third class is unlocked. Teammate levels, gear and spell choices are not entered in this view. Check those before picking a hard camp.

**Open zone guide** opens EQLSaK in a new browser tab. The Windows app uses your default browser. The link includes only the zone name. It opens the matching dungeon map and notes, with a button to show that zone on its continent map. Zones with an atlas entry but no dungeon guide open on the atlas. Unknown zones show a clear message.

Opening the website needs internet access and permission to view that site. The Advisor and party charts still work offline. The website’s existing access settings have not changed.

## Editing the rules

- `data/build-advisor.json`: class ratings, zone targets, scoring and companion rules. Existing rule import/export still works.
- `data/party-advisor.json`: chart labels, useful/strong rating thresholds and the party-method source label. Changes to this file need a fresh app build.
- `data/atlas-maps.ts`: continent map positions, shared by the page and navigation tests.
- `lib/zone-navigation.ts`: EQLSaK website address, link creation and zone matching.
- Party builds are stored with your other local Advisor settings and included in saved build files.

The chart’s combined results are labeled **heuristic/inference**. Saved class and zone evidence keeps its original provenance. This update adds no new claims about game balance.
