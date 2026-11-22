# EQLSaK Combat Meter — version 1.2.0

The Combat Meter is available beside Build Advisor in the Windows app and in the full companion navigation. It reads a player-selected log locally. It does not inject into EQL, inspect game memory, or upload combat data.

## Start a live session

1. In EverQuest Legends, enable logging with `/log on`. Make sure the combat messages you need are enabled in the game's chat filters.
2. Open Combat Meter and choose **Choose live log**. Select your character's `eqlog_<Character>_<Server>.txt` in the game's Logs folder.
3. New events are measured from the time you attach. Existing file contents are skipped; use **Import saved log** to inspect older events.
4. Enter your character name for messages that name you. Messages saying You/YOU/yourself are recognized automatically. Optionally enter the exact pet name to include its output.
5. Pause temporarily, Resume to catch up, or Stop to freeze the recorded view. Switching between the advisor and meter keeps the meter mounted and reading. Closing/reloading the application ends the session.

Windows reads appended bytes every half-second. Supported browsers can read a selected file every second through their file-access permission prompt. Browser permissions, background throttling, and game log flushing can delay updates. When browser live-file access is unavailable, use the desktop application or import a saved log. This release does not provide an always-on-top or click-through overlay.

## Read the display

- **Gold — damage output:** logged weapon/skill hits, named direct spell hits, periodic DoT ticks, and unclassified non-melee damage. Types remain separate in the ability table.
- **Green — healing:** direct healing and healing-over-time lines. Values use the leading logged amount. They do not establish effective healing, overheal, or current HP.
- **Red — damage taken:** damage explicitly targeting your character, with healing received shown alongside it.
- **Purple — DoT observations:** ticks seen in the log. A tick is not proof of remaining duration.
- **Current health: Not available:** these events do not supply authoritative current/max HP. The meter deliberately does not invent a percentage or health bar.

The default **Last 30 seconds** view uses a fixed 30-second denominator for DPS/HPS, including quiet time. **Retained session events** uses the first-to-last relevant damage/heal timestamp span, with a one-second minimum; it includes gaps between fights. It is not a per-encounter or active-combat-only rate. Session buffers retain the latest 20,000 timestamped events and disclose dropped older events. Nearby players' damage is excluded unless a name is explicitly entered as your character or pet.

The effect list shows recent observed messages, not guaranteed active buffs/debuffs. Cast starts do not prove landing. The initial exact-message mapping recognizes the ambiguous “You feel armored.” message as an armor-type effect without guessing a spell or duration. Unknown lines remain visible in the event review. There is no comprehensive spell-duration database in this release.

## Files, recovery, and limits

Saved-log imports are limited to 25 MB. Live reading is incremental and bounded, so an already-large log does not need to be loaded into memory. Partial lines and split UTF-8 characters are preserved until complete. Equal repeated hits remain separate events. Detected file replacement or truncation starts a fresh meter session. If a log is truncated and rewritten beyond the previous size between two reads, detection is not guaranteed; Stop and reselect the log to establish a new session.

Use **Export events** to keep the retained buffer as local JSON. Meter events are otherwise held in memory and are lost on application close. The demo uses synthetic log events and invented amounts; it is labeled DEMO and is never presented as a real session.

## Maintenance and evidence

`lib/combat-meter.ts` contains the original parser and aggregation logic; `data/combat-messages.json` stores exact beneficial-message labels, limitations, and source links. `desktop/log-tail.cjs` reads the file without writing to it. `components/CombatMeter.tsx` supplies the shared browser/desktop interface.

Message families were checked against [this EQL parser's documented log patterns](https://github.com/cadmusofthebes/Everquest-Legends-Parser/blob/main/parser.py), [EQL log-reader documentation](https://github.com/blastlaster/eql-log-reader), and [EQL Meter setup](https://eqlmeter.com/docs.html). These are community references, not evidence that every EQL client version emits every pattern. No third-party parser code or game assets were bundled for this feature. EQLSaK is not affiliated with EQL Meter.

To expand support, collect a minimal redacted log sample, add a regression fixture, implement the exact message family, and retain unknown/ambiguous classifications wherever source or spell identity is absent. Add beneficial-message mappings only after verifying the exact text and ambiguity. Do not classify a cast as a successful heal/buff or infer unobserved HP.

Run `node scripts/test-combat-meter.mjs` from the project root and `node --test test/log-tail.test.cjs` from `desktop`. Existing advisor and desktop network tests remain separate. Real in-game validation and a fresh-machine installation are still required before claiming complete client compatibility.
