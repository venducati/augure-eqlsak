'use client';

import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Compass,
  Cuboid,
  Hammer,
  Map,
  MapPin,
  Minus,
  Plus,
  Search,
  ScrollText,
  ShieldCheck,
  Ship,
  Swords,
  UserRound,
  X,
} from 'lucide-react';
import { DUNGEONS } from '@/data/dungeons';
import { dungeonCatalog } from '@/lib/dungeon-catalog';
import ToolPanel from '@/components/ToolPanel';
import SourceFinder from '@/components/SourceFinder';
import CityServiceMap from '@/components/CityServiceMap';
import AtlasVoyageLayer from '@/components/AtlasVoyageLayer';
import CommandDirectory from '@/components/CommandDirectory';
import BuildAdvisor, { ContextualAdvisor, useBuildAdvisor } from '@/components/BuildAdvisor';
import { parseBuild } from '@/lib/build-advisor';
import {readProfiles} from '@/lib/local-state';
import {readLootIndex} from '@/lib/loot-index';
import { resolveZoneDestination } from '@/lib/zone-navigation';
import { searchScore, searchTokens } from '@/lib/field-search';
import { buildEvidenceAnswer, type AnswerEvidence } from '@/lib/eql-answer';
import type {DropSighting} from '@/lib/loot-index';
import offlineLootSnapshot from '@/data/eqlsource-drops.json';

const DungeonGuide = lazy(() => import('@/components/DungeonGuide'));
const CharacterLab = lazy(() => import('@/components/CharacterLab'));
const LogReader = lazy(() => import('@/components/LogReader'));
const CombatMeter = lazy(() => import('@/components/CombatMeter'));
const SpellLibrary = lazy(() => import('@/components/SpellLibrary'));
const CraftingGuide = lazy(() => import('@/components/CraftingGuide'));

type Source =
  | 'User-Verified EQL'
  | 'EQL-specific source'
  | 'Legacy EQ unverified';
type Profile = {
  name: string;
  level: string;
  build: string;
  location: string;
  goal: string;
};
type RecordItem = {
  id: string;
  type: string;
  name: string;
  summary: string;
  source: Source;
  zone?: string;
  mob?: string;
  level?: string;
  details?: string[];
};

type RouteMode = 'Land boundary' | 'City gate' | 'Dungeon entrance' | 'Boat';
type RouteSource = 'EQL-specific source' | 'Legacy EQ unverified';
type RouteLink = readonly [string, string, string, string, RouteMode, RouteSource];

const routeLinks: RouteLink[] = [
  ['Halas', 'Everfrost Peaks', 'Leave Halas through the Everfrost gate.', 'Enter Halas through the city gate.', 'City gate', 'Legacy EQ unverified'],
  ['Everfrost Peaks', 'Blackburrow', 'Follow the southern passes to the Blackburrow tunnel.', 'Leave the tunnel into Everfrost Peaks.', 'Land boundary', 'Legacy EQ unverified'],
  ['Blackburrow', 'Qeynos Hills', 'Use the southern tunnel exit into Qeynos Hills.', 'Take the northern tunnel into Blackburrow.', 'Land boundary', 'Legacy EQ unverified'],
  ['Qeynos Hills', 'South Qeynos', 'Follow the road south to the Qeynos city gate.', 'Leave through the northern gate into Qeynos Hills.', 'City gate', 'Legacy EQ unverified'],
  ['Qeynos Hills', 'West Karana', 'Follow the eastern road to the West Karana boundary.', 'Cross the western boundary into Qeynos Hills.', 'Land boundary', 'Legacy EQ unverified'],
  ['West Karana', 'North Karana', 'Cross the eastern zone boundary into North Karana.', 'Cross the western zone boundary into West Karana.', 'Land boundary', 'Legacy EQ unverified'],
  ['North Karana', 'East Karana', 'Cross the eastern river route into East Karana.', 'Cross west into North Karana.', 'Land boundary', 'Legacy EQ unverified'],
  ['North Karana', 'South Karana', 'Cross the southern bridge and zone boundary.', 'Cross the northern bridge into North Karana.', 'Land boundary', 'Legacy EQ unverified'],
  ['East Karana', 'Highpass Hold', 'Climb the eastern mountain pass into Highpass Hold.', 'Leave by the western pass into East Karana.', 'Land boundary', 'Legacy EQ unverified'],
  ['East Karana', 'Gorge of King Xorbb', 'Take the gorge entrance on the eastern side.', 'Leave the gorge west into East Karana.', 'Land boundary', 'Legacy EQ unverified'],
  ['Gorge of King Xorbb', 'Runnyeye', 'Use the Runnyeye entrance within the gorge.', 'Exit into the Gorge of King Xorbb.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Runnyeye', 'Misty Thicket', 'Use the eastern Runnyeye exit into Misty Thicket.', 'Enter Runnyeye from the western thicket wall.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Misty Thicket', 'Rivervale', 'Follow the village wall to the Rivervale gate.', 'Leave Rivervale through the Misty Thicket gate.', 'City gate', 'Legacy EQ unverified'],
  ['Rivervale', 'Kithicor Forest', 'Use Rivervale’s western tunnel into Kithicor Forest.', 'Enter Rivervale through the eastern tunnel.', 'City gate', 'Legacy EQ unverified'],
  ['Highpass Hold', 'Kithicor Forest', 'Descend the eastern pass into Kithicor Forest.', 'Climb the western pass into Highpass Hold.', 'Land boundary', 'Legacy EQ unverified'],
  ['Kithicor Forest', 'West Commonlands', 'Cross the eastern forest boundary into West Commonlands.', 'Cross west into Kithicor Forest.', 'Land boundary', 'Legacy EQ unverified'],
  ['West Commonlands', 'East Commonlands', 'Follow the main road east across the Commonlands boundary.', 'Follow the main road west across the Commonlands boundary.', 'Land boundary', 'Legacy EQ unverified'],
  ['West Commonlands', 'Befallen', 'Enter Befallen through the ruined entrance.', 'Exit Befallen into West Commonlands.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['East Commonlands', 'East Freeport', 'Follow the road east to the Freeport gate.', 'Leave Freeport through the western gate.', 'City gate', 'Legacy EQ unverified'],
  ['East Commonlands', 'Nektulos Forest', 'Cross the northeastern boundary into Nektulos Forest.', 'Cross southwest into East Commonlands.', 'Land boundary', 'Legacy EQ unverified'],
  ['Nektulos Forest', 'Neriak', 'Follow the eastern forest route to the Neriak gate.', 'Leave Neriak through the forest gate.', 'City gate', 'Legacy EQ unverified'],
  ['Nektulos Forest', 'Lavastorm Mountains', 'Take the northern mountain pass into Lavastorm.', 'Leave by the southern pass into Nektulos Forest.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lavastorm Mountains', 'Najena', 'Enter Najena through the shattered-door entrance.', 'Exit Najena into Lavastorm Mountains.', 'Dungeon entrance', 'EQL-specific source'],
  ['Lavastorm Mountains', 'Solusek’s Eye', 'Use the Solusek dungeon approach from Lavastorm.', 'Exit to Lavastorm Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['East Freeport', 'North Ro', 'Leave through the southern Freeport gate into North Ro.', 'Follow the north road into East Freeport.', 'City gate', 'Legacy EQ unverified'],
  ['North Ro', 'Oasis of Marr', 'Cross the southern desert boundary into Oasis.', 'Cross the northern desert boundary into North Ro.', 'Land boundary', 'Legacy EQ unverified'],
  ['Oasis of Marr', 'South Ro', 'Cross the southern boundary into South Ro.', 'Cross the northern boundary into Oasis.', 'Land boundary', 'Legacy EQ unverified'],
  ['South Ro', 'Innothule Swamp', 'Take the southern boundary into Innothule Swamp.', 'Cross north into South Ro.', 'Land boundary', 'Legacy EQ unverified'],
  ['Innothule Swamp', 'Grobb', 'Follow the swamp paths to the Grobb gate.', 'Leave Grobb into Innothule Swamp.', 'City gate', 'Legacy EQ unverified'],
  ['Innothule Swamp', 'Upper Guk', 'Enter Upper Guk through the swamp entrance.', 'Exit Upper Guk into Innothule Swamp.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Upper Guk', 'Lower Guk', 'Use the deeper Guk zone passage.', 'Climb through the passage into Upper Guk.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Innothule Swamp', 'The Feerrott', 'Cross the western swamp boundary into the Feerrott.', 'Cross east into Innothule Swamp.', 'Land boundary', 'Legacy EQ unverified'],
  ['The Feerrott', 'Cazic-Thule', 'Enter the temple complex from the Feerrott.', 'Exit the temple into the Feerrott.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['The Feerrott', 'Oggok', 'Follow the southern approach to the Oggok gate.', 'Leave Oggok into the Feerrott.', 'City gate', 'Legacy EQ unverified'],
  ['The Feerrott', 'Rathe Mountains', 'Cross the western mountain boundary.', 'Cross east into the Feerrott.', 'Land boundary', 'Legacy EQ unverified'],
  ['Rathe Mountains', 'Lake Rathetear', 'Take the northwestern route into Lake Rathetear.', 'Leave by the southeastern mountain route.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lake Rathetear', 'South Karana', 'Cross the northern boundary into South Karana.', 'Cross south into Lake Rathetear.', 'Land boundary', 'Legacy EQ unverified'],
  ['South Karana', 'Splitpaw Lair', 'Enter Splitpaw from the southern plains.', 'Exit Splitpaw into South Karana.', 'Dungeon entrance', 'EQL-specific source'],
  ['East Freeport', 'Ocean of Tears', 'Board the Faydwer boat at the East Freeport docks.', 'Remain aboard for the East Freeport docks.', 'Boat', 'Legacy EQ unverified'],
  ['Ocean of Tears', 'Butcherblock Mountains', 'Remain aboard for the Butcherblock docks.', 'Board the East Freeport boat at the Butcherblock docks.', 'Boat', 'Legacy EQ unverified'],
  ['Butcherblock Mountains', 'Kaladim', 'Follow the mountain road to the Kaladim gate.', 'Leave Kaladim into Butcherblock Mountains.', 'City gate', 'Legacy EQ unverified'],
  ['Butcherblock Mountains', 'Greater Faydark', 'Follow the eastern mountain path into Greater Faydark.', 'Follow the western forest path into Butcherblock Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Butcherblock Mountains', 'Dagnor’s Cauldron', 'Take the southern mountain route into Dagnor’s Cauldron.', 'Cross north into Butcherblock Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Dagnor’s Cauldron', 'Estate of Unrest', 'Use the island approach to the Estate of Unrest.', 'Exit the estate into Dagnor’s Cauldron.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Greater Faydark', 'Kelethin', 'Follow the forest lifts and paths into Kelethin.', 'Descend into Greater Faydark.', 'City gate', 'Legacy EQ unverified'],
  ['Greater Faydark', 'Felwithe', 'Follow the eastern forest road to Felwithe.', 'Leave Felwithe into Greater Faydark.', 'City gate', 'Legacy EQ unverified'],
  ['Greater Faydark', 'Crushbone', 'Take the northern forest entrance into Crushbone.', 'Exit south into Greater Faydark.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Greater Faydark', 'Lesser Faydark', 'Cross the southern forest boundary into Lesser Faydark.', 'Take the northeastern pass into Greater Faydark.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lesser Faydark', 'Castle Mistmoore', 'Take the narrow southwestern pass into Castle Mistmoore.', 'Exit through the pass into Lesser Faydark.', 'Dungeon entrance', 'EQL-specific source'],
  ['Lesser Faydark', 'Steamfont Mountains', 'Take the eastern pass into Steamfont Mountains.', 'Cross west into Lesser Faydark.', 'Land boundary', 'Legacy EQ unverified'],
  ['Steamfont Mountains', 'Ak’Anon', 'Follow the mountain road to the Ak’Anon gate.', 'Leave Ak’Anon into Steamfont Mountains.', 'City gate', 'Legacy EQ unverified'],
  ['South Qeynos', 'Erud’s Crossing', 'Board the Erudin-bound boat at the Qeynos docks.', 'Remain aboard for the Qeynos docks.', 'Boat', 'Legacy EQ unverified'],
  ['Erud’s Crossing', 'Erudin', 'Remain aboard for the Erudin docks.', 'Board the Qeynos-bound boat at the Erudin docks.', 'Boat', 'Legacy EQ unverified'],
  ['Erudin', 'Erudin Palace', 'Enter the palace district from Erudin.', 'Leave the palace district into Erudin.', 'City gate', 'Legacy EQ unverified'],
  ['Erudin', 'Toxxulia Forest', 'Leave Erudin through the forest gate.', 'Enter Erudin at the northern forest edge.', 'City gate', 'Legacy EQ unverified'],
  ['Toxxulia Forest', 'Kerra Isle', 'Use the eastern island crossing to Kerra Isle.', 'Return west into Toxxulia Forest.', 'Land boundary', 'Legacy EQ unverified'],
  ['Toxxulia Forest', 'Paineel', 'Take the southern forest route to Paineel.', 'Leave Paineel into Toxxulia Forest.', 'City gate', 'Legacy EQ unverified'],
  ['Paineel', 'The Hole', 'Use the guarded descent beneath Paineel.', 'Climb out through the Paineel entrance.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Paineel', 'The Warrens', 'Use the Warrens entrance near Paineel.', 'Exit the Warrens toward Paineel.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['The Warrens', 'Stonebrunt Mountains', 'Take the far Warrens exit into Stonebrunt Mountains.', 'Enter the Warrens from Stonebrunt Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Everfrost Peaks', 'Permafrost Keep', 'Follow the frozen northern route to Permafrost Keep.', 'Exit Permafrost into Everfrost Peaks.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Qeynos Hills', 'Surefall Glade', 'Take the hidden northwestern pass into Surefall Glade.', 'Leave the glade through the Qeynos Hills tunnel.', 'City gate', 'Legacy EQ unverified'],
  ['Surefall Glade', 'Jaggedpine Forest', 'Use the northern wilderness passage into Jaggedpine Forest.', 'Take the southern passage into Surefall Glade.', 'Land boundary', 'Legacy EQ unverified'],
  ['South Qeynos', 'Qeynos Catacombs', 'Enter the aqueduct and catacomb network beneath Qeynos.', 'Use a city exit from the catacombs into South Qeynos.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Highpass Hold', 'High Keep', 'Enter High Keep from within Highpass Hold.', 'Exit High Keep into Highpass Hold.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Lake Rathetear', 'The Arena', 'Use the western lakeside tunnel into The Arena.', 'Leave The Arena through the Lake Rathetear tunnel.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lavastorm Mountains', 'Temple of Solusek Ro', 'Take the temple entrance from Lavastorm Mountains.', 'Exit the temple into Lavastorm Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Lavastorm Mountains', 'Nagafen’s Lair', 'Enter the deeper Solusek complex from Lavastorm.', 'Exit Nagafen’s Lair into Lavastorm Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Dagnor’s Cauldron', 'Kedge Keep', 'Enter Kedge Keep through the submerged entrance.', 'Exit Kedge Keep into Dagnor’s Cauldron.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Ocean of Tears', 'Timorous Deep', 'Use the long-distance sea route toward Kunark and Timorous Deep.', 'Board the westbound sea route toward Ocean of Tears.', 'Boat', 'Legacy EQ unverified'],
  ['Timorous Deep', 'Firiona Vie', 'Take the Kunark-bound boat connection to Firiona Vie.', 'Board the Timorous Deep route from Firiona Vie.', 'Boat', 'Legacy EQ unverified'],
  ['Timorous Deep', 'The Overthere', 'Take the Kunark-bound boat connection to The Overthere.', 'Board the Timorous Deep route from The Overthere outpost.', 'Boat', 'Legacy EQ unverified'],
  ['Cabilis', 'Field of Bone', 'Leave Cabilis through the Field of Bone gate.', 'Enter Cabilis through the city gate.', 'City gate', 'Legacy EQ unverified'],
  ['Cabilis', 'Swamp of No Hope', 'Leave Cabilis through the swamp gate.', 'Enter Cabilis from Swamp of No Hope.', 'City gate', 'Legacy EQ unverified'],
  ['Field of Bone', 'Kurn’s Tower', 'Enter Kurn’s Tower from the Field of Bone.', 'Exit Kurn’s Tower into the Field of Bone.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Field of Bone', 'Warslik’s Woods', 'Cross the northern boundary into Warslik’s Woods.', 'Cross south into the Field of Bone.', 'Land boundary', 'Legacy EQ unverified'],
  ['Field of Bone', 'Swamp of No Hope', 'Cross the southern boundary into Swamp of No Hope.', 'Cross north into the Field of Bone.', 'Land boundary', 'Legacy EQ unverified'],
  ['Field of Bone', 'Kaesora', 'Enter the Kaesora ruins from the Field of Bone.', 'Exit Kaesora into the Field of Bone.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Warslik’s Woods', 'Lake of Ill Omen', 'Cross the western forest boundary into Lake of Ill Omen.', 'Cross east into Warslik’s Woods.', 'Land boundary', 'Legacy EQ unverified'],
  ['Warslik’s Woods', 'The Overthere', 'Cross the eastern boundary into The Overthere.', 'Cross west into Warslik’s Woods.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lake of Ill Omen', 'Frontier Mountains', 'Cross the eastern lake boundary into Frontier Mountains.', 'Cross west into Lake of Ill Omen.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lake of Ill Omen', 'Firiona Vie', 'Cross the southern boundary toward Firiona Vie.', 'Cross north into Lake of Ill Omen.', 'Land boundary', 'Legacy EQ unverified'],
  ['Lake of Ill Omen', 'Crypt of Dalnir', 'Enter the Crypt of Dalnir from Lake of Ill Omen.', 'Exit Dalnir into Lake of Ill Omen.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Swamp of No Hope', 'Firiona Vie', 'Cross the southern swamp boundary into Firiona Vie.', 'Cross north into Swamp of No Hope.', 'Land boundary', 'Legacy EQ unverified'],
  ['Firiona Vie', 'Emerald Jungle', 'Cross the eastern frontier into Emerald Jungle.', 'Cross west toward Firiona Vie.', 'Land boundary', 'Legacy EQ unverified'],
  ['Frontier Mountains', 'The Overthere', 'Cross the northern mountain boundary into The Overthere.', 'Cross south into Frontier Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Frontier Mountains', 'Dreadlands', 'Cross the eastern mountain pass into Dreadlands.', 'Cross west into Frontier Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Frontier Mountains', 'Burning Wood', 'Use the volcanic pass into Burning Wood.', 'Cross west into Frontier Mountains.', 'Land boundary', 'Legacy EQ unverified'],
  ['Frontier Mountains', 'Temple of Droga', 'Enter Temple of Droga from Frontier Mountains.', 'Exit Droga into Frontier Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Frontier Mountains', 'Mines of Nurga', 'Enter Mines of Nurga from Frontier Mountains.', 'Exit Nurga into Frontier Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['The Overthere', 'Skyfire Mountains', 'Cross the volcanic boundary into Skyfire Mountains.', 'Cross west into The Overthere.', 'Land boundary', 'Legacy EQ unverified'],
  ['The Overthere', 'Howling Stones', 'Use the keyed entrance from The Overthere into Howling Stones.', 'Exit Howling Stones into The Overthere.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Dreadlands', 'Burning Wood', 'Cross the southern boundary into Burning Wood.', 'Cross north into Dreadlands.', 'Land boundary', 'Legacy EQ unverified'],
  ['Dreadlands', 'Karnor’s Castle', 'Enter Karnor’s Castle from Dreadlands.', 'Exit Karnor’s Castle into Dreadlands.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Burning Wood', 'Chardok', 'Enter Chardok from Burning Wood.', 'Exit Chardok into Burning Wood.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Burning Wood', 'Skyfire Mountains', 'Cross the northeastern volcanic boundary into Skyfire Mountains.', 'Cross southwest into Burning Wood.', 'Land boundary', 'Legacy EQ unverified'],
  ['Skyfire Mountains', 'Veeshan’s Peak', 'Use the keyed entrance to Veeshan’s Peak.', 'Exit Veeshan’s Peak into Skyfire Mountains.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Emerald Jungle', 'City of Mist', 'Enter the City of Mist ruins from Emerald Jungle.', 'Exit City of Mist into Emerald Jungle.', 'Dungeon entrance', 'Legacy EQ unverified'],
  ['Emerald Jungle', 'Trakanon’s Teeth', 'Cross the southern jungle boundary into Trakanon’s Teeth.', 'Cross north into Emerald Jungle.', 'Land boundary', 'Legacy EQ unverified'],
  ['Trakanon’s Teeth', 'Old Sebilis', 'Use the keyed ruins entrance into Old Sebilis.', 'Exit Old Sebilis into Trakanon’s Teeth.', 'Dungeon entrance', 'Legacy EQ unverified'],
];

const connections = routeLinks.reduce<Record<string, string[]>>((graph, [a, b]) => {
  (graph[a] ||= []).push(b);
  (graph[b] ||= []).push(a);
  return graph;
}, {});

function routeLeg(from: string, to: string) {
  const link = routeLinks.find(([a, b]) => (a === from && b === to) || (a === to && b === from));
  if (!link) return null;
  const [a, , forward, reverse, mode, source] = link;
  return { direction: from === a ? forward : reverse, mode, source };
}

function RoutePicker({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const matches = showAll
    ? routeStops
    : routeStops.filter((stop) =>
        stop.toLowerCase().includes(value.trim().toLowerCase()),
      );

  return (
    <label className="routepicker">
      <span>{label}</span>
      <div className="routepickercontrol">
        <input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setShowAll(false);
            setOpen(true);
          }}
          onFocus={() => {
            setShowAll(true);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown') setOpen(true);
          }}
          placeholder={placeholder}
          aria-label={label.replace(':', '')}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          autoComplete="off"
        />
        <button
          type="button"
          className="routepickerarrow"
          aria-label={`${open ? 'Close' : 'Open'} ${label.replace(':', '')} choices`}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onClick={() => {
            setShowAll(true);
            setOpen((current) => !current);
          }}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="routepickeroptions" id={`${id}-options`} role="listbox">
          {(matches.length ? matches : routeStops).map((stop) => (
            <button
              type="button"
              role="option"
              aria-selected={stop === value}
              className={stop === value ? 'selected' : ''}
              key={stop}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(stop);
                setOpen(false);
              }}
            >
              {stop}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

const baseRouteStops = Array.from(
  new Set([
    ...Object.keys(connections),
    ...Object.values(connections).flat(),
    'Halas',
    'Rivervale',
    'Kaladim',
    'Kelethin',
    'Felwithe',
    'Ak’Anon',
    'Neriak',
    'Grobb',
    'Oggok',
    'Erudin',
    'Erudin Palace',
    'Paineel',
    'Cabilis',
    'West Cabilis',
  ]),
).sort((a, b) => a.localeCompare(b));

const vendorDirectory = [
  ['Halas', 'Cindl', 'Large leather armor and tailoring patterns', 'McPherson district'],
  ['Halas', 'April', 'Weapons and adventuring supplies', "McPherson's Bloody Blades"],
  ['Halas', 'Brin McQuaid', 'Ale and tavern supplies', "McQuaid's Dark Stout"],
  ['South Qeynos', 'Hanlore Escaval', 'Caster supplies and spells', 'The Herb Jar'],
  ['South Qeynos', 'Tasya Huntlan', 'Ale and brewing supplies', "Lion's Mane Inn"],
  ['South Qeynos', 'McNeal Jocub', 'Food and drink', "Fish's Ale tavern"],
  ['East Freeport', 'Klan Smith', 'Weapons', 'East Freeport smithy'],
  ['East Freeport', 'Gord Smith', 'Weapons', 'East Freeport smithy'],
  ['East Freeport', 'Celanie Xtoria', 'Weapons and supplies', 'East Freeport market'],
  ['Rivervale', 'Alice Sweetoven', 'Food and baking supplies', 'Rivervale village'],
  ['Rivervale', 'Flyndia Deeppockets', 'Rogue supplies', "Fool's Gold, first floor"],
  ['Rivervale', 'Fiddy Bobick', 'General goods', 'Dockside shop'],
  ['Kelethin', 'Merchant Niwiny', 'Smithing molds and patterns', 'Kelethin platforms'],
  ['Kelethin', 'Merchant Gililya', 'Rogue supplies', 'Rogue Guild platform'],
  ['Kelethin', 'Merchant Tuluvdar', 'Ranger supplies', 'Ranger Guild platform'],
  ['Kaladim', 'Aarina Ratsbone', 'Bags and containers', 'Southeast Kaladim'],
  ['Kaladim', 'Alanury Stormhammer', 'Fletching supplies', 'South Kaladim'],
  ['Kaladim', 'Didek Stormhammer', 'Weapons', 'South Kaladim'],
  ['Felwithe', 'Merchant Dantree', 'Weapons', 'Felwithe shops'],
  ['Felwithe', 'Tylar Windspirit', 'Weapons and supplies', 'Felwithe shops'],
  ['Felwithe', 'Isyna Firspanyl', 'Weapons and supplies', 'Felwithe shops'],
  ["Ak’Anon", 'A Clockwork Weaponsmith', 'Weapons', "Ak’Anon forge district"],
  ["Ak’Anon", 'A Clockwork Grocer', 'Food and drink', "Ak’Anon market"],
  ["Ak’Anon", 'A Clockwork Jeweler', 'Jewelcraft supplies', "Ak’Anon bank district"],
  ['Erudin', 'Ayth Niphiria', 'Weapons', 'Erudin shops'],
  ['Erudin', 'Teria Finleather', 'Leather armor and supplies', 'Erudin Surplus'],
  ['Erudin', 'Syra Printell', 'Cleric spells', 'Erudin temple district'],
  ['Erudin Palace', 'Anite Gemcutter', 'Gems and jewelcraft supplies', 'Palace basement'],
  ['Erudin Palace', 'Myrcin Denuen', 'General and caster supplies', 'Palace basement'],
  ['Erudin Palace', 'Agryn Moonfield', 'General goods', 'Palace upper district'],
  ['Paineel', 'Rallia Hapera', 'Key and general supplies', 'Superior Supplies near bank'],
  ['Paineel', 'Zarnlel Apridor', 'Cleric spells', 'Paineel guild district'],
  ['Paineel', 'Keletha Nightweaver', 'Caster supplies', 'Paineel market'],
] as const;

const vendorRecords: RecordItem[] = vendorDirectory.map(
  ([city, name, goods, location], index) => ({
    id: `vendor-${index}`,
    type: 'Vendor',
    name,
    summary: `${goods} · ${city}`,
    source: 'Legacy EQ unverified',
    zone: city,
    details: [
      `City: ${city}`,
      `Known location: ${location}`,
      `Known wares: ${goods}`,
      'Classic-era vendor record; verify NPC name, inventory, faction access, and coordinates in EQL.',
    ],
  }),
);

const cityServiceKinds = ['All', 'Bankers', 'General merchants', 'Weapons & armor', 'Spell merchants', 'Tradeskills', 'Food & drink', 'Class supplies'] as const;
type CityServiceKind = (typeof cityServiceKinds)[number];
function vendorServiceKind(vendor: RecordItem): CityServiceKind {
  const text = `${vendor.name} ${vendor.summary}`.toLowerCase();
  if (/banker|banking/.test(text)) return 'Bankers';
  if (/spell|caster/.test(text)) return 'Spell merchants';
  if (/weapon|armor|leather/.test(text)) return 'Weapons & armor';
  if (/smith|mold|pattern|fletch|jewel|tailor|baking|brewing/.test(text)) return 'Tradeskills';
  if (/food|drink|ale|tavern|grocer/.test(text)) return 'Food & drink';
  if (/rogue|ranger|cleric|class/.test(text)) return 'Class supplies';
  return 'General merchants';
}

const records: RecordItem[] = [
  ...vendorRecords,
  {
    id: 'faction-command',
    type: 'Command',
    name: '/faction',
    summary: 'Exposes exact faction values in EQL.',
    source: 'User-Verified EQL',
    details: [
      'Prefer measured values over con-message estimates.',
      'Record before and after a turn-in to verify its exact delta.',
    ],
  },
  {
    id: 'fish-macro',
    type: 'Command',
    name: 'One-tap fishing social',
    summary:
      '/autoinventory followed by /doability Fishing. Re-press after the cooldown.',
    source: 'EQL-specific source',
    details: [
      'EQL socials do not provide true loops or conditionals.',
      'Ordinary bait stays in inventory; it is not attached to the pole.',
    ],
  },
  {
    id: 'inventory-output',
    type: 'Command',
    name: '/out inventory',
    summary:
      'Exports inventory data for sortable companion tools; it does not rearrange bags.',
    source: 'EQL-specific source',
  },
  {
    id: 'wood-elf',
    type: 'Race',
    name: 'Wood Elf',
    summary:
      'Forest people of Greater Faydark, closely associated with Kelethin and the living canopy.',
    source: 'Legacy EQ unverified',
    zone: 'Greater Faydark',
  },
  {
    id: 'high-elf',
    type: 'Race',
    name: 'High Elf',
    summary:
      'Arcane and clerical culture centered on Felwithe in the eastern Faydwer forests.',
    source: 'Legacy EQ unverified',
    zone: 'Greater Faydark',
  },
  {
    id: 'dwarf',
    type: 'Race',
    name: 'Dwarf',
    summary: 'Mountain and forge culture of Kaladim in Butcherblock Mountains.',
    source: 'Legacy EQ unverified',
    zone: 'Butcherblock Mountains',
  },
  {
    id: 'human',
    type: 'Race',
    name: 'Human',
    summary:
      'A varied people whose major Antonican centers include Qeynos and Freeport.',
    source: 'Legacy EQ unverified',
    zone: 'South Qeynos',
  },
  {
    id: 'dark-elf',
    type: 'Race',
    name: 'Dark Elf',
    summary:
      'The Teir’Dal people of Neriak, rooted in the shadowed forests of eastern Antonica.',
    source: 'Legacy EQ unverified',
    zone: 'Nektulos Forest',
  },
  {
    id: 'barbarian',
    type: 'Race',
    name: 'Barbarian',
    summary:
      'Northern highland people associated with Halas and the Everfrost frontier.',
    source: 'Legacy EQ unverified',
  },
  {
    id: 'iksar',
    type: 'Race',
    name: 'Iksar',
    summary:
      'Scaled people of Kunark, with Cabilis and the ancient jungle empire at the heart of their story.',
    source: 'Legacy EQ unverified',
  },
  {
    id: 'mistmoore',
    type: 'Zone',
    name: 'Castle Mistmoore',
    summary: 'Revamped dungeon reached only through southwest Lesser Faydark.',
    source: 'EQL-specific source',
    zone: 'Castle Mistmoore',
    level: '20–45',
    details: [
      'Entrance/courtyard is roughly 20–30.',
      'Mistmoore-side exit is approximately /loc -295, 123.',
      'Use invisibility across Lesser Faydark when possible.',
    ],
  },
  {
    id: 'najena',
    type: 'Zone',
    name: 'Najena',
    summary:
      'Revamped 15–30 dungeon in southeast Lavastorm, behind shattered doors.',
    source: 'EQL-specific source',
    zone: 'Najena',
    level: '15–30',
    details: [
      'Druid port to Lavastorm is the fastest approach.',
      'Najena exit to Lavastorm is around /loc -13, 856.',
    ],
  },
  {
    id: 'splitpaw',
    type: 'Zone',
    name: 'Splitpaw Lair',
    summary: 'Long progression runway for XP and gear, beginning at level 25.',
    source: 'EQL-specific source',
    zone: 'Splitpaw Lair',
    level: '25–42',
  },
  {
    id: 'upper-guk',
    type: 'Zone',
    name: 'Upper Guk',
    summary:
      'At 25–30 consider barracks/Shin Lord or saltwater/Ancient Crocodile.',
    source: 'EQL-specific source',
    zone: 'Upper Guk',
    level: '10–30',
  },
  {
    id: 'cazic',
    type: 'Zone',
    name: 'Cazic-Thule',
    summary:
      'Alligator Pit is a useful 25–31 option; watch roamers and healers.',
    source: 'EQL-specific source',
    zone: 'Cazic-Thule',
    level: '25–31',
  },
  {
    id: 'unrest',
    type: 'Zone',
    name: 'Estate of Unrest',
    summary: 'Fireplace camp is a practical 19–26 dungeon stop.',
    source: 'EQL-specific source',
    zone: 'Estate of Unrest',
    level: '19–26',
  },
  {
    id: 'crocpants',
    type: 'Item',
    name: 'Ancient Crocodile WIS pants',
    summary: 'Sought-after wisdom leg drop used to pair XP with progression.',
    source: 'EQL-specific source',
    zone: 'Upper Guk',
    mob: 'Ancient Crocodile',
    level: '25–30',
  },
  {
    id: 'baron',
    type: 'NPC',
    name: "Baron Telyx V'Zher",
    summary:
      'Roughly level 28 dark elf paladin in Befallen. EQL respawn is not confirmed.',
    source: 'Legacy EQ unverified',
    zone: 'Befallen',
    level: '28',
    details: [
      'Approximate location: /loc -1002, -70.',
      'Treat 15–20 minutes only as a working estimate until timed in EQL.',
    ],
  },
  {
    id: 'tiam',
    type: 'NPC',
    name: 'Tiam Khonsir',
    summary:
      'Deepwater Knights molar turn-in NPC. Erudite illusion produced Amiable.',
    source: 'User-Verified EQL',
    zone: 'Erudin',
    details: [
      'Dialogue: “Yes” then “I have come to serve our lord.”',
      'Test with one molar before committing a stockpile.',
    ],
  },
  {
    id: 'molars',
    type: 'Faction',
    name: 'Kobold Molars (Good)',
    summary:
      'Per molar: Deepwater Knights +7, High Council +5, Heretics −1, Kerra Isle −1.',
    source: 'EQL-specific source',
    zone: 'Erudin',
    mob: 'Tiam Khonsir',
  },
  {
    id: 'slansin',
    type: 'Quest',
    name: 'Inert Potion → *Slansin',
    summary:
      'Non-merchant Slansin Denvin accepts the potion stockpile for Freeport Militia gains.',
    source: 'EQL-specific source',
    zone: 'Erudin',
    details: [
      'Merchant version is the wrong spawn; one potion despawns it.',
      'Each successful Denvin potion is listed as +1 Freeport Militia and several allied factions.',
    ],
  },
  {
    id: 'elial',
    type: 'NPC',
    name: 'Elial Brook',
    summary:
      'Level 7 faction target at approximately /loc 161, 1164 in Toxxulia.',
    source: 'Legacy EQ unverified',
    zone: 'Toxxulia Forest',
    level: '7',
    details: [
      'Legacy listing: +20 Deepwater Knights and three allied caster factions; −20 Heretics.',
      'Respawn/chance and faction values still need direct EQL verification.',
    ],
  },
  {
    id: 'shmbrd',
    type: 'Build',
    name: 'SHM / BRD sustain build',
    summary:
      'Balanced + Recovery for normal grinding; Shaman handles slow, DoTs, heals and buffs.',
    source: 'EQL-specific source',
    details: [
      'Test Offensive + Recovery on safe blues/whites.',
      'Use Evasive as a short emergency defense while endurance lasts.',
      'Bard supplies passive songs, sustain and utility.',
    ],
  },
  {
    id: 'mce',
    type: 'Build',
    name: 'MNK / CLR / ENC utility build',
    summary:
      'Melee delivery with Cleric sustain and Enchanter control; organize classes across extra hotbars.',
    source: 'EQL-specific source',
  },
  {
    id: 'faydwer-route',
    type: 'Route',
    name: 'Qeynos → Faydwer',
    summary:
      'South Qeynos docks → East Freeport docks → Butcherblock Mountains.',
    source: 'EQL-specific source',
    zone: 'Butcherblock Mountains',
  },
  {
    id: 'kunark-continent',
    type: 'Zone',
    name: 'Kunark',
    summary: 'Search hub for Kunark cities, wilderness zones, and dungeons.',
    source: 'User-Verified EQL',
    details: [
      'Kunark has been added to the companion place index at the user’s request.',
      'Individual location details remain explicitly marked until verified in EQL.',
    ],
  },
  ...([
    ['Cabilis', 'East Cabilis, West Cabilis, Cab'],
    ['Field of Bone', 'FoB'],
    ["Kurn’s Tower", 'Kurns, Kurn'],
    ["Warslik’s Woods", 'WW, Warsliks'],
    ['Lake of Ill Omen', 'LOIO, Lake'],
    ['Swamp of No Hope', 'SoNH, Swamp'],
    ['Firiona Vie', 'FV'],
    ['The Overthere', 'OT, Overthere'],
    ['Frontier Mountains', 'FM'],
    ['Dreadlands', 'DL'],
    ['Burning Wood', 'BW'],
    ['Skyfire Mountains', 'Skyfire'],
    ['Emerald Jungle', 'EJ'],
    ["Trakanon’s Teeth", 'TT, Trakanons Teeth'],
    ['City of Mist', 'CoM'],
    ['Kaesora', 'Kaes'],
    ['Crypt of Dalnir', 'Dalnir'],
    ["Karnor’s Castle", 'KC, Karnors'],
    ['Old Sebilis', 'Seb, Sebilis'],
    ['Chardok', 'Chardok'],
    ['Temple of Droga', 'Droga'],
    ['Mines of Nurga', 'Nurga'],
    ['Howling Stones', 'HS, Charasis'],
    ["Veeshan’s Peak", 'VP'],
    ['Timorous Deep', 'TD'],
  ] as const).map(([name, aliases], index): RecordItem => ({
    id: `kunark-place-${index}`,
    type: 'Zone',
    name,
    summary: `Kunark location. Common search names: ${aliases}.`,
    source: 'Legacy EQ unverified',
    zone: name,
    details: [
      'Included in the Kunark place index for fast searching.',
      'Zone details, routes, and level guidance still require EQL-specific verification.',
    ],
  })),
];

const fieldSections = [
  { name: 'World Maps & Zones', types: ['Zone'] },
  { name: 'How-To Commands', types: ['Command'] },
  { name: 'Travel Routes', types: ['Route'] },
  { name: 'Races & Starting Locations', types: ['Race'] },
  { name: 'Named NPCs & Quests', types: ['NPC', 'Quest'] },
  { name: 'Loot & Items', types: ['Item'] },
  { name: 'Faction Mechanics', types: ['Faction'] },
  { name: 'Character Builds', types: ['Build'] },
] as const;

const defaultProfiles: Profile[] = [
  {
    name: 'You',
    level: '25',
    build: 'SHM / BRD',
    location: 'Castle Mistmoore',
    goal: 'XP + useful gear',
  },
  { name: 'Friend', level: '', build: '', location: '', goal: '' },
];
const partyClasses = [
  ['🥋','Monk'],['✨','Cleric'],['🔮','Enchanter'],['🗡️','Rogue'],['🎵','Bard'],['🏹','Ranger'],['🛡️','Warrior'],
] as const;
const fieldTools = [
  ['🧑‍🏫','Trainer','Manual'],['🏪','Merchant','Atlas'],['📜','Quest','Manual'],['⚖️','Faction','Character Lab'],['💰','Loot','Loot'],['📖','Spells','Spells'],['🧪','Poison','Manual'],['🏰','Dungeon','Instances'],['🔥','Raid','Manual'],['🌀','Translocator','Atlas'],['📍','Bind point','Atlas'],['🗺️','Map','Atlas'],['📊','Logs','Logs'],['⚔️','Combat','Logs'],['🪖','Gear','Character Lab'],
] as const;
const zonePoints = [
  ['Butcherblock Mountains', 22, 52],
  ['Greater Faydark', 39, 35],
  ['Lesser Faydark', 55, 48],
  ['Castle Mistmoore', 73, 62],
  ['Najena', 84, 27],
  ['Splitpaw Lair', 61, 81],
] as const;
const realms = [
  {
    name: 'Faydwer',
    subtitle: 'The elder forest realms',
    races: ['Wood Elf', 'High Elf', 'Dwarf'],
    places: 'Kelethin · Felwithe · Kaladim',
    image: '/art/faydwer-races.png',
    tone: 'gold',
  },
  {
    name: 'Antonica',
    subtitle: 'Coasts, kingdoms & northern wilds',
    races: ['Human', 'Dark Elf', 'Barbarian'],
    places: 'Qeynos · Freeport · Halas · Neriak',
    image: '/art/antonica-races.png',
    tone: 'steel',
  },
  {
    name: 'Kunark',
    subtitle: 'The ancient scaled empire',
    races: ['Iksar'],
    places: 'Cabilis · Field of Bone · Emerald Jungle',
    image: '/art/kunark-races.png',
    tone: 'jade',
  },
] as const;
import { atlasMaps } from '@/data/atlas-maps';

const routeStops = Array.from(
  new Set([
    ...baseRouteStops,
    ...atlasMaps.flatMap((map) => map.nodes.map(([name]) => name)),
  ]),
).sort((a, b) => a.localeCompare(b));

const atlasAliases: Record<string, string[]> = {
  Antonica: ['antonnica', 'old world'],
  'Everfrost Peaks': ['everfrost', 'ef'],
  Blackburrow: ['bb'],
  'Qeynos Hills': ['qeynos', 'qhills', 'qh'],
  'South Qeynos': ['qeynos', 'qeynos city', 'sqeynos'],
  'West Karana': ['wk', 'western karana'],
  'Highpass Hold': ['highpass', 'hph'],
  'East Commonlands': ['ec', 'east commons', 'commonlands'],
  'East Freeport': ['freeport', 'efp'],
  'Nektulos Forest': ['nek', 'nektulos'],
  'Lavastorm Mtns.': ['lavastorm', 'lavastorm mountains', 'ls'],
  'North Ro': ['nro', 'northern desert of ro'],
  'Oasis of Marr': ['oasis'],
  'South Ro': ['sro', 'southern desert of ro'],
  'Innothule Swamp': ['innothule'],
  'Upper Guk': ['uguk', 'guk top'],
  'Lower Guk': ['lguk', 'guk bottom'],
  'The Feerrott': ['feerrott'],
  'Cazic-Thule': ['ct', 'cazic thule'],
  'South Karana': ['sk'],
  'Splitpaw Lair': ['splitpaw', 'paw'],
  Runnyeye: ['runny eye'],
  'Solusek’s Eye': ['solusek eye', 'sol a', 'sola'],
};

type LootIndexItem = {
  name: string;
  sightings: DropSighting[];
};

const EQL_SOURCE_DROPS =
  'https://eqlsource.com/data/sightings.v1.json';
const EQL_SOURCE_INDEX = 'https://www.eqlsource.com/tools/index-search';
const EQLBASE_ITEMS = 'https://eqlbase.com/items/';

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function provenanceClass(source: Source) {
  return source === 'User-Verified EQL'
    ? 'verified'
    : source === 'EQL-specific source'
      ? 'eql'
      : 'legacy';
}
function routeBetween(from: string, to: string) {
  if (!from || !to || from === to) return from ? [from] : [];
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    for (const next of connections[path.at(-1)!] || []) {
      if (next === to) return [...path, next];
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export default function Home() {
  const globalSearch = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('Quick');
  const [meterOpened, setMeterOpened] = useState(false);
  useEffect(() => { if (tab === 'Combat Meter') setMeterOpened(true); }, [tab]);
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState(defaultProfiles);
  const [profilesReady, setProfilesReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [from, setFrom] = useState('East Freeport');
  const [to, setTo] = useState('Castle Mistmoore');
  const [nextRouteWaypoint, setNextRouteWaypoint] = useState<'from' | 'to'>('from');
  const [edit, setEdit] = useState(false);
  const [realm, setRealm] = useState(0);
  const [atlas, setAtlas] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mapType, setMapType] = useState('all');
  const [showAllMapLabels, setShowAllMapLabels] = useState(false);
  const [showSailingRoute, setShowSailingRoute] = useState(true);
  const [focusedWaypoint, setFocusedWaypoint] = useState('');
  const [vendorCity, setVendorCity] = useState<string | null>(null);
  const [cityServiceFilter, setCityServiceFilter] = useState<CityServiceKind>('All');
  const [mappedCityService, setMappedCityService] = useState<RecordItem | null>(null);
  const [selectedInstance, setSelectedInstance] = useState('Castle Mistmoore');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [levelInput, setLevelInput] = useState('');
  const [advisorLevel, setAdvisorLevel] = useState<number | null>(null);
  const [trioClasses, setTrioClasses] = useState<string[]>([]);
  const [runGoal, setRunGoal] = useState('XP');
  const [runMinutes, setRunMinutes] = useState('60');
  const [runParty, setRunParty] = useState('Duo');
  const [runPlanOpen, setRunPlanOpen] = useState(false);
  const [completedRunStops, setCompletedRunStops] = useState<string[]>([]);
  const [manualSource, setManualSource] = useState<Source | 'all'>('all');
  const [sourceFinderQuery, setSourceFinderQuery] = useState('');
  const [characterLabFocus, setCharacterLabFocus] = useState<'character' | 'faction'>('character');
  const [canGoBack, setCanGoBack] = useState(false);
  const historyReady = useRef(false);
  const restoringHistory = useRef(false);
  const historyDepth = useRef(0);
  const [zoneLinkReady, setZoneLinkReady] = useState(false);
  const zoneLinkTarget = useRef(false);
  const zoneGuideSection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const zone = params.get('zone');
    if (zone) {
      openZoneGuide(zone);
      zoneLinkTarget.current = true;
    }
    const mobile = params.get('mobile');
    if (mobile === 'character') { setCharacterLabFocus('character'); setTab('Character Lab'); }
    if (mobile === 'map') setTab('Atlas');
    if (mobile === 'loot') setTab('Loot');
    if (mobile === 'faction') { setCharacterLabFocus('faction'); setTab('Character Lab'); }
    if (mobile === 'quest') { setQuery('quest'); setTab('Manual'); }
    if (mobile === 'search') window.setTimeout(() => globalSearch.current?.focus(), 0);
    setZoneLinkReady(true);
  }, []);
  useEffect(() => {
    if (!zoneLinkReady || !zoneLinkTarget.current) return;
    zoneLinkTarget.current = false;
    zoneGuideSection.current?.focus({ preventScroll: true });
    zoneGuideSection.current?.scrollIntoView({ block: 'start' });
  }, [zoneLinkReady]);
  const [lootIndex, setLootIndex] = useState<LootIndexItem[]>(() => readLootIndex(offlineLootSnapshot));
  const [lootIndexState, setLootIndexState] = useState<
    'loading' | 'ready' | 'unavailable'
  >('ready');
  const profile = profiles[active] || profiles[0];
  const buildAdvisor = useBuildAdvisor(profile, profiles[active === 0 ? 1 : 0]);
  const profileClasses = parseBuild(profile.build, buildAdvisor.pack);
  const profileBuddy = parseBuild(profiles[active === 0 ? 1 : 0]?.build || '', buildAdvisor.pack);
  const activePartyClasses = trioClasses.length ? trioClasses : profileClasses;
  const profileAdvisorInput = { ...buildAdvisor.input, primary: profileClasses[0] || '', secondary: profileClasses[1] || '', tertiary: profileClasses[2] || '', level: profile.level.trim() ? Number(profile.level) : null, zone: profile.location, buddy: profileBuddy, mode: profileBuddy.length ? 'duo' as const : buildAdvisor.input.mode };
  const openAdvisor = () => { setTab('Build Advisor'); setQuery(''); };
  const jumpToTool = (destination: string) => {
    setTab(destination);
    setQuery('');
    setSearchFeedback('');
    window.setTimeout(() => {
      const target = document.getElementById(destination === 'Atlas' ? 'atlas-section' : 'zone-guide');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    }, 0);
  };
  useEffect(() => {
    try {setProfiles(readProfiles(localStorage.getItem('eql-profiles'),defaultProfiles));}
    catch {setStorageNotice('Local storage is unavailable. Changes will last for this session only.');}
    setProfilesReady(true);
  }, []);
  useEffect(() => {
    if(!profilesReady)return;
    try{localStorage.setItem('eql-profiles', JSON.stringify(profiles));}
    catch{setStorageNotice('Profile changes could not be saved on this device. They remain available for this session.');}
  }, [profiles,profilesReady]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        globalSearch.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === globalSearch.current) {
        setQuery('');
        globalSearch.current?.blur();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    const restore = (event: PopStateEvent) => {
      const state = event.state as { eqlsak?: boolean; depth?: number; tab?: string; atlas?: number; waypoint?: string; vendor?: string | null; selectedId?: string | null; instance?: string } | null;
      if (!state?.eqlsak) return;
      restoringHistory.current = true;
      historyDepth.current = state.depth || 0;
      setCanGoBack(historyDepth.current > 0);
      if (state.tab) setTab(state.tab);
      if (typeof state.atlas === 'number') setAtlas(state.atlas);
      if (state.instance) setSelectedInstance(state.instance);
      setFocusedWaypoint(state.waypoint || '');
      setVendorCity(state.vendor || null);
      setSelected(state.selectedId ? records.find((record) => record.id === state.selectedId) || null : null);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('eql-tonight-plan');
      if (!saved) return;
      const plan = JSON.parse(saved) as { goal?: string; minutes?: string; party?: string; completed?: string[] };
      if (typeof plan.goal==='string') setRunGoal(plan.goal);
      if (typeof plan.minutes==='string') setRunMinutes(plan.minutes);
      if (typeof plan.party==='string') setRunParty(plan.party);
      if (Array.isArray(plan.completed)&&plan.completed.every(x=>typeof x==='string')) setCompletedRunStops(plan.completed);
    } catch {}
  }, []);
  useEffect(() => {
    setLevelInput(profile?.level || '');
    setAdvisorLevel(null);
  }, [active, profile?.level]);
  useEffect(() => {
    let cancelled = false;
    fetch(EQL_SOURCE_DROPS)
      .then((response) => {
        if (!response.ok) throw new Error('Loot index request failed');
        return response.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        setLootIndex(readLootIndex(payload));
        setLootIndexState('ready');
      })
      .catch(() => {
        // Keep the bundled measured snapshot available when the live source is
        // unreachable. Offline mode must never erase known evidence.
        if (!cancelled) setLootIndexState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const results = useMemo(() => records
    .map((record) => ({ record, score: searchScore(query, record.name, `${record.type} ${record.summary} ${record.zone || ''} ${record.mob || ''} ${record.details?.join(' ') || ''}`) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score ||
      (a.record.source === 'User-Verified EQL' ? -1 : 0) - (b.record.source === 'User-Verified EQL' ? -1 : 0))
    .map((match) => match.record), [query]);
  const mappedSearchResults = useMemo(() => {
    const term = searchTokens(query).join(' ');
    if (!term) return [];
    return atlasMaps
      .flatMap((map, mapIndex) => [
        {
          mapIndex,
          name: map.name,
          level: 'CONTINENT',
          kind: 'continent',
        },
        ...map.nodes.map((node) => ({
          mapIndex,
          name: node[0],
          level: node[3],
          kind: node[4],
        })),
      ])
      .map((place) => {
        const searchable = [place.name, ...(atlasAliases[place.name] || [])].map(
          normalizeSearch,
        );
        const rank = searchable.includes(term)
          ? 0
          : searchable.some((value) => value.startsWith(term))
            ? 1
            : searchable.some((value) => value.includes(term))
              ? 2
              : searchScore(query, place.name, `${place.kind} ${place.level}`) > 0
                ? 3
                : 99;
        return { ...place, rank };
      })
      .filter((place) => place.rank < 99)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }, [query]);
  const lootSearchResults = useMemo(() => {
    const term = searchTokens(query).join(' ');
    if (!term) return [];
    return lootIndex
      .map((item) => {
        const itemName = normalizeSearch(item.name);
        const related = item.sightings.flatMap((sighting) => [
          sighting.mob,
          ...sighting.sessions.map((session) => session.zone || ''),
        ]);
        const relatedMatch = related.some((value) =>
          normalizeSearch(value).includes(term),
        );
        const rank =
          itemName === term
            ? 0
            : itemName.startsWith(term)
              ? 1
              : itemName.includes(term)
                ? 2
                : relatedMatch
                  ? 3
                  : searchScore(query, item.name, related.join(' ')) > 0
                    ? 4
                    : 99;
        return { ...item, rank };
      })
      .filter((item) => item.rank < 99)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }, [lootIndex, query]);
  const runRecommendations = useMemo(() => {
    const parsedProfileLevel = Number(profile?.level);
    const level = advisorLevel ?? (Number.isInteger(parsedProfileLevel) ? parsedProfileLevel : null);
    if (!level) return [];
    const minutes = Number(runMinutes);
    return atlasMaps
      .flatMap((map, mapIndex) => map.nodes.map(([name, , , range, kind]) => ({ name, mapIndex, range, kind })))
      .filter((place) => place.kind === 'wild' || place.kind === 'dungeon')
      .map((place) => {
        const match = String(place.range).match(/(\d+)\s*[–-]\s*(\d+)/);
        const min = match ? Number(match[1]) : 0;
        const max = match ? Number(match[2]) : 0;
        const midpoint = (min + max) / 2;
        const levelFit = level >= min && level <= max ? 0 : Math.min(Math.abs(level - min), Math.abs(level - max));
        const source = records.find((record) => record.name === place.name)?.source || 'Legacy EQ unverified';
        const hasFrontline = activePartyClasses.some((name) => ['Warrior', 'Monk', 'Ranger'].includes(name));
        const hasRecovery = activePartyClasses.some((name) => ['Cleric', 'Bard', 'Ranger'].includes(name));
        const hasControl = activePartyClasses.some((name) => ['Enchanter', 'Bard'].includes(name));
        const dungeonBias = place.kind === 'dungeon' ? 0 : 2;
        const goalBias = runGoal === 'XP' ? Math.abs(level - midpoint) : runGoal === 'Loot' ? dungeonBias : place.kind === 'wild' ? 0 : 1;
        const timeBias = minutes <= 30 && place.kind === 'dungeon' ? 3 : minutes >= 90 && place.kind === 'dungeon' ? -1 : 0;
        const partyBias = runParty === 'Solo' && place.kind === 'dungeon' ? 3 : runParty === 'Group' && place.kind === 'dungeon' ? -1 : 0;
        const classBias = place.kind === 'dungeon' ? (!hasRecovery ? 5 : hasFrontline ? -2 : 1) + (hasControl ? -1 : 0) : 0;
        const levelNote = level >= min && level <= max ? `Level ${level} sits inside the mapped ${place.range} band.` : `Level ${level} is just outside the mapped ${place.range} band.`;
        const classNote = !activePartyClasses.length ? 'Add a class setup for a party-aware read.' : place.kind === 'dungeon' && hasFrontline && hasRecovery ? `${activePartyClasses.join(' / ')} covers a frontline and recovery.` : place.kind === 'dungeon' && !hasRecovery ? `${activePartyClasses.join(' / ')} has no clear recovery role, so this is ranked cautiously.` : `${activePartyClasses.join(' / ')} is included in the ranking.`;
        return { ...place, source, levelFit, reason: `${levelNote} ${classNote}`, score: levelFit * 8 + goalBias + timeBias + partyBias + classBias };
      })
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [activePartyClasses, advisorLevel, profile?.level, runGoal, runMinutes, runParty]);
  const tabVisible = query
    ? results
    : records.filter((r) =>
        tab === 'Quick'
          ? ['Command', 'Zone', 'Build'].includes(r.type)
          : tab === 'Atlas'
            ? ['Zone', 'Route', 'NPC'].includes(r.type)
            : tab === 'Loot'
              ? ['Item', 'NPC', 'Quest'].includes(r.type)
              : true,
      );
  const visible = tab === 'Manual' && manualSource !== 'all'
    ? tabVisible.filter((record) => record.source === manualSource)
    : tabVisible;
  const groupedVisible = fieldSections
    .map((section) => ({
      ...section,
      items: visible.filter((record) =>
        (section.types as readonly string[]).includes(record.type),
      ),
    }))
    .filter((section) => section.items.length);
  const route = routeBetween(from, to);
  const routeLegs = route.slice(1).map((destination, index) => ({
    from: route[index],
    to: destination,
    mode: routeLeg(route[index], destination)?.mode || 'Land boundary',
  }));
  const routeHasBoat = routeLegs.some((leg) => leg.mode === 'Boat');
  const focusedMapNode = useMemo(() => atlasMaps[atlas].nodes.find(([name]) => name === focusedWaypoint), [atlas, focusedWaypoint]);
  const focusedDungeon = useMemo(() => focusedMapNode?.[4] === 'dungeon' ? DUNGEONS.find((dungeon) => dungeon.name === focusedMapNode[0]) : undefined, [focusedMapNode]);
  const isolatingDungeon = focusedMapNode?.[4] === 'dungeon';
  const cityVendors = useMemo(() => vendorCity ? vendorRecords.filter((vendor) => vendor.zone === vendorCity) : [], [vendorCity]);
  const visibleCityVendors = useMemo(() => cityServiceFilter === 'All' ? cityVendors : cityVendors.filter((vendor) => vendorServiceKind(vendor) === cityServiceFilter), [cityVendors, cityServiceFilter]);
  useEffect(() => {
    if (!zoneLinkReady) return;
    const snapshot = { eqlsak:true, depth:historyDepth.current, tab, atlas, waypoint:focusedWaypoint, vendor:vendorCity, selectedId:selected?.id || null, instance:selectedInstance };
    if (!historyReady.current) {
      historyReady.current = true;
      window.history.replaceState(snapshot, '', window.location.href);
      return;
    }
    if (restoringHistory.current) {
      restoringHistory.current = false;
      return;
    }
    historyDepth.current += 1;
    window.history.pushState({ ...snapshot, depth:historyDepth.current }, '', window.location.href);
    setCanGoBack(true);
  }, [zoneLinkReady, tab, atlas, focusedWaypoint, vendorCity, selected?.id, selectedInstance]);
  function openZoneGuide(zone: string, showAtlas = false) {
    const destination = resolveZoneDestination(zone, dungeonCatalog, atlasMaps);
    setQuery('');
    setSelected(null);
    setVendorCity(null);
    setMappedCityService(null);
    setMapType('all');
    if (!destination) {
      setFocusedWaypoint('');
      setZoom(1);
      setTab('Atlas');
      setSearchFeedback('This zone does not have a saved map or guide yet. Search the atlas to choose another zone.');
      return;
    }
    setSearchFeedback('');
    if (destination.mapIndex !== undefined) {
      setAtlas(destination.mapIndex);
      setFocusedWaypoint(destination.waypoint || '');
      setZoom(1.65);
    }
    if (destination.guide && !showAtlas) {
      setSelectedInstance(destination.guide);
      setTab('Instances');
    } else setTab('Atlas');
  }
  function updateProfile(key: keyof Profile, value: string) {
    setProfiles((p) =>
      p.map((x, i) => (i === active ? { ...x, [key]: value } : x)),
    );
  }
  function openMappedLocation(place: (typeof mappedSearchResults)[number]) {
    setAtlas(place.mapIndex);
    setMapType('all');
    setFocusedWaypoint(place.kind === 'continent' ? '' : place.name);
    setZoom(place.kind === 'continent' ? 1 : 1.65);
    setTab('Atlas');
    setSearchFeedback('');
  }
  function chooseRouteWaypoint(name: string, type: string) {
    setFocusedWaypoint(name);
    setZoom(1.65);
    setVendorCity(null);
    setMappedCityService(null);
    setSelected(null);
    if (nextRouteWaypoint === 'from') {
      setFrom(name);
      setNextRouteWaypoint('to');
    } else {
      setTo(name);
      setNextRouteWaypoint('from');
    }
    if (type === 'city') {
      setVendorCity(name);
      setCityServiceFilter('All');
      setMappedCityService(null);
    }
  }
  function openRecord(record: RecordItem) {
    if (record.type === 'Vendor' && record.zone) {
      const mapIndex = atlasMaps.findIndex((map) =>
        map.nodes.some(([name, , , , kind]) => kind === 'city' && name === record.zone),
      );
      if (mapIndex >= 0) {
        setAtlas(mapIndex);
        setMapType('all');
        setVendorCity(record.zone);
        setCityServiceFilter('All');
        setMappedCityService(record);
        setSelected(record);
        setTab('Atlas');
        setQuery('');
        setSearchFeedback('');
        return;
      }
    }
    setSelected(record);
  }
  function openMeasuredLoot(item: LootIndexItem) {
    const mobs = [...new Set(item.sightings.map((sighting) => sighting.mob))];
    const zones = [...new Set(item.sightings.flatMap((sighting) => sighting.sessions.map((session) => session.zone).filter((zone): zone is string => Boolean(zone))))];
    const observations = item.sightings.reduce((total, sighting) => total + sighting.seen, 0);
    setSelected({
      id: `measured-${item.name}`,
      type: 'Item',
      name: item.name,
      summary: `Measured dropping from ${mobs.slice(0, 4).join(', ')}${mobs.length > 4 ? ` and ${mobs.length - 4} more` : ''}.`,
      source: 'EQL-specific source',
      mob: mobs[0],
      zone: zones[0],
      details: [
        `${observations.toLocaleString()} total observed drop${observations === 1 ? '' : 's'} across ${item.sightings.length} mob record${item.sightings.length === 1 ? '' : 's'}. This is not a drop rate.`,
        `Dropping mobs: ${mobs.join(' · ')}`,
        zones.length ? `Observed zones: ${zones.join(' · ')}` : 'The source log did not identify a zone for this sighting.',
        'Live measured-drop data supplied by EQL Source.',
      ],
    });
  }
  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim().toLowerCase();
    const searchedBuild = parseBuild(query, buildAdvisor.pack);
    if (searchedBuild.length >= 2 && searchedBuild.length <= 3 && new Set(searchedBuild).size === searchedBuild.length && searchedBuild.every(id => buildAdvisor.pack.classes.some(c => c.id === id))) {
      buildAdvisor.setInput(i => ({ ...i, primary: searchedBuild[0], secondary: searchedBuild[1], tertiary: searchedBuild[2] || '' }));
      openAdvisor();
      setSearchFeedback('');
      return;
    }
    if (!term) {
      setSearchFeedback('Type a zone, item, NPC, command, or faction first.');
      return;
    }
    const toolDestination = [
      { terms:['build advisor','advisor','class combo','build recommendations'], tab:'Build Advisor' },
      { terms:['combat meter','meter','dps','hps','health','damage output'], tab:'Combat Meter' },
      { terms:['logs','log reader','combat log','session log'], tab:'Logs' },
      { terms:['spells','spell list','spell library','songs','class spells'], tab:'Spells' },
      { terms:['faction','faction tracker','inventory','gear','spell audit','spellbook','missing spells','aa','achievements','macro','command center','character'], tab:'Character Lab' },
      { terms:['dungeon dossier','dungeon map','instances','instance map','wireframe'], tab:'Instances' },
      { terms:['loot index','drops','item search','named mobs'], tab:'Loot' },
      { terms:['field manual','provenance','verified commands'], tab:'Manual' },
      { terms:['world map','atlas','route finder','routes'], tab:'Atlas' },
    ].find((destination)=>destination.terms.includes(term));
    if (toolDestination) {
      setTab(toolDestination.tab);
      setQuery('');
      setSearchFeedback('');
      return;
    }
    const exactLoot = lootSearchResults.find(
      (item) => normalizeSearch(item.name) === normalizeSearch(query),
    );
    if (exactLoot) {
      setSearchFeedback('');
      setTab('Manual');
      return;
    }
    const mappedZone = mappedSearchResults[0];
    if (mappedZone && normalizeSearch(mappedZone.name) === normalizeSearch(query)) {
      openMappedLocation(mappedZone);
      return;
    }
    const bestMatch =
      results.find((record) => record.name.toLowerCase() === term) ||
      results.find((record) => record.name.toLowerCase().startsWith(term)) ||
      results.find((record) => record.name.toLowerCase().includes(term)) ||
      results[0];
    if (bestMatch && normalizeSearch(bestMatch.name) === normalizeSearch(query)) {
      setSearchFeedback('');
      openRecord(bestMatch);
      return;
    }
    if (lootSearchResults.length || mappedSearchResults.length || results.length) {
      setTab('Manual');
      setManualSource('all');
      setSearchFeedback('');
      return;
    }
    setSourceFinderQuery(query.trim());
    setTab('Manual');
    setSearchFeedback(`No on-site match for “${query.trim()}” yet. Check EQL-specific sources, then verify a lead in game before treating it as fact.`);
  }
  function togglePartyClass(name:string) {
    setTrioClasses(current=>{
      const next=current.includes(name)?current.filter(item=>item!==name):current.length<3?[...current,name]:[...current.slice(1),name];
      if (next.length) updateProfile('build',next.join(' / '));
      setRunParty(next.length>=3?'Trio':next.length===2?'Duo':next.length===1?'Solo':runParty);
      return next;
    });
  }
  function saveRunPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const level = Number(levelInput);
    if (!Number.isInteger(level) || level < 1 || level > 60) {
      setAdvisorLevel(null);
      setSearchFeedback('Enter a whole character level from 1 to 60 to build your next move.');
      return;
    }
    setAdvisorLevel(level);
    updateProfile('level', String(level));
    if (trioClasses.length) updateProfile('build', trioClasses.join(' / '));
    setSearchFeedback('');
    setRunPlanOpen(true);
    setCompletedRunStops([]);
    try{localStorage.setItem('eql-tonight-plan', JSON.stringify({ goal: runGoal, minutes: runMinutes, party: runParty, completed: [] }));}catch{setStorageNotice('Tonight’s plan is available for this session; local storage could not save it.');}
  }
  function toggleRunStop(name: string) {
    setCompletedRunStops((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      try{localStorage.setItem('eql-tonight-plan', JSON.stringify({ goal: runGoal, minutes: runMinutes, party: runParty, completed: next }));}catch{setStorageNotice('Checklist changes could not be saved on this device.');}
      return next;
    });
  }

  type KnowledgeCard = AnswerEvidence & { open: () => void };
  const recordEvidence: KnowledgeCard[] = results.slice(0, 4).map((record) => ({
    id: `record-${record.id}`,
    kind: record.type,
    title: record.name,
    summary: record.summary,
    source: record.source,
    open: () => openRecord(record),
  }));
  const lootEvidence: KnowledgeCard[] = lootSearchResults.slice(0, 3).map((item) => {
    const mobs = [...new Set(item.sightings.map((sighting) => sighting.mob))];
    const observations = item.sightings.reduce((total, sighting) => total + sighting.seen, 0);
    return {
      id: `loot-${item.name}`,
      kind: 'Measured loot',
      title: item.name,
      summary: `${observations.toLocaleString()} observed drop${observations === 1 ? '' : 's'} from ${mobs.slice(0, 3).join(', ')}${mobs.length > 3 ? ` and ${mobs.length - 3} more` : ''}. Observations are not drop odds.`,
      source: 'EQL-specific source',
      open: () => openMeasuredLoot(item),
    };
  });
  const mapEvidence: KnowledgeCard[] = mappedSearchResults.slice(0, 3).map((place) => ({
    id: `map-${place.mapIndex}-${place.name}`,
    kind: String(place.kind) === 'continent' ? 'World map' : 'Mapped place',
    title: place.name,
    summary: `Shown in the ${atlasMaps[place.mapIndex].name} atlas${place.level ? ` · ${place.level}` : ''}. Open the map to inspect the saved waypoint and nearby connections.`,
    source: 'Legacy EQ unverified',
    open: () => openMappedLocation(place),
  }));
  const normalizedQuestion = normalizeSearch(query);
  const evidenceCards = (/\b(drop|drops|loot|item|mob|named)\b/.test(normalizedQuestion)
    ? [...lootEvidence, ...recordEvidence, ...mapEvidence]
    : /\b(where|map|route|travel|zone|city|dungeon)\b/.test(normalizedQuestion)
      ? [...mapEvidence, ...recordEvidence, ...lootEvidence]
      : [...recordEvidence, ...lootEvidence, ...mapEvidence]).slice(0, 7);
  const evidenceAnswer = query.trim() ? buildEvidenceAnswer(query, evidenceCards) : null;

  return (
    <main className="min-h-screen pb-14">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark" style={{ width: 58, fontSize: 9 }}>
            EQLSaK
          </span>
          <div>
            <strong>EQL Swiss Army Knife</strong>
            <small>EQLSaK · Field Companion</small>
          </div>
        </div>
        <div className="historyactions">
          <button className="appback" type="button" onClick={() => window.history.back()} disabled={!canGoBack} title="Return to your previous EQLSaK view"><ArrowLeft aria-hidden="true" /> Back</button>
          <button
            className="session"
            onClick={() => setTab('Quick')}
            aria-describedby="field-desk-tooltip"
            title="Return to the Norrath Wayfinder home page"
          >
            <span className="pulse" />
            WAYFINDER
            <span className="sessiontooltip" id="field-desk-tooltip" role="tooltip">
              Return to maps, routes, loot, characters, logs, and trusted field records.
            </span>
          </button>
        </div>
      </header>
      <output className="prerelease">
        <strong>PRIVATE PRE-RELEASE</strong>
        <span>Unofficial community companion · Verified EQL evidence outranks legacy data</span>
      </output>
      <section className="shell">
        <aside className="rail">
          <nav aria-label="Primary">
            {([
              ['Quick', Compass],
              ['Atlas', Map],
              ['Instances', Cuboid],
              ['Loot', Swords],
              ['Spells', BookOpen],
              ['Crafting', Hammer],
              ['Character Lab', UserRound],
              ['Build Advisor', Compass],
              ['Logs', ScrollText],
              ['Combat Meter', Swords],
              ['Manual', BookOpen],
            ] as const).map(([name, Icon]) => (
              <button
                key={String(name)}
                className={tab === name ? 'navactive' : ''}
                onClick={() => setTab(String(name))}
                title={`Open ${name === 'Quick' ? 'the Norrath Wayfinder home page' : name}`}
              >
                <Icon />
                {name}
              </button>
            ))}
          </nav>
          <div className="profilebox">
            <small>ACTIVE PLAYER</small>
            {profiles.map((p, i) => (
              <button
                key={p.name}
                className={active === i ? 'profileactive' : ''}
                onClick={() => setActive(i)}
                title={`Use ${p.name} as the active character for recommendations and imports`}
              >
                <UserRound />
                {p.name}
                <span>
                  {p.build && p.level ? `${p.level} ${p.build}` : 'Add build'}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="workspace" id="zone-guide" ref={zoneGuideSection} tabIndex={-1}>
          {storageNotice&&<p role="status">{storageNotice}</p>}
          <div className="eyebrow">
            {tab === 'Quick' ? 'LIVE FIELD DESK' : tab.toUpperCase()} ·{' '}
            {profile.name.toUpperCase()}
          </div>
          <h1>
            {tab === 'Quick' ? (
              <>
                Find your way through <em>Norrath.</em>
              </>
            ) : tab === 'Atlas' ? (
              <>
                Find the <em>way through.</em>
              </>
            ) : tab === 'Instances' ? (
              <>
                Know every <em>corridor.</em>
              </>
            ) : tab === 'Loot' ? (
              <>
                Follow every <em>drop.</em>
              </>
            ) : tab === 'Spells' ? (
              <>
                Prepare every <em>spell.</em>
              </>
            ) : tab === 'Crafting' ? (
              <>
                Build every <em>combine.</em>
              </>
            ) : tab === 'Logs' ? (
              <>
                Read every <em>adventure.</em>
              </>
            ) : tab === 'Combat Meter' ? (
              <>Follow the <em>fight.</em></>
            ) : tab === 'Build Advisor' ? (
              <>Understand your <em>combination.</em></>
            ) : tab === 'Character Lab' ? (
              <>
                Know what your <em>character carries.</em>
              </>
            ) : (
              <>
                The trusted <em>field manual.</em>
              </>
            )}
          </h1>
          <form className="search" onSubmit={submitSearch}>
              <Search />
              <input
                ref={globalSearch}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchFeedback('');
                }}
                aria-label="Search EQL field records"
                placeholder="Ask about a zone, item, mob, command, spell, or faction…"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('');
                    setSearchFeedback('');
                  }}
                >
                  <X />
                </button>
              )}
              <button type="submit" aria-label="Ask EQLSaK and open the best match">
                <ChevronRight />
              </button>
              <kbd>Ctrl K</kbd>
            </form>
          {searchFeedback && (
            <output className="searchfeedback">
              {searchFeedback}
            </output>
          )}
          {evidenceAnswer && (
            <section className="searchanswer" aria-label="EQLSaK evidence answer" aria-live="polite">
              <div className="searchanswer-heading"><ShieldCheck /><div><small>ASK EQLSAK · PRIVATE ON-DEVICE RETRIEVAL</small><h2>Answer for “{query.trim()}”</h2></div><span className={`answerconfidence ${evidenceAnswer.confidence === 'Verified' ? 'verified' : evidenceAnswer.confidence === 'Supported lead' ? 'eql' : 'legacy'}`}>{evidenceAnswer.confidence}</span></div>
              <p className="answerlead">{evidenceAnswer.lead} <sup>[1]</sup></p>
              <div className="answercitations" aria-label="Records supporting this answer">
                <small>SUPPORTING RECORDS</small>
                <ol>{evidenceAnswer.citations.map((citation, index) => {
                  const card = evidenceCards.find((entry) => entry.id === citation.id);
                  return <li key={citation.id}><button type="button" onClick={() => card?.open()}><b>[{index + 1}] {citation.title}</b><span>{citation.kind} · {citation.summary}</span><em className={`badge ${provenanceClass(citation.source)}`}>{citation.source}</em></button></li>;
                })}</ol>
              </div>
              <p className="answercaution"><b>Evidence check:</b> {evidenceAnswer.caution}</p>
              <small className="searchanswer-note">This first assistant layer retrieves and combines EQLSaK records; it does not call an outside model or upload character files. External websites remain leads to inspect, never copied authority.</small>
            </section>
          )}
          {tab !== 'Quick' && <nav className="toolshortcuts" aria-label="Jump to another EQLSaK tool">
            {[['Atlas','Maps & routes'],['Instances','Dungeon maps'],['Loot','Loot & mobs'],['Spells','Spell library'],['Crafting','Crafting'],['Character Lab','Character tools'],['Logs','Log reader'],['Manual','Field manual']].map(([destination,label])=><button type="button" key={destination} className={tab===destination?'active':''} onClick={()=>jumpToTool(destination)} title={`Open ${label} and move to that section`}>{label}</button>)}
          </nav>}
          {tab === 'Quick' && (
            <section className="oneshop" aria-labelledby="one-stop-title">
              <header>
                <div><small>YOUR FIELD BRIEF · {profile.name.toUpperCase()}</small><h2 id="one-stop-title">Your next move</h2></div>
                <span>{profile.level ? `Level ${profile.level}` : 'Add a level'} · {activePartyClasses.length ? activePartyClasses.join(' / ') : 'Add a class setup'} · {profile.location || 'Location unknown'}</span>
              </header>
              <form className="nextmove-controls" onSubmit={saveRunPlan}>
                <label>Level<input type="number" min="1" max="60" inputMode="numeric" value={levelInput} onChange={(event) => setLevelInput(event.target.value)} aria-label="Character level for next-move recommendations" /></label>
                <label>Goal<select value={runGoal} onChange={(event) => setRunGoal(event.target.value)}><option>XP</option><option>Loot</option><option>Faction</option><option>Quest progress</option></select></label>
                <label>Time<select value={runMinutes} onChange={(event) => setRunMinutes(event.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2+ hours</option></select></label>
                <label>Party<select value={runParty} onChange={(event) => setRunParty(event.target.value)}><option>Solo</option><option>Duo</option><option>Trio</option><option>Group</option></select></label>
                <button type="submit">Refresh my picks</button>
              </form>
              <div className="nextmove-list" aria-live="polite">
                {runRecommendations.length ? runRecommendations.map((place, index) => (
                  <article className={completedRunStops.includes(place.name) ? 'done' : ''} key={place.name}>
                    <div className="nextmove-rank">{completedRunStops.includes(place.name) ? '✓' : index + 1}</div>
                    <div className="nextmove-copy"><small>{place.kind === 'dungeon' ? 'DUNGEON' : 'OUTDOOR'} · {place.range}</small><h3>{place.name}</h3><p>{place.reason}</p><span className={`badge ${provenanceClass(place.source as Source)}`}>{place.source}</span></div>
                    <div className="nextmove-actions">
                      <button type="button" onClick={() => { if (routeStops.includes(profile.location)) setFrom(profile.location); setTo(place.name); setAtlas(place.mapIndex); setMapType('all'); setFocusedWaypoint(place.name); setZoom(1.65); setTab('Atlas'); setSearchFeedback(`Route prepared to ${place.name}.`); }}><MapPin /> Route there</button>
                      {place.kind === 'dungeon' && DUNGEONS.some((dungeon) => dungeon.name === place.name) && <button type="button" onClick={() => { setSelectedInstance(place.name); setTab('Instances'); setQuery(''); }}><Cuboid /> Open dossier</button>}
                      <button type="button" onClick={() => { setQuery(place.name); setTab('Loot'); }}><Swords /> Check loot</button>
                      {runPlanOpen && <button type="button" className="nextmove-check" onClick={() => toggleRunStop(place.name)}>{completedRunStops.includes(place.name) ? 'Reopen stop' : 'Mark complete'}</button>}
                    </div>
                  </article>
                )) : <p className="nextmove-empty">Add a whole level from 1 to 60, then refresh your picks.</p>}
              </div>
              <footer><b>Why these picks:</b> deterministic level, goal, time, party, and class-fit weighting. Live tuning, faction, and camp conditions can change the safest choice; evidence labels stay attached.</footer>
              <details className="tooldrawer">
                <summary><span><b>Open another tool</b><small>Maps, loot, spells, crafting, characters, logs, and the field manual</small></span><ChevronDown /></summary>
                <div className="toolgrid">
                  <button title="Open the searchable loot and named-mob index" onClick={() => { setTab('Loot'); setQuery(''); }}><Swords/><b>Items & named mobs</b><small>Measured drops, sources, zones, and NPC trails</small></button>
                  <button title="Open class spell lists and compare a local spellbook report" onClick={() => { setTab('Spells'); setQuery(''); }}><BookOpen/><b>Spells & songs</b><small>Class catalogs and a personal missing-spell check</small></button>
                  <button title="Open the offline recipe index and local ingredient planner" onClick={() => { setTab('Crafting'); setQuery(''); }}><Hammer/><b>Crafting & tradeskills</b><small>Recipes, trivials, components, and a shopping list</small></button>
                  <button title="Open world maps, vendor cities, and route connections" onClick={() => { setTab('Atlas'); setQuery(''); }}><Map/><b>World maps & routes</b><small>Cities, outdoor zones, vendors, and connections</small></button>
                  <button title="Open draggable dungeon maps and named NPC locations" onClick={() => { setTab('Instances'); setQuery(''); }}><Cuboid/><b>Dungeon dossiers</b><small>Floor layers, draggable maps, named locations</small></button>
                  <button title="Open local character reports, spell audit, faction charts, and macros" onClick={() => { setTab('Character Lab'); setQuery(''); }}><UserRound/><b>Character & gear lab</b><small>Local imports, spell audit, faction, AA, macros</small></button>
                  <button title="Open the local session-log reader" onClick={() => setTab('Logs')}><ScrollText/><b>Session evidence</b><small>Private local parsing for loot, faction, chat, and zones</small></button>
                  <button title="Search current EQL web resources without an API key" onClick={() => { setTab('Atlas'); setQuery(''); }}><Search/><b>EQL Source Finder</b><small>Official pages, measured drops, maps, and references</small></button>
                  <button title="Open verified commands and evidence-labelled records" onClick={() => { setTab('Manual'); setQuery(''); }}><ShieldCheck/><b>Commands & provenance</b><small>Verified EQL facts separated from inherited claims</small></button>
                </div>
              </details>
              <details className="fielddrawer">
                <summary><span><b>Class setup & field symbols</b><small>Build a trio or jump directly to a specialized tool</small></span><ChevronDown /></summary>
                <section className="fieldiconkey" aria-label="EQLSaK field symbol language">
                  <header><b>Build your trio & open field tools</b><span>Select up to three classes. Other symbols open their matching workspace.</span></header>
                  <div>{partyClasses.map(([glyph,label])=><button type="button" key={label} className={trioClasses.includes(label)?'selected':''} aria-pressed={trioClasses.includes(label)} title={`${trioClasses.includes(label)?'Remove':'Add'} ${label} ${trioClasses.includes(label)?'from':'to'} the active party`} onClick={()=>togglePartyClass(label)}><i aria-hidden="true">{glyph}</i>{label}</button>)}{fieldTools.map(([glyph,label,destination])=><button type="button" key={label} title={`Open ${label} tools`} onClick={()=>{setTab(destination);setQuery(label==='Trainer'||label==='Quest'||label==='Poison'||label==='Raid'?label:'')}}><i aria-hidden="true">{glyph}</i>{label}</button>)}</div>
                  <footer><b>Active party:</b> {activePartyClasses.length?activePartyClasses.join(' / '):'No classes selected yet'} <span>{activePartyClasses.length}/3</span></footer>
                </section>
              </details>
            </section>
          )}
          {tab === 'Quick' && (
            <div className="chips">
              <form
                className="quickroute"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!routeStops.includes(from) || !routeStops.includes(to)) {
                    setSearchFeedback('Choose both route locations from the suggested EQL map stops.');
                    return;
                  }
                  setSearchFeedback('');
                  const destination = atlasMaps.findIndex((map) =>
                    map.nodes.some(([name]) => name === to),
                  );
                  if (destination >= 0) setAtlas(destination);
                  setMapType('all');
                  setFocusedWaypoint(to);
                  setZoom(routeStops.includes(to) ? 1.65 : 1);
                  setTab('Atlas');
                }}
              >
                <RoutePicker id="quick-route-from" label="Route From:" value={from} placeholder="Starting city or zone" onChange={setFrom} />
                <RoutePicker id="quick-route-to" label="Route To:" value={to} placeholder="Destination city or zone" onChange={setTo} />
                <button type="submit" title="Open the Atlas and display the mapped connection path">Show route</button>
              </form>
              <button
                title="Open the complete measured loot index"
                onClick={() => {
                  setTab('Loot');
                  setQuery('');
                }}
              >
                Browse loot index
              </button>
              <button title="Open the active character profile fields" onClick={() => {
                setEdit(true);
                window.setTimeout(() => document.getElementById('active-character-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
              }}>
                Edit active character
              </button>
            </div>
          )}
          {tab === 'Quick' && (
            <section
              className={`realmstage ${realms[realm].tone}`}
              style={{
                backgroundImage: `linear-gradient(90deg,rgba(7,10,8,.88) 0%,rgba(7,10,8,.22) 57%,rgba(7,10,8,.08) 100%),url(${realms[realm].image})`,
              }}
            >
              <div className="realmcopy">
                <small>
                  PEOPLES & HOMELANDS · {String(realm + 1).padStart(2, '0')}
                </small>
                <h2>{realms[realm].name}</h2>
                <p>{realms[realm].subtitle}</p>
                <div className="racechips">
                  {realms[realm].races.map((r) => (
                    <span key={r}>{r}</span>
                  ))}
                </div>
                <span>{realms[realm].places}</span>
              </div>
              <div className="realmtabs" aria-label="Choose a realm">
                {realms.map((r, i) => (
                  <button
                    key={r.name}
                    className={realm === i ? 'active' : ''}
                    onClick={() => setRealm(i)}
                    title={`Show ${r.name}, its peoples, and homeland artwork`}
                  >
                    <b>{r.name}</b>
                    <span>{r.races.join(' · ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {edit && (
            <section className="profileedit" id="active-character-editor">
              <div className="cardhead">
                <div>
                  <small>CHARACTER PROFILE</small>
                  <h2>{profile.name}</h2>
                </div>
                <button title="Close the character profile editor" onClick={() => setEdit(false)}>Save and close</button>
              </div>
              <div className="formgrid">
                {(['level', 'build', 'location', 'goal'] as const).map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      value={profile[k]}
                      onChange={(e) => updateProfile(k, e.target.value)}
                      placeholder={
                        k === 'build'
                          ? 'e.g. WAR / CLR'
                          : k === 'goal'
                            ? 'XP, gear, faction…'
                            : ''
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          )}
          {tab === 'Build Advisor' && <BuildAdvisor model={buildAdvisor} profileName={profile.name} onZone={(zone) => openZoneGuide(zone)} />}
          {(edit || tab === 'Character Lab') && <ContextualAdvisor input={profileAdvisorInput} pack={buildAdvisor.pack} onOpen={() => { buildAdvisor.fromProfile(); openAdvisor(); }} />}
          {tab === 'Atlas' && focusedWaypoint && <ContextualAdvisor input={buildAdvisor.input} pack={buildAdvisor.pack} zone={focusedWaypoint} onOpen={() => { buildAdvisor.setInput(i => ({ ...i, zone: focusedWaypoint })); openAdvisor(); }} />}
          {tab === 'Instances' && (
            <ToolPanel name="Dungeon Dossiers">
            <DungeonGuide initialDungeon={selectedInstance} lootIndex={lootIndex} onOpenLoot={(item) => { setQuery(item); setTab('Loot'); }} onDungeonChange={setSelectedInstance} onShowAtlas={(zone) => openZoneGuide(zone, true)} renderAdvisor={(zone) => <ContextualAdvisor input={buildAdvisor.input} pack={buildAdvisor.pack} zone={zone} onOpen={() => { buildAdvisor.setInput(i => ({ ...i, zone })); openAdvisor(); }} />} />
            </ToolPanel>
          )}
          {tab === 'Logs' && <ToolPanel name="Log Reader"><LogReader /></ToolPanel>}
          {(meterOpened || tab === 'Combat Meter') && <div hidden={tab !== 'Combat Meter'}><ToolPanel name="Combat Meter"><CombatMeter advisorInput={profileAdvisorInput} advisorPack={buildAdvisor.pack} /></ToolPanel></div>}
          {tab === 'Character Lab' && <ToolPanel name="Character Lab"><CharacterLab key={`${profile.name}-${profile.build}-${profile.level}`} playerName={profile.name} playerBuild={profile.build} playerLevel={profile.level} initialGuideId={characterLabFocus} onOpenLogs={() => setTab('Logs')} onOpenMaps={() => setTab('Instances')} /></ToolPanel>}
          {tab === 'Spells' && <ToolPanel name="Spell Library"><SpellLibrary playerBuild={profile.build} playerLevel={profile.level} /></ToolPanel>}
          {tab === 'Crafting' && <ToolPanel name="Crafting & Tradeskills"><CraftingGuide /></ToolPanel>}
          {tab === 'Loot' && (
            <section className="lootcoverage" aria-label="Loot search coverage">
              <div>
                <small>LIVE LOOT INDEX</small>
                <h2>
                  {lootIndexState === 'ready'
                    ? `${lootIndex.length.toLocaleString()} measured EQL drops ready`
                    : lootIndexState === 'loading'
                      ? 'Loading measured EQL drops…'
                      : 'Measured feed is temporarily unavailable'}
                </h2>
                <p>
                  The main search now matches item names, dropping mobs, and
                  observed zones. Every result below came from an EQL combat-log
                  sighting; counts are observations, never invented drop rates.
                </p>
              </div>
              <div className="lootsources">
                <a href={EQL_SOURCE_INDEX} target="_blank" rel="noreferrer">
                  <b>EQL Source</b>
                  <span>Measured drops · strongest public evidence</span>
                </a>
                <a href={EQLBASE_ITEMS} target="_blank" rel="noreferrer">
                  <b>EQLBase full catalog</b>
                  <span>9,360 items · EQL-observed + labeled baseline</span>
                </a>
              </div>
              <p className="coveragewarning">
                No public source currently proves every mob-loot item across all
                of EQL. EQLSaK shows everything in the measured feed and keeps the
                broader baseline separate so “possible” never masquerades as
                “verified.”
              </p>
              {lootIndexState === 'ready' && !query.trim() && (
                <section className="lootbrowser" aria-labelledby="measured-loot-title">
                  <header><div><small>BROWSE MEASURED DROPS</small><h3 id="measured-loot-title">Open any observed item</h3></div><span>Showing 48 of {lootIndex.length.toLocaleString()} · search above for the rest</span></header>
                  <div>{[...lootIndex].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 48).map((item) => {
                    const observations = item.sightings.reduce((total, sighting) => total + sighting.seen, 0);
                    const mobs = [...new Set(item.sightings.map((sighting) => sighting.mob))];
                    return <button type="button" key={item.name} onClick={() => openMeasuredLoot(item)} title={`Open measured mob and zone evidence for ${item.name}`}><span><b>{item.name}</b><small>{mobs.slice(0, 2).join(' · ') || 'Mob not identified'}</small></span><em>{observations.toLocaleString()} observed</em><ChevronRight aria-hidden="true" /></button>;
                  })}</div>
                </section>
              )}
            </section>
          )}
          {tab === 'Atlas' && (
            <section id="atlas-section" className="atlasworkspace" tabIndex={-1}>
              <SourceFinder initialQuery={sourceFinderQuery} />
              <section className="atlasnav">
                <div className="continenttabs">
                  {atlasMaps.map((m, i) => (
                    <button
                      key={m.name}
                      className={atlas === i ? 'active' : ''}
                      title={`Show the ${m.name} map and its mapped locations`}
                      onClick={() => {
                        setAtlas(i);
                        setZoom(1);
                        setFocusedWaypoint('');
                      }}
                    >
                      <span>0{i + 1}</span>
                      <b>{m.name}</b>
                      <small>{m.nodes.length} mapped places</small>
                    </button>
                  ))}
                </div>
                <label className="atlasfinder">
                  <span>FIND A LOCATION</span>
                  <select value={focusedWaypoint} onChange={(event) => {
                    const name = event.target.value;
                    setFocusedWaypoint(name);
                    const mapIndex = atlasMaps.findIndex((map) => map.nodes.some(([nodeName]) => nodeName === name));
                    if (mapIndex >= 0) {
                      setAtlas(mapIndex);
                      setMapType('all');
                      setZoom(1.65);
                    }
                  }}>
                    <option value="">Choose any mapped place…</option>
                    {atlasMaps.flatMap((map) => map.nodes.map(([name]) => ({ name, continent: map.name }))).sort((a, b) => a.name.localeCompare(b.name)).map((place) => (
                      <option value={place.name} key={`${place.continent}-${place.name}`}>{place.name} · {place.continent}</option>
                    ))}
                  </select>
                </label>
                <div className="mapfilters">
                  <button
                    className={mapType === 'all' ? 'active' : ''}
                    title="Show cities, dungeons, and outdoor zones"
                    onClick={() => setMapType('all')}
                  >
                    All
                  </button>
                  <button
                    className={mapType === 'city' ? 'active' : ''}
                    title="Show city locations only"
                    onClick={() => setMapType('city')}
                  >
                    Cities
                  </button>
                  <button
                    className={mapType === 'dungeon' ? 'active' : ''}
                    title="Show dungeon locations only"
                    onClick={() => setMapType('dungeon')}
                  >
                    Dungeons
                  </button>
                  <button
                    className={mapType === 'wild' ? 'active' : ''}
                    title="Show outdoor adventuring zones only"
                    onClick={() => setMapType('wild')}
                  >
                    Outdoors
                  </button>
                </div>
                <label className="atlaslabeltoggle" title="Show or hide every visible map label">
                  <input type="checkbox" checked={showAllMapLabels} onChange={(event) => setShowAllMapLabels(event.target.checked)} />
                  <span>{showAllMapLabels ? 'Hide extra labels' : 'Show all labels'}</span>
                </label>
                <label className={`atlaslabeltoggle sailtoggle${routeHasBoat ? ' active' : ''}`} title={routeHasBoat ? 'Show or hide the animated ship and glowing route stops' : 'The selected route has no mapped boat connection'}>
                  <input type="checkbox" checked={showSailingRoute} disabled={!routeHasBoat} onChange={(event) => setShowSailingRoute(event.target.checked)} />
                  <Ship aria-hidden="true" />
                  <span>{routeHasBoat ? (showSailingRoute ? 'Hide sailing route' : 'Show sailing route') : 'No boat leg'}</span>
                </label>
              </section>
              <section className="atlasframe">
                <div className="atlashead">
                  <div className="atlasidentity">
                    <small>CARTOGRAPHIC RECONSTRUCTION · EQL CONNECTIONS</small>
                    <h2>{atlasMaps[atlas].name}</h2>
                    <p>{atlasMaps[atlas].subtitle}</p>
                  </div>
                  <div className="zoomcontrols">
                    <button
                      onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
                      aria-label="Zoom out"
                    >
                      <Minus />
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
                      aria-label="Zoom in"
                    >
                      <Plus />
                    </button>
                  </div>
                </div>
                <div className="atlasviewport">
                  <div
                    className="atlaslayer"
                    style={{
                      backgroundImage: `url(${atlasMaps[atlas].image})`,
                      transform: `scale(${zoom})`,
                      transformOrigin: focusedMapNode ? `${focusedMapNode[1]}% ${focusedMapNode[2]}%` : 'center',
                    }}
                  >
                    {showSailingRoute && routeHasBoat && <AtlasVoyageLayer nodes={atlasMaps[atlas].nodes} route={route} legs={routeLegs}/>}
                    {atlasMaps[atlas].nodes.map(
                      ([name, x, y, level, type]) =>
                        (mapType === 'all' || mapType === type) && (
                          <button
                            key={name}
                            className={`mapnode ${type}${vendorCity === name ? ' vendorfocus' : ''}${focusedWaypoint === name ? ' waypointfocus' : ''}${showSailingRoute && route.includes(name) ? ` routepoint ${name === route[0] ? 'routedeparture' : name === route.at(-1) ? 'routedestination' : 'routestop'}` : ''}${!showAllMapLabels && isolatingDungeon && type === 'dungeon' && focusedWaypoint !== name ? ' dungeonlabelmuted' : ''}`}
                            style={{ left: `${x}%`, top: `${y}%` }}
                            onClick={() => chooseRouteWaypoint(name, type)}
                            title={`Set ${name} as Route ${nextRouteWaypoint === 'from' ? 'From' : 'To'}`}
                            aria-label={`Set ${name} as Route ${nextRouteWaypoint === 'from' ? 'From' : 'To'}`}
                            aria-pressed={focusedWaypoint === name}
                          >
                            <i />
                            {(showAllMapLabels || focusedWaypoint === name || vendorCity === name) && <span>
                              {name}
                              <small>{level}</small>
                            </span>}
                          </button>
                        ),
                    )}
                  </div>
                  <div className="maplegend">
                    <span>
                      <i className="city" />
                      City
                    </span>
                    <span>
                      <i className="dungeon" />
                      Dungeon
                    </span>
                    <span>
                      <i className="wild" />
                      Outdoor
                    </span>
                    <span>
                      <Ship />
                      {showSailingRoute && routeHasBoat ? 'Sailing now' : 'Travel'}
                    </span>
                    <span className="labelhint">Select a marker to reveal its label</span>
                  </div>
                  {showSailingRoute && routeHasBoat && <div className="voyagetruth"><Ship aria-hidden="true"/><span><b>Active sea passage</b>Schematic course · timing and coastline track remain unverified</span></div>}
                  {vendorCity && (
                    <aside className="vendortray" aria-label={`${vendorCity} city services`}>
                      <button className="vendorclose" onClick={() => { setVendorCity(null); setMappedCityService(null); }} aria-label="Close vendor list"><X /></button>
                      <small>CITY SERVICES DIRECTORY</small>
                      <h3>{vendorCity}</h3>
                      {mappedCityService ? <CityServiceMap service={mappedCityService} onBack={() => setMappedCityService(null)} onOpenRecord={() => setSelected(mappedCityService)} /> : <><p>Drill down into every locally known merchant, banker, supplier, and service contact. Empty categories mean this field guide does not yet hold a verified name.</p>
                      <nav className="servicefilters" aria-label="Filter city services">
                        {cityServiceKinds.map((kind) => {
                          const count = kind === 'All' ? cityVendors.length : cityVendors.filter((vendor) => vendorServiceKind(vendor) === kind).length;
                          return <button type="button" key={kind} className={cityServiceFilter === kind ? 'active' : ''} aria-pressed={cityServiceFilter === kind} onClick={() => setCityServiceFilter(kind)}><span>{kind}</span><b>{count}</b></button>;
                        })}
                      </nav>
                      <div className="cityservicelist">
                        {visibleCityVendors.map((vendor) => (
                          <button key={vendor.id} onClick={() => setMappedCityService(vendor)}>
                            <small>{vendorServiceKind(vendor)}</small>
                            <b>{vendor.name}</b>
                            <span>{vendor.summary.replace(` · ${vendorCity}`, '')}</span>
                          </button>
                        ))}
                        {!visibleCityVendors.length && <div className="serviceempty"><b>No named {cityServiceFilter === 'All' ? 'services' : cityServiceFilter.toLowerCase()} recorded yet</b><span>EQLSaK will not invent an NPC. This category remains visible so a sourced entry can be added later.</span></div>}
                      </div>
                      <em className="badge legacy">Directory entries · Legacy EQ unverified</em>
                      </>}
                    </aside>
                  )}
                  {focusedMapNode && !vendorCity && (
                    <aside className="waypointtray" aria-label={`${focusedMapNode[0]} map details`}>
                      <button className="vendorclose" onClick={() => { setFocusedWaypoint(''); setZoom(1); }} aria-label="Close location details"><X /></button>
                      <small>FOCUSED MAP LOCATION</small>
                      <h3>{focusedMapNode[0]}</h3>
                      <dl><div><dt>Location type</dt><dd>{focusedMapNode[4] === 'wild' ? 'Outdoor zone' : focusedMapNode[4] === 'city' ? 'City' : focusedMapNode[4] === 'dungeon' ? 'Dungeon' : 'Travel connection'}</dd></div><div><dt>Level guide</dt><dd>{focusedMapNode[3]}</dd></div><div><dt>Direct links</dt><dd>{(connections[focusedMapNode[0]] || []).join(' · ') || 'No direct link recorded'}</dd></div></dl>
                      {focusedDungeon ? <div className="waypointpois"><small>POINTS OF INTEREST</small>{focusedDungeon.spawns.slice(0,4).map((spawn)=><article key={spawn.name}><div><b>{spawn.name}</b><span>Level {spawn.level}</span></div><p>{spawn.loot}</p></article>)}</div> : <div className="waypointpois"><small>NEARBY PLACES TO VISIT</small>{(connections[focusedMapNode[0]] || []).slice(0,4).map((place)=><article key={place}><div><b>{place}</b><span>Directly connected</span></div></article>)}</div>}
                      {focusedMapNode[4] === 'dungeon' && <button className="opendossier" type="button" onClick={() => openZoneGuide(focusedMapNode[0])}>Open {focusedMapNode[0]} {focusedDungeon ? 'Dungeon Dossier' : 'Atlas Reference'} <ChevronRight aria-hidden="true"/></button>}
                      <em className="badge legacy">Map placement · Legacy EQ unverified</em>
                    </aside>
                  )}
                </div>
              </section>
              <section className="routebar">
                <div className="routepickhint" role="status">
                  <MapPin aria-hidden="true" />
                  <span>
                    Click a map marker to set <b>Route {nextRouteWaypoint === 'from' ? 'From' : 'To'}</b>.
                    {nextRouteWaypoint === 'to' && ' Now choose your destination.'}
                  </span>
                  <button type="button" onClick={() => setNextRouteWaypoint('from')} title="Make the next map marker your starting point">
                    Start over
                  </button>
                </div>
                <div>
                  <label>
                    ROUTE FROM
                    <select
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    >
                      {routeStops.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </label>
                  <ChevronRight />
                  <label>
                    TO
                    <select value={to} onChange={(e) => setTo(e.target.value)}>
                      {routeStops.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {route.length ? (
                  <ol className="routelegs">
                    <li className="routestart">
                      <b>1</b>
                      <span><strong>Start in {route[0]}</strong><small>Begin at your selected Route From location.</small></span>
                    </li>
                    {route.slice(1).map((z, index) => {
                      const leg = routeLeg(route[index], z);
                      return (
                        <li key={`${route[index]}-${z}`}>
                          <b>{index + 2}</b>
                          <span>
                            <strong>{route[index]} → {z}</strong>
                            <small>{leg?.direction || 'Cross the mapped zone boundary into the next area.'}</small>
                            {leg && <em className={`badge ${leg.source === 'EQL-specific source' ? 'eql' : 'legacy'}`}>{leg.mode} · {leg.source}</em>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p>No complete boundary-by-boundary path is mapped between these selections yet.</p>
                )}
              </section>
            </section>
          )}
          {tab === 'Manual' && <CommandDirectory />}
          {tab !== 'Atlas' && tab !== 'Instances' && tab !== 'Loot' && tab !== 'Spells' && tab !== 'Logs' && tab !== 'Character Lab' && tab !== 'Build Advisor' && tab !== 'Combat Meter' && (
            <div className="grid">
              <section className="mapcard">
                <div className="cardhead">
                  <div>
                    <small>
                      {tab === 'Manual' ? 'EVIDENCE GUIDE & FILTERS' : 'CONNECTED WORLD'}
                    </small>
                    <h2>
                      {tab === 'Manual'
                        ? 'Choose how strongly a record is supported'
                        : 'Zone routefinder'}
                    </h2>
                  </div>
                  <span>{records.length} records</span>
                </div>
                {tab !== 'Manual' ? (
                  <div className="mapcanvas">
                    <svg viewBox="0 0 100 100" aria-label="Connected EQL zones">
                      <path d="M22 52 L39 35 L55 48 L73 62 M61 81 L84 27" />
                      {zonePoints.map(([name, x, y]) => (
                        <g key={name} role="button" tabIndex={0} aria-label={`Search for ${name}`} onClick={() => setQuery(name)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setQuery(name); }}>
                          <circle cx={x} cy={y} r="2.2" />
                          <text x={x + 3} y={y - 2}>
                            {name}
                          </text>
                          <text className="range" x={x + 3} y={y + 2}>
                            {records.find((r) => r.zone === name)?.level ||
                              'mapped'}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="provenance">
                    <div className="provenanceintro">
                      <h3>What these evidence labels mean</h3>
                      <p>“Provenance” simply means <b>where the information came from</b>. Select a card below to show only records with that evidence level. Select “Show everything” to remove the filter.</p>
                      <button className={manualSource === 'all' ? 'active' : ''} onClick={() => setManualSource('all')}>Show everything · {records.length} records</button>
                    </div>
                    <button className={`provenancechoice ${manualSource === 'User-Verified EQL' ? 'active' : ''}`} onClick={() => setManualSource('User-Verified EQL')} aria-pressed={manualSource === 'User-Verified EQL'}>
                      <span className="badge verified">User-Verified EQL</span>
                      <strong>Tested directly by you in EverQuest Legends</strong>
                      <p>Observed through your gameplay, commands, screenshots, exports, or measured results. This is our strongest evidence and takes priority when another source disagrees.</p>
                      <small>Click to show {records.filter((record) => record.source === 'User-Verified EQL').length} matching records</small>
                    </button>
                    <button className={`provenancechoice ${manualSource === 'EQL-specific source' ? 'active' : ''}`} onClick={() => setManualSource('EQL-specific source')} aria-pressed={manualSource === 'EQL-specific source'}>
                      <span className="badge eql">EQL-specific source</span>
                      <strong>Reported specifically for EverQuest Legends</strong>
                      <p>From a current EQL-focused source or community dataset. It is useful and relevant, but has not necessarily been reproduced in your own game session.</p>
                      <small>Click to show {records.filter((record) => record.source === 'EQL-specific source').length} matching records</small>
                    </button>
                    <button className={`provenancechoice ${manualSource === 'Legacy EQ unverified' ? 'active' : ''}`} onClick={() => setManualSource('Legacy EQ unverified')} aria-pressed={manualSource === 'Legacy EQ unverified'}>
                      <span className="badge legacy">Legacy EQ unverified</span>
                      <strong>Inherited from older EverQuest references</strong>
                      <p>This may come from classic EQ, P99, or another historical reference. EQL may behave differently, so use it as a lead—not as confirmed fact. It never overrules verified EQL evidence.</p>
                      <small>Click to show {records.filter((record) => record.source === 'Legacy EQ unverified').length} matching records</small>
                    </button>
                    <aside><b>Why this matters:</b> EQL changes commands, mechanics, loot, factions, and progression. These labels prevent an old EverQuest answer from being presented as confirmed EQL behavior.</aside>
                  </div>
                )}
              </section>
              <section className="intelcard">
                <div className="cardhead">
                  <div>
                    <small>{query ? 'SEARCH RESULTS' : 'FIELD INDEX'}</small>
                    <h2>
                      {visible.length +
                        (query
                          ? mappedSearchResults.length + lootSearchResults.length
                          : 0)}{' '}
                      {query ? 'matches' : 'entries'}
                    </h2>
                  </div>
                  <ShieldCheck />
                </div>
                <div className="recordlist">
                  {query
                    ? <>
                        {lootSearchResults.slice(0, 20).map((item) => {
                          const mobs = [...new Set(item.sightings.map((s) => s.mob))];
                          const zones = [
                            ...new Set(
                              item.sightings.flatMap((s) =>
                                s.sessions
                                  .map((session) => session.zone)
                                  .filter((zone): zone is string => Boolean(zone)),
                              ),
                            ),
                          ];
                          const observations = item.sightings.reduce(
                            (total, sighting) => total + sighting.seen,
                            0,
                          );
                          return (
                            <button
                              className="result lootresult"
                              key={`loot-${item.name}`}
                              onClick={() =>
                                setSelected({
                                  id: `measured-${item.name}`,
                                  type: 'Item',
                                  name: item.name,
                                  summary: `Measured dropping from ${mobs.slice(0, 4).join(', ')}${mobs.length > 4 ? ` and ${mobs.length - 4} more` : ''}.`,
                                  source: 'EQL-specific source',
                                  mob: mobs[0],
                                  zone: zones[0],
                                  details: [
                                    `${observations.toLocaleString()} total observed drop${observations === 1 ? '' : 's'} across ${item.sightings.length} mob record${item.sightings.length === 1 ? '' : 's'}. This is not a drop rate.`,
                                    `Dropping mobs: ${mobs.join(' · ')}`,
                                    zones.length
                                      ? `Observed zones: ${zones.join(' · ')}`
                                      : 'The source log did not identify a zone for this sighting.',
                                    'Live measured-drop data supplied by EQL Source.',
                                  ],
                                })
                              }
                            >
                              <span>
                                <i>
                                  ITEM · {observations.toLocaleString()} OBSERVED
                                </i>
                                {item.name}
                                <small>
                                  {mobs.slice(0, 3).join(' · ')}
                                  {zones.length ? ` · ${zones.slice(0, 2).join(' / ')}` : ''}
                                </small>
                                <em className="badge eql">Measured EQL drop</em>
                              </span>
                              <ChevronRight />
                            </button>
                          );
                        })}
                        {mappedSearchResults.slice(0, 20).map((place) => (
                          <button
                            className="result"
                            key={`map-${place.mapIndex}-${place.name}`}
                            onClick={() => openMappedLocation(place)}
                          >
                            <span>
                              <i>
                                MAP · {String(place.kind).toUpperCase()}
                                {place.level ? ` · ${place.level}` : ''}
                              </i>
                              {place.name}
                              <small>
                                Open in the {atlasMaps[place.mapIndex].name} atlas.
                              </small>
                              <em className="badge eql">EQL atlas</em>
                            </span>
                            <ChevronRight />
                          </button>
                        ))}
                        {visible.slice(0, Math.max(0, 20 - mappedSearchResults.length - lootSearchResults.length)).map((r) => (
                        <button
                          className="result"
                          key={r.id}
                          onClick={() => openRecord(r)}
                        >
                          <span>
                            <i>
                              {r.type}
                              {r.level ? ` · ${r.level}` : ''}
                            </i>
                            {r.name}
                            <small>{r.summary}</small>
                            <em
                              className={`badge ${provenanceClass(r.source)}`}
                            >
                              {r.source}
                            </em>
                          </span>
                          <ChevronRight />
                        </button>
                        ))}
                        {lootIndexState === 'ready' && lootSearchResults.length === 0 && (
                          <div className="externalresults">
                            <small>NO MEASURED DROP MATCH</small>
                            <p>
                              Try the full baseline catalog for unverified or
                              not-yet-observed items.
                            </p>
                            <a href={EQLBASE_ITEMS} target="_blank" rel="noreferrer">
                              Search all 9,360 EQLBase items <ChevronRight />
                            </a>
                          </div>
                        )}
                      </>
                    : groupedVisible.map((section) => (
                        <section className="recordgroup" key={section.name}>
                          <header>
                            <h3>{section.name}</h3>
                            <span>{section.items.length}</span>
                          </header>
                          {section.items.map((r) => (
                            <button
                              className="result"
                              key={r.id}
                              onClick={() => openRecord(r)}
                            >
                              <span>
                                <i>
                                  {r.type}
                                  {r.level ? ` · ${r.level}` : ''}
                                </i>
                                {r.name}
                                <small>{r.summary}</small>
                                <em
                                  className={`badge ${provenanceClass(r.source)}`}
                                >
                                  {r.source}
                                </em>
                              </span>
                              <ChevronRight />
                            </button>
                          ))}
                        </section>
                      ))}
                </div>
              </section>
            </div>
          )}
          <footer>
            <strong>EQLSaK knowledge policy</strong> User-verified EQL always
            outranks EQL sources; EQL sources always outrank legacy EverQuest
            assumptions. Last structured from the master chat: Aug 29, 2026.
            <details className="releasepolicy">
              <summary>Release, privacy, and accuracy safeguards</summary>
              <div>
                <p><b>Unofficial project.</b> EQLSaK is a fan-made community reference and is not affiliated with, endorsed by, or sponsored by Daybreak Game Company.</p>
                <p><b>Local privacy.</b> Character profiles stay in this browser. Imported log files are processed on the player’s device and are not uploaded by this version.</p>
                <p><b>Accuracy.</b> User-Verified EQL records take priority. Proxy coordinates, legacy records, and incomplete routes remain visibly labeled and must not be represented as exact.</p>
                <p><b>Open source.</b> EQLSaK application code is licensed under MIT so the player community may inspect, copy, improve, and redistribute it. <a href="/downloads/eqlsak-source-v52.zip" download>Download the source snapshot</a>. Artwork, game data, trademarks, and third-party material retain their separate rights and provenance.</p>
                <p><b>Public-release lock.</b> Public launch remains blocked until core journeys pass, external references respond, and every release-critical location is either verified or clearly excluded from exact guidance.</p>
              </div>
            </details>
          </footer>
        </div>
      </section>
      <nav className="mobile-primary-nav" aria-label="Mobile tools">
        <button type="button" className={tab === 'Character Lab' && characterLabFocus === 'character' ? 'active' : ''} onClick={() => { setCharacterLabFocus('character'); setTab('Character Lab'); }}><UserRound aria-hidden="true" />Character</button>
        <button type="button" className={tab === 'Atlas' ? 'active' : ''} onClick={() => setTab('Atlas')}><Map aria-hidden="true" />Map</button>
        <button type="button" className={tab === 'Loot' ? 'active' : ''} onClick={() => setTab('Loot')}><Swords aria-hidden="true" />Loot</button>
        <button type="button" className={tab === 'Character Lab' && characterLabFocus === 'faction' ? 'active' : ''} onClick={() => { setCharacterLabFocus('faction'); setTab('Character Lab'); window.setTimeout(() => document.querySelector('.labframework')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}><ShieldCheck aria-hidden="true" />Faction</button>
        <button type="button" className={tab === 'Manual' && query === 'quest' ? 'active' : ''} onClick={() => { setQuery('quest'); setTab('Manual'); }}><BookOpen aria-hidden="true" />Quest</button>
        <button type="button" onClick={() => { setTab('Quick'); window.setTimeout(() => globalSearch.current?.focus(), 50); }}><Search aria-hidden="true" />Search</button>
      </nav>
      {selected && (
        <div
          className="overlay"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter') setSelected(null);
          }}
        >
          <dialog open className="detail">
            <button className="close" onClick={() => setSelected(null)}>
              <X />
            </button>
            <span className={`badge ${provenanceClass(selected.source)}`}>
              {selected.source}
            </span>
            <small>
              {selected.type}
              {selected.level ? ` · LEVEL ${selected.level}` : ''}
            </small>
            <h2>{selected.name}</h2>
            <p>{selected.summary}</p>
            {selected.details && (
              <ul>
                {selected.details.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {selected.mob && (
              <button
                className="linktrail"
                onClick={() => setQuery(selected.mob!)}
              >
                <Swords />
                Mob: {selected.mob}
              </button>
            )}
            {selected.zone && (
              <button
                className="linktrail"
                onClick={() => {
                  setQuery(selected.zone!);
                  setTab('Atlas');
                  setSelected(null);
                }}
              >
                <Map />
                Zone: {selected.zone}
              </button>
            )}
            <div className="trail">
              <CircleDot /> {selected.type} <ChevronRight />{' '}
              {selected.mob || 'field record'} <ChevronRight />{' '}
              {selected.zone || 'EQL-wide'}
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
