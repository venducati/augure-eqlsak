// Faceted loot explorer for the Loot tab: filter the EQLWiki item catalog by
// class, slot, desired +stats, and quest linkage — quest rows carry giver,
// start zone, level and Epic/Regular kind from the synced quest pages.
// Deterministic and offline: every facet narrows shipped data; no query ever
// leaves the browser. The catalog is a multi-MB static asset fetched once at
// runtime (same /data/ path the service worker can cache) — never bundled.
import { useEffect, useMemo, useState } from 'react';
import {
  readCatalog,
  readQuests,
  joinMeasured,
  attachQuests,
  filterCatalog,
  CLASS_LABELS,
  type CatalogItem,
  type QuestDetail,
} from '@/lib/item-catalog';

const CATALOG_URL = '/data/eqlwiki-items.json';
const QUESTS_URL = '/data/eqlwiki-quests.json';

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

const KIND_LABEL: Record<QuestDetail['kind'], string> = { epic: 'Epic Quest', heroic: 'Heroic Quest', regular: 'Regular Quest' };

function questMetaLine(q: QuestDetail): string {
  const bits: string[] = [];
  if (q.giver) bits.push(`Giver: ${q.giver}${q.startZone ? ` (${q.startZone})` : ''}`);
  else if (q.startZone) bits.push(`Starts in ${q.startZone}`);
  if (q.level) bits.push(`${q.levelKind === 'min' ? 'Min level' : 'Rec. level'} ${q.level}`);
  if (q.classes.length && !/^(all)$/i.test(q.classes.join(''))) bits.push(q.classes.slice(0, 4).join(', ') + (q.classes.length > 4 ? '…' : ''));
  return bits.join(' · ') || 'Details sparse on the wiki page';
}

function QuestRow({ quest, onOpenItem }: { quest: QuestDetail; onOpenItem: (name: string) => void }) {
  return (
    <div className={`fqcard fkind-${quest.kind}`}>
      <header>
        <b>{quest.name}</b>
        <i className={`fkindspec ${quest.kind}`}>{KIND_LABEL[quest.kind]}</i>
      </header>
      <p>{questMetaLine(quest)}</p>
      {quest.givers.length > 1 && <p className="fqmore">Also starts from: {quest.givers.slice(1, 4).join(', ')}</p>}
      {quest.rewards.length > 0 && (
        <p className="fqrewards">
          Rewards:{' '}
          {quest.rewards.map((r, idx) => (
            <span key={r}>
              {idx > 0 ? ', ' : ''}
              <button type="button" onClick={() => onOpenItem(r)} title={`Look up ${r} in the measured evidence search`}>{r}</button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function LootFacets({ lootIndex, onOpenItem }: { lootIndex: { name: string; sightings: { mob: string; seen: number }[] }[]; onOpenItem: (name: string) => void }) {
  const [rawCatalog, setRawCatalog] = useState<CatalogItem[] | null>(null);
  const [questMap, setQuestMap] = useState<ReturnType<typeof readQuests> | null>(null);
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

  // Non-fatal: without the quest sidecar the finder still works, minus detail
  // rows, epic classification, and the quest half of text search.
  useEffect(() => {
    let cancelled = false;
    fetch(QUESTS_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Quest request failed (${response.status})`))))
      .then((payload: unknown) => { if (!cancelled) setQuestMap(readQuests(payload)); })
      .catch(() => { /* degrades quietly */ });
    return () => { cancelled = true; };
  }, []);

  const catalog = useMemo(() => {
    if (!rawCatalog) return [];
    const items = [...rawCatalog];
    joinMeasured(items, lootIndex);
    if (questMap) attachQuests(items, questMap);
    return items;
  }, [rawCatalog, lootIndex, questMap]);

  const [classes, setClasses] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [measuredOnly, setMeasuredOnly] = useState(false);
  const [questFlagged, setQuestFlagged] = useState(false);
  const [epicOnly, setEpicOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [limit, setLimit] = useState(48);

  const toggle = (list: string[], setter: (v: string[]) => void, value: string) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const clearAll = () => { setClasses([]); setSlots([]); setWants([]); setMeasuredOnly(false); setQuestFlagged(false); setEpicOnly(false); setText(''); setLimit(48); setExpanded(null); };

  const activeCount = classes.length + slots.length + wants.length + (measuredOnly ? 1 : 0) + (questFlagged ? 1 : 0) + (epicOnly ? 1 : 0) + (text.trim() ? 1 : 0);
  const results = useMemo(
    () => filterCatalog(catalog, { text, classes, slots, wants, measuredOnly, questFlagged, epicOnly, max: limit }),
    [catalog, text, classes, slots, wants, measuredOnly, questFlagged, epicOnly, limit],
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

  const bestKind = (item: CatalogItem): QuestDetail['kind'] | null => {
    if (!item.questDetails.length) return null;
    return item.questDetails[0].kind;
  };

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
              ? `${catalog.length.toLocaleString()} catalogued items${questMap ? ` · ${questMap.size.toLocaleString()} quests mapped` : ''}`
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
          <b>Evidence & quests</b>
          <div>
            <Chip label="Measured drops only" active={measuredOnly} onClick={() => setMeasuredOnly((v) => !v)} title="Only items witnessed dropping in combat logs (EQL Source)" />
            <Chip label="Quest-connected" active={questFlagged} onClick={() => setQuestFlagged((v) => !v)} title="Marked as quest items or named in quest reward lists" />
            <Chip label="Epic/heroic only" active={epicOnly} onClick={() => questMap && setEpicOnly((v) => !v)} title={questMap ? 'Items tied to a class epic or heroic quest (classified by EQLWiki)' : 'Available once the quest mapping loads'} />
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Contains… (name, mob, zone, quest, giver)" aria-label="Text filter inside the facet results" />
            {anyFilter && <button type="button" className="facetclear" onClick={clearAll}>Clear facets</button>}
          </div>
        </div>
      </div>

      {anyFilter && (
        <p className="facetsummary" aria-live="polite">
          {results.length.toLocaleString()} item{results.length === 1 ? '' : 's'} match
          {results.length > limit ? ` (showing ${limit})` : ''} — tap a card to see its quest giver, zone and quest type.
        </p>
      )}

      {!anyFilter && (
        <p className="facethint">Pick a class, slot, or a couple of +stats to narrow the catalog. Green badges mark items with measured combat-log drops; gold badges mark epic-quest rewards. Quest kind, giver and zone come from EQLWiki and are labelled as wiki-asserted, never guessed.</p>
      )}

      {anyFilter && (
        <div className="facetgrid">
          {shown.slice(0, limit).map((item) => {
            const kind = bestKind(item);
            const isOpen = expanded === item.name;
            return (
              <div key={item.name} className="fcard">
                <button
                  type="button"
                  className="fcardmain"
                  onClick={() => (item.questDetails.length ? setExpanded(isOpen ? null : item.name) : onOpenItem(item.name))}
                  title={item.questDetails.length ? 'Show quest details' : `Open ${item.name} in the measured evidence search`}
                >
                  <span>
                    <b>{item.name}</b>
                    <small>{item.slots.slice(0, 2).join('/') || 'Worn/Other'}{item.skill ? ` · ${item.skill}` : ''}{item.drops[0] ? ` · ${item.drops[0].zone}` : ''}</small>
                    <em>{statSummary(item) || item.notes.slice(0, 48) || '—'}</em>
                  </span>
                  <span className="facetbadges">
                    {item.measured && <i className="fmeasured">{item.observations.toLocaleString()} obs</i>}
                    {item.flags.includes('NoRent') && !item.flags.includes('Faded') && <i className="fnorent">No rent</i>}
                    {kind && <i className={`fquest ${kind}`}>{kind === 'epic' ? 'Epic' : kind === 'heroic' ? 'Heroic' : 'Quest'}</i>}
                    {(item.flags.includes('Quest') || item.quests.length > 0) && !kind && <i className="fquest unresolved">Quest?</i>}
                    {item.questDetails.length > 0 && <i className="fexpand">{isOpen ? '▾' : '▸'}</i>}
                  </span>
                </button>
                {isOpen && (
                  <div className="fqbody">
                    {item.questDetails.map((q) => <QuestRow key={q.name} quest={q} onOpenItem={onOpenItem} />)}
                    {item.questDetails.length === 0 && item.quests.length > 0 && (
                      <p className="fqmore">Linked to {item.quests.length} quest name(s) the wiki has no page for: {item.quests.slice(0, 3).join(', ')}{item.quests.length > 3 ? '…' : ''}</p>
                    )}
                    <button type="button" className="fopcode" onClick={() => onOpenItem(item.name)}>Open {item.name} in measured evidence search →</button>
                  </div>
                )}
              </div>
            );
          })}
          {results.length > limit && (
            <button type="button" className="facetmore" onClick={() => setLimit((n) => n + 48)}>Show 48 more ({(results.length - limit).toLocaleString()} left)</button>
          )}
          {results.length === 0 && <p className="facetempty">No item satisfies every facet at once. Try removing a “want” or widening the class.</p>}
        </div>
      )}
    </section>
  );
}
