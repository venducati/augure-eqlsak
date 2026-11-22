import type { ImportedRow } from './character-report.ts';

export type AchievementState = 'complete' | 'open' | 'locked' | 'unknown';
export type AchievementEntry = { id:string; name:string; category:string; state:AchievementState; points?:number; detail?:string };

const clean = (value:string) => value.trim().replace(/^"|"$/g, '');
const key = (value:string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function stateFrom(fields:string[]):AchievementState {
  const joined = fields.join(' ').toLowerCase();
  if (/\b(complete|completed|earned|done)\b/.test(joined)) return 'complete';
  if (/\blocked\b/.test(joined)) return 'locked';
  if (/\b(open|active|available|in progress|incomplete)\b/.test(joined)) return 'open';
  return 'unknown';
}

export function parseAchievementReport(rows:ImportedRow[]):AchievementEntry[] {
  if (!rows.length) return [];
  const headerKeys = rows[0].fields.map(key);
  const looksLikeHeader = headerKeys.some((field) => ['achievement','achievementname','name','title'].includes(field)) && headerKeys.some((field) => ['status','state','completion','category','points','score','description'].includes(field));
  const indexFor = (choices:string[]) => headerKeys.findIndex((field) => choices.includes(field));
  const nameIndex=indexFor(['achievement','achievementname','name','title']), categoryIndex=indexFor(['category','group','section','type']), statusIndex=indexFor(['status','state','completion']), pointsIndex=indexFor(['points','score','achievementpoints']), detailIndex=indexFor(['description','detail','details','objective']), idIndex=indexFor(['id','achievementid']);
  return rows.slice(looksLikeHeader ? 1 : 0).map((row) => {
    const fields=row.fields.map(clean).filter(Boolean), explicitName=nameIndex>=0?clean(row.fields[nameIndex]||''):'';
    const candidates=fields.filter((field)=>! /^(complete|completed|open|locked|active|available|incomplete|in progress)$/i.test(field)&&!/^\d+$/.test(field));
    const name=explicitName||candidates[0]||'', statusText=statusIndex>=0?row.fields[statusIndex]||'':'', pointsText=pointsIndex>=0?row.fields[pointsIndex]||'':'';
    return { id:idIndex>=0?clean(row.fields[idIndex]||'')||String(row.id):String(row.id), name, category:categoryIndex>=0?clean(row.fields[categoryIndex]||'')||'Other':'Other', state:stateFrom(statusText?[statusText]:fields), points:/^\d+$/.test(pointsText.trim())?Number(pointsText):undefined, detail:detailIndex>=0?clean(row.fields[detailIndex]||'')||undefined:undefined } satisfies AchievementEntry;
  }).filter((entry)=>entry.name&&!/^(achievement|name|title)$/i.test(entry.name));
}
