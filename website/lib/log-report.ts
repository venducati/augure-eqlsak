import { parseCombatLine } from './combat-meter.ts';
export type Kind = 'damage' | 'chat' | 'loot' | 'faction' | 'system' | 'text';
export type Event = {
  id: number;
  timestamp: string;
  date: number | null;
  kind: Kind;
  actor: string;
  target: string;
  detail: string;
  raw: string;
  amount?: number;
  method?: string;
  critical?: boolean;
};
export type Encounter = {
  id: number;
  target: string;
  start: number;
  end: number;
  damage: Event[];
  slain: boolean;
};

const loot =
  /^(?:--)?(.+?) (?:has|have) looted (.+?)(?: from .+?)?[.!]?(?:--)?$/i;
const faction =
  /^(?:Your )?faction standing with (.+?) has gotten (better|worse)[.!]?$/i;
const chat =
  /^(?:You|(.+?)) (say|says|tell|tells|shout|shouts|auction|auctions|ooc|guild|group),? ['“](.+?)['”]$/i;
const damage = /^(.+?) (hit|hits|slash(?:es)?|crush(?:es)?|pierce(?:s)?|bash(?:es)?|kick(?:s)?|strike(?:s)?|bite(?:s)?|claw(?:s)?|punch(?:es)?|cleave(?:s)?) (.+?) for (\d+) points? of (?:non-melee )?damage[.!]?(?: \(Critical\))?$/i;
const slain = /^(?:You have slain (.+?)|(.+?) has been slain by (.+?))[.!]$/i;

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function parseLog(text: string, firstId = 0) {
  const events: Event[] = [];
  let id = firstId;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.length > 8192) throw new Error('This file contains unusually long lines. Choose a character log rather than a client data table.');
    const stamped = line.match(/^\[([^\]]+)\]\s*(.*)$/),
      timestamp = stamped?.[1] || '',
      body = (stamped?.[2] || line).trim(),
      date = parseDate(timestamp);
    let m: RegExpMatchArray | null;
    const combat=parseCombatLine(line);
    if(combat&&['melee','DD','DoT','damage'].includes(combat.kind))
      events.push({id:id++,timestamp,date,kind:'damage',actor:combat.actor,target:combat.target,detail:`${combat.amount} damage`,amount:combat.amount,method:combat.kind === 'melee' ? combat.ability : combat.kind+' · '+combat.ability,critical:/\(Critical\)/i.test(body),raw:body});
    else if ((m = body.match(damage)) && Number.isSafeInteger(Number(m[4])))
      events.push({ id:id++, timestamp, date, kind:'damage', actor:m[1], target:m[3], detail:`${m[4]} damage`, amount:Number(m[4]), method:m[2].toLowerCase().replace(/s$/,''), critical:/\(Critical\)/i.test(body), raw:body });
    else if ((m = body.match(slain)))
      events.push({ id:id++, timestamp, date, kind:'system', actor:m[3] || 'You', target:m[1] || m[2], detail:'slain', raw:body });
    else if ((m = body.match(loot)))
      events.push({
        id: id++,
        timestamp,
        date,
        kind: 'loot',
        actor: m[1],
        target: m[2],
        detail: 'looted',
        raw: body,
      });
    else if ((m = body.match(faction)))
      events.push({
        id: id++,
        timestamp,
        date,
        kind: 'faction',
        actor: 'You',
        target: m[1],
        detail: m[2].toLowerCase(),
        raw: body,
      });
    else if ((m = body.match(chat)))
      events.push({
        id: id++,
        timestamp,
        date,
        kind: 'chat',
        actor: m[1] || 'You',
        target: m[2],
        detail: m[3],
        raw: body,
      });
    else if (
      /experience|entered|zone|camp|who|friend|group|guild|tell|say|auction|ooc/i.test(
        body,
      )
    )
      events.push({
        id: id++,
        timestamp,
        date,
        kind: 'system',
        actor: 'EQL',
        target: '',
        detail: body,
        raw: body,
      });
    else
      events.push({
        id: id++,
        timestamp,
        date,
        kind: 'text',
        actor: '',
        target: '',
        detail: body,
        raw: body,
      });
  }
  return events;
}

export function buildEncounters(events: Event[]) {
  const encounters: Encounter[] = [];
  const byTarget = new Map<string, Encounter>();
  for (const event of events) {
    const key = event.target.toLowerCase();
    if (event.kind === 'damage' && event.date !== null && !/^(you|yourself)$/i.test(event.target)) {
      // Hits taken by a known opponent belong to its fight; its return hits
      // must not become separate fights against a party member.
      const attacking = byTarget.get(event.actor.toLowerCase());
      if (attacking && event.date - attacking.end <= 25000 && event.date >= attacking.end) continue;
      let active = byTarget.get(key);
      if (!active || event.date - active.end > 25000 || event.date < active.start) {
        active = { id: encounters.length, target: event.target, start: event.date, end: event.date, damage: [], slain: false };
        encounters.push(active); byTarget.set(key, active);
      }
      active.damage.push(event); active.end = Math.max(active.end, event.date);
    } else if (event.detail === 'slain') {
      const active = byTarget.get(key);
      if (active) { active.end = Math.max(active.end, event.date ?? active.end); active.slain = true; byTarget.delete(key); }
    }
  }
  return encounters;
}

// Every hit belongs to one bucket, including the final timestamp.
export function encounterBuckets(encounter: Encounter, count = 12) {
  const duration = Math.max(1, encounter.end - encounter.start);
  const bins = Array.from({ length: Math.max(1, Math.min(count, Math.ceil(duration / 1000) + 1)) }, () => 0);
  for (const event of encounter.damage) {
    const index = Math.min(bins.length - 1, Math.max(0, Math.floor(((event.date ?? encounter.start) - encounter.start) / duration * bins.length)));
    bins[index] += event.amount || 0;
  }
  return bins;
}

export async function readLogFile(file: Blob, options: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {}) {
  const events: Event[] = [], decoder = new TextDecoder();
  let pending = '';
  for (let start = 0; start < file.size; start += 262144) {
    options.signal?.throwIfAborted();
    const end = Math.min(file.size, start + 262144);
    const bytes = await file.slice(start, end).arrayBuffer();
    options.signal?.throwIfAborted();
    pending += decoder.decode(bytes, { stream: end < file.size });
    const split = end === file.size ? pending.length : pending.lastIndexOf('\n') + 1;
    const rows = parseLog(pending.slice(0, split), events.length);
    pending = pending.slice(split);
    if (pending.length > 8192) throw new Error('This is not a supported character log: a text line is too long.');
    if (events.length + rows.length > 100000) throw new Error('This log has more than 100,000 lines. Choose a shorter session export, or use the live Combat Meter for a long-running log.');
    for (const row of rows) events.push(row);
    options.onProgress?.(Math.round(end / Math.max(1, file.size) * 100));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  options.signal?.throwIfAborted();
  if (!events.length) throw new Error('This file is empty. Choose a log containing recorded game messages.');
  return events;
}
