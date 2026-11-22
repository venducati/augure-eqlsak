export const statNames = ['STR','STA','AGI','DEX','WIS','INT','CHA','AC','HP','Mana'] as const;
export type Stat = typeof statNames[number];
export type StatBlock = Record<Stat, number>;
export const emptyStats = (): StatBlock => Object.fromEntries(statNames.map((stat) => [stat, 0])) as StatBlock;
export const statValue = (input: string) => {
  const value = Number(input);
  return Number.isFinite(value) ? Math.max(-1_000_000, Math.min(1_000_000, value)) : 0;
};
export function gearDelta(pieces: { bonuses: StatBlock; replaced: StatBlock }[]) {
  const totals = emptyStats();
  for (const piece of pieces) for (const stat of statNames) totals[stat] += piece.bonuses[stat] - piece.replaced[stat];
  return totals;
}
