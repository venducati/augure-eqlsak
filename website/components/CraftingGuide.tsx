'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Hammer, Plus, Search, ShoppingBasket, X } from 'lucide-react';
import recipeSnapshot from '@/data/eql-recipes.json';

type Recipe = (typeof recipeSnapshot.records)[number];
type Variant = Recipe['variants'][number];
type RecipeRow = { id: string; recipe: Recipe; variant: Variant; trivial: number | null };

const skills = [...new Set(recipeSnapshot.records.flatMap((recipe) => recipe.variants.map((variant) => variant.skill)))].sort();

function numericTrivial(value: string | number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function sourceLabel(evidence: string) {
  if (evidence === 'user-verified') return 'User-Verified EQL';
  if (evidence === 'confirmed') return 'EQL-specific source';
  return 'Legacy EQ unverified';
}

const rows: RecipeRow[] = recipeSnapshot.records.flatMap((recipe) => recipe.variants.map((variant, index) => ({
  id: `${recipe.slug}:${index}`,
  recipe,
  variant,
  trivial: numericTrivial(variant.trivial),
})));

export default function CraftingGuide() {
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('All tradeskills');
  const [minTrivial, setMinTrivial] = useState('');
  const [maxTrivial, setMaxTrivial] = useState('');
  const [sort, setSort] = useState<'name' | 'trivial'>('name');
  const [page, setPage] = useState(0);
  const [plan, setPlan] = useState<string[]>([]);
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('eqlsak-craft-plan-v1') || '[]');
      if (Array.isArray(saved) && saved.every((value) => typeof value === 'string')) setPlan(saved.slice(0, 100));
    } catch {}
    setPlanReady(true);
  }, []);
  useEffect(() => {
    if (!planReady) return;
    try { localStorage.setItem('eqlsak-craft-plan-v1', JSON.stringify(plan)); } catch {}
  }, [plan, planReady]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const minimum = minTrivial === '' ? null : Number(minTrivial);
    const maximum = maxTrivial === '' ? null : Number(maxTrivial);
    return rows.filter((row) => {
      if (skill !== 'All tradeskills' && row.variant.skill !== skill) return false;
      if (minimum !== null && (row.trivial === null || row.trivial < minimum)) return false;
      if (maximum !== null && (row.trivial === null || row.trivial > maximum)) return false;
      if (!needle) return true;
      return `${row.recipe.name} ${row.variant.skill} ${row.variant.container} ${row.variant.components.map((item) => item.name).join(' ')} ${row.recipe.eras.join(' ')}`.toLowerCase().includes(needle);
    }).sort((a, b) => sort === 'trivial'
      ? (a.trivial ?? Number.MAX_SAFE_INTEGER) - (b.trivial ?? Number.MAX_SAFE_INTEGER) || a.recipe.name.localeCompare(b.recipe.name)
      : a.recipe.name.localeCompare(b.recipe.name));
  }, [query, skill, minTrivial, maxTrivial, sort]);

  useEffect(() => setPage(0), [query, skill, minTrivial, maxTrivial, sort]);
  const visible = results.slice(page * 36, page * 36 + 36);
  const planned = rows.filter((row) => plan.includes(row.id));
  const ingredients = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of planned) for (const item of row.variant.components) totals.set(item.name, (totals.get(item.name) || 0) + item.quantity);
    return [...totals].sort(([a], [b]) => a.localeCompare(b));
  }, [planned]);

  function togglePlan(id: string) {
    setPlan((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-100));
  }

  return (
    <section className="crafting-guide">
      <header className="crafting-hero">
        <div><small>OFFLINE RECIPE WORKBENCH</small><h2>Crafting & tradeskills</h2><p>Find a recipe by result or ingredient, narrow it by skill and trivial value, then build a shopping list that stays on this device.</p></div>
        <div className="crafting-count"><Hammer aria-hidden="true" /><b>{recipeSnapshot.records.length.toLocaleString()}</b><span>recipe records</span></div>
      </header>

      <aside className="crafting-truth"><b>Evidence stays visible.</b> This catalog is adapted from EQL Wiki records through the EQL Helper public catalog. Its current recipe records are legacy/unverified for EQL, so verify valuable combines in game before committing rare materials.</aside>

      <section className="crafting-controls" aria-label="Recipe filters">
        <label className="craft-search"><span>Find a recipe or ingredient</span><div><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Fish Rolls, silk, metal bits…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear recipe search"><X /></button>}</div></label>
        <label><span>Tradeskill</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option>All tradeskills</option>{skills.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label><span>Minimum trivial</span><input type="number" min="0" inputMode="numeric" value={minTrivial} onChange={(event) => setMinTrivial(event.target.value)} placeholder="Any" /></label>
        <label><span>Maximum trivial</span><input type="number" min="0" inputMode="numeric" value={maxTrivial} onChange={(event) => setMaxTrivial(event.target.value)} placeholder="Any" /></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'trivial')}><option value="name">Recipe name</option><option value="trivial">Lowest trivial</option></select></label>
      </section>

      <div className="crafting-layout">
        <section className="recipe-results" aria-labelledby="recipe-results-title">
          <header><div><small>RECIPE INDEX</small><h3 id="recipe-results-title">{results.length.toLocaleString()} matching combines</h3></div><span>Catalog revision {recipeSnapshot.catalogRevision}</span></header>
          <div className="recipe-grid">{visible.map((row) => {
            const label = sourceLabel(row.recipe.evidence);
            const source = row.recipe.provenance[0];
            return <article key={row.id}>
              <header><span className="craft-sigil" aria-hidden="true">{row.variant.skill.slice(0, 2).toUpperCase()}</span><div><small>{row.variant.skill}</small><h4>{row.recipe.name}</h4></div><button type="button" className={plan.includes(row.id) ? 'planned' : ''} onClick={() => togglePlan(row.id)} title={plan.includes(row.id) ? 'Remove this recipe from the local craft plan' : 'Add this recipe to the local craft plan'}>{plan.includes(row.id) ? <X /> : <Plus />}<span>{plan.includes(row.id) ? 'Remove' : 'Plan'}</span></button></header>
              <dl><div><dt>Trivial</dt><dd>{row.variant.noFail ? 'No-fail' : row.variant.trivial || 'Unknown'}</dd></div><div><dt>Container</dt><dd>{row.variant.container}</dd></div><div><dt>Yield</dt><dd>{row.variant.yieldCount} × {row.variant.yieldName}</dd></div></dl>
              <section><b>Components</b><ul>{row.variant.components.length ? row.variant.components.map((item, index) => <li key={`${item.name}-${item.quantity}-${index}`}><span>{item.name}</span><em>× {item.quantity}</em></li>) : <li><span>No component rows recorded</span></li>}</ul></section>
              <footer><span className={`badge ${label === 'EQL-specific source' ? 'eql' : label === 'User-Verified EQL' ? 'verified' : 'legacy'}`}>{label}</span>{source?.uri && <a href={source.uri} rel="external" aria-label={`Open source page for ${row.recipe.name}`} title={`Open the source page here${source.revision ? ` · revision ${source.revision}` : ''}`}>Open source page <ExternalLink /></a>}</footer>
            </article>;
          })}</div>
          {!visible.length && <p className="crafting-empty">No recipe matches those filters. Clear a trivial limit or try an ingredient name.</p>}
          {results.length > 36 && <nav className="craft-pages" aria-label="Recipe result pages"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {page + 1} of {Math.ceil(results.length / 36)}</span><button type="button" disabled={(page + 1) * 36 >= results.length} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}
        </section>

        <aside className="craft-plan" aria-label="Local craft plan">
          <header><ShoppingBasket aria-hidden="true" /><div><small>LOCAL CRAFT PLAN</small><h3>{planned.length ? `${planned.length} planned ${planned.length === 1 ? 'combine' : 'combines'}` : 'Build a shopping list'}</h3></div>{planned.length > 0 && <button type="button" onClick={() => setPlan([])}>Clear</button>}</header>
          {planned.length ? <><div className="planned-recipes">{planned.map((row) => <button type="button" key={row.id} onClick={() => togglePlan(row.id)}><span><b>{row.recipe.name}</b><small>{row.variant.skill} · {row.variant.container}</small></span><X /></button>)}</div><section><h4>Ingredients to gather</h4><ul>{ingredients.map(([name, count]) => <li key={name}><span>{name}</span><b>× {count}</b></li>)}</ul></section></> : <p>Select <b>Plan</b> on any recipe. Ingredient quantities will be combined here and saved only in this browser.</p>}
          <footer>Counts cover one attempt of each planned recipe. Failures can consume ingredients, so bring extras for uncertain combines.</footer>
        </aside>
      </div>
    </section>
  );
}
