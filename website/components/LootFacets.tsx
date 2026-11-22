// Faceted loot explorer for the Loot tab: filter the EQLWiki item catalog by
// class, slot, and desired +stats, joined with measured combat-log evidence.
// Deterministic and offline: every facet narrows shipped data; no query ever
// leaves the browser. The catalog is a multi-MB static asset fetched once at
// runtime (same /data/ path the service worker can cache) — never bundled.
import { useEffect, useMemo, useState } from 'react';
import {
  readCatalog,
  joinMeasured,
  filterCatalog,
  CLASS_LABELS,
  type CatalogItem,
} from '@/lib/item-catalog';

const CATALOG_URL = '/data/eqlwiki-items.json';

const CODE_TO_LABEL = CLASS_LABELS;

const SLOT_CHOICES = [
  ['PRIMARY', 'Primary'], ['SECONDARY', 'Secondary'], ['RANGE', 'Range'], ['AMMO', 'Ammo'],
  ['HEAD', 'Head'], ['FACE', 'Face'], ['CHEST', 'Chest'], ['ARMS', 'Arms'], ['WRIST', 'Wrist'],
  ['HANDS', 'Hands'], ['LEG', 'Legs'], ['FEET', 'Feet'], ['WAIST', 'Waist'], ['NECK', 'Neck'],
  ['EAR', 'Ears'], ['FINGER', 'Fingers'], ['BACK', 'Back'], ['SHIRT', 'Shirt'], ['ANKLE', 'Ankles'],
];

const STAT_CHOICES = [
  ['STR', 'STR'], ['STA', 'STA'], ['AGI', 'AGI'], ['DEX', 'DEX'], ['WIS', 'WIS'], ['INT', 'INT'],
  ['CHA', 'CHA'], ['HP', 'HP'], ['MANA', 'Mana'], ['HASTE', 'Haste'], ['MSV', 'MR'], ['SR', 'SR'],
];

function Chip({ active, label, onClick, title }: { active: boolean; label: string; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      className={active ? 'facetchip active' : 'facetchip'}
      onClick={onClick}
      aria-pressed={active}
      title={title}
    >
      {label}
    </button>
  );
}

export function LootFacets({ lootIndex, onOpenItem }: { lootIndex: { name: string; sightings: { mob: string; seen: number }[] }[]; onOpenItem: (name: string) => void }) {
  const [rawCatalog, setRawCatalog] = useState<CatalogItem[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
        return response.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        setRawCatalog(readCatalog(payload));
      })
      .catch(() => {
        if (!cancelled) setCatalogFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalog = useMemo(() => {
    if (!rawCatalog) return [];
    const items = [...rawCatalog];
    joinMeasured(items, lootIndex);
    return items;
  }, [rawCatalog, lootIndex]);

  const [classes, setClasses] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [measuredOnly, setMeasuredOnly] = useState(false);
  const [questFlagged, setQuestFlagged] = useState(false);
  const [text, setText] = useState('');
  const [limit, setLimit] = useState(48);

  const toggle = (list: string[], setter: (v: string[]) => void, value: string) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const activeCount = classes.length + slots.length + wants.length + (measuredOnly ? 1 : 0) + (questFlagged ? 1 : 0) + (text.trim() ? 1 : 0);
  const results = useMemo(
    () => filterCatalog(catalog, { text, classes, slots, wants, measuredOnly, questFlagged, max: limit }),
    [catalog, text, classes, slots, wants, measuredOnly, questFlagged, limit],
  );
  const anyFilter = activeCount > 0;
  const shown = anyFilter ? results : [];

  function statSummary(item: CatalogItem): string {
    const parts: string[] = [];
    if (item.ac !== null) parts.push(`AC ${item.ac}`);
    if (item.dmg !== null) parts.push(`${item.dmg} dmg`);
    if (item.hp) parts.push(`HP +${item.hp}`);
    if (item.mana) parts.push(`Mana +${item.mana}`);
    for (const [key, label] of [['STR', 'STR'], ['STA', 'STA'], ['AGI', 'AGI'], ['DEX', 'DEX'], ['WIS', 'WIS'], ['INT', 'INT'], ['CHA', 'CHA'], ['HASTE', 'Haste'], ['MSV', 'MR']] as const) {
      const v = item.stats[key];
      if (v) parts.push(`${label} ${v > 0 ? '+' : ''}${v}`);
    }
    return parts.slice(0, 4).join(' · ');
  }

  return (
    <section className="lootfacets" aria-label="Faceted item finder">
      <header>
        <div>
          <small>FIND IT BY WHAT IT DOES</small>
          <h3>Facet the full EQL catalog</h3>
        </div>
        <span className="facetcount">
          {catalogFailed
            ? 'catalog unavailable offline'
            : catalog.length
              ? `${catalog.length.toLocaleString()} catalogued items`
              : 'loading full catalog…'}
        </span>
      </header>

      <div className="facetgroups">
        <div className="facetgroup" role="group" aria-label="Filter by class">
          <b>Class</b>
          <div>{Object.entries(CODE_TO_LABEL).map(([code, label]) => (
            <Chip key={code} label={label} active={classes.includes(code)} onClick={() => toggle(classes, setClasses, code)} title={`Items usable by ${label} (includes ALL-class items)`} />
          ))}</div>
        </div>
        <div className="facetgroup" role="group" aria-label="Filter by equipment slot">
          <b>Slot</b>
          <div>{SLOT_CHOICES.map(([code, label]) => (
            <Chip key={code} label={label} active={slots.includes(code)} onClick={() => toggle(slots, setSlots, code)} title={`Slots matching ${label}`} />
          ))}</div>
        </div>
        <div className="facetgroup" role="group" aria-label="Filter by desired bonus stats">
          <b>Wants (must have all)</b>
          <div>{STAT_CHOICES.map(([code, label]) => (
            <Chip key={code} label={label} active={wants.includes(code)} onClick={() => toggle(wants, setWants, code)} title={`Item must grant a bonus to ${label}`} />
          ))}</div>
        </div>
        <div className="facetgroup" role="group" aria-label="Evidence and flag filters">
          <b>Evidence</b>
          <div>
            <Chip label="Measured drops only" active={measuredOnly} onClick={() => setMeasuredOnly((v) => !v)} title="Only items witnessed dropping in combat logs (EQL Source)" />
            <Chip label="Quest-connected" active={questFlagged} onClick={() => setQuestFlagged((v) => !v)} title="Marked as quest items or named in quest reward lists" />
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Contains… (name, mob, zone)" aria-label="Text filter inside the facet results" />
            {(anyFilter) && (
              <button type="button" className="facetclear" onClick={() => { setClasses([]); setSlots([]); setWants([]); setMeasuredOnly(false); setQuestFlagged(false); setText(''); setLimit(48); }}>
                Clear facets
              </button>
            )}
          </div>
        </div>
      </div>

      {anyFilter && (
        <p className="facetsummary" aria-live="polite">
          {results.length.toLocaleString()} item{results.length === 1 ? '' : 's'} match
          {results.length > limit ? ` (showing ${limit})` : ''} — classes fall back to ALL-class items automatically.
        </p>
      )}

      {!anyFilter && (
        <p className="facethint">Pick a class, slot, or a couple of +stats to narrow the catalog. Green badges mark items with measured combat-log drops; everything else is wiki-asserted, never guessed.</p>
      )}

      {anyFilter && (
        <div className="facetgrid">
          {shown.slice(0, limit).map((item) => (
            <button type="button" key={item.name} onClick={() => onOpenItem(item.name)} title={`Open ${item.name} in the measured evidence search`}>
              <span>
                <b>{item.name}</b>
                <small>{item.slots.slice(0, 2).join('/') || 'Worn/Other'}{item.skill ? ` · ${item.skill}` : ''}{item.drops[0] ? ` · ${item.drops[0].zone}` : ''}</small>
                <em>{statSummary(item) || item.notes.slice(0, 48) || '—'}</em>
              </span>
              <span className="facetbadges">
                {item.measured && <i className="fmeasured">{item.observations.toLocaleString()} obs</i>}
                {item.flags.includes('NoRent') && !item.flags.includes('Faded') && <i className="fnorent">No rent</i>}
                {(item.flags.includes('Quest') || item.quests.length > 0) && <i className="fquest">Quest</i>}
              </span>
            </button>
          ))}
          {results.length > limit && (
            <button type="button" className="facetmore" onClick={() => setLimit((n) => n + 48)}>Show 48 more ({(results.length - limit).toLocaleString()} left)</button>
          )}
          {results.length === 0 && <p className="facetempty">No item satisfies every facet at once. Try removing a “want” or widening the class.</p>}
        </div>
      )}
    </section>
  );
}
