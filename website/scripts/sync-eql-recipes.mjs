import { writeFile } from 'node:fs/promises';

const endpoint = 'https://eql.gamertan.com/api/v1/recipes';
const headers = {
  Accept: 'application/json',
  'User-Agent': 'EQLSaK-companion/1.8 (self-hosted; set contact URL in fork)',
};

let cursor = '';
let revision = 0;
const records = [];
do {
  const url = new URL(endpoint);
  url.searchParams.set('limit', '200');
  url.searchParams.set('evidence', 'include-unverified');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`EQL Helper recipes returned ${response.status}`);
  const payload = await response.json();
  revision = payload.meta?.catalog_revision ?? revision;
  for (const recipe of payload.data ?? []) {
    records.push({
      name: recipe.name,
      slug: recipe.slug,
      evidence: recipe.evidence,
      eras: recipe.eras ?? [],
      provenance: (recipe.provenance ?? []).map((source) => ({
        source: source.source,
        uri: source.canonical_uri,
        revision: source.external_revision,
      })),
      variants: (recipe.variants ?? []).map((variant) => ({
        skill: variant.skill?.label ?? variant.skill?.target ?? 'Unknown',
        trivial: variant.trivial ?? null,
        noFail: Boolean(variant.no_fail),
        container: variant.container?.target ?? 'Unlisted container',
        yieldCount: variant.yield_count ?? 1,
        yieldName: variant.yield_name ?? recipe.name,
        components: (variant.components ?? []).map((component) => ({
          name: component.target,
          quantity: component.quantity ?? 1,
        })),
      })),
    });
  }
  cursor = payload.page?.next_cursor ?? '';
} while (cursor);

records.sort((a, b) => a.name.localeCompare(b.name));
const snapshot = {
  schema: 'eqlsak-recipes-v1',
  catalogRevision: revision,
  source: 'https://eql.gamertan.com/developers/api',
  rights: 'Wiki-derived structured material is reused under CC BY-SA 4.0; see data/EQL_RECIPES_LICENSE.md.',
  records,
};
await writeFile('data/eql-recipes.json', `${JSON.stringify(snapshot)}\n`);
console.log(`Saved ${records.length} recipes from catalog revision ${revision}.`);
