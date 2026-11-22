# EQL Swiss Army Knife (EQLSaK)

EQLSaK is an unofficial, community-built companion for EverQuest Legends. It combines fast-reference play tools, searchable world and loot information, local log reading, character profiles, travel guidance, and experimental 3D dungeon exploration.

## Community source

The application code is open source under the [MIT License](LICENSE). You may use, copy, modify, redistribute, and build on it. Contributions that improve EQL-specific accuracy, accessibility, performance, maps, and verified NPC placement are welcome.

The MIT license covers the software source code. Game names, factual game data, trademarks, and third-party material remain the property of their respective owners. Artwork and data files require their own provenance and permission; see [OPEN_SOURCE.md](OPEN_SOURCE.md).

## Accuracy model

EQLSaK does not silently treat old EverQuest or P99 information as verified EQL behavior. Records use these provenance levels:

1. User-Verified EQL
2. EQL-specific source
3. Legacy EQ unverified

Proxy coordinates and unverified legacy information must remain visibly labeled. See [RELEASE_READINESS.md](RELEASE_READINESS.md) before distributing a public build.

## Local development

Requirements: Node.js 22.13 or newer.

```text
npm install
npm run dev
```

Before proposing a release:

```text
npm run release:check
npm run lint
npx tsc --noEmit
npm run build
```

## Privacy

Character profiles are kept in the browser. Imported logs are read locally by the current application and are not uploaded.

## Crafting and tradeskills

The Crafting workbench includes a bundled, offline recipe catalog with search by recipe, result, ingredient, skill, container, and era. Players can filter by trivial range, inspect exact source links, and save recipes to a local craft plan that totals the ingredients needed for one attempt of each selected combine.

The bundled recipe data is attributed separately in [data/EQL_RECIPES_LICENSE.md](data/EQL_RECIPES_LICENSE.md). Its current records are labeled **Legacy EQ unverified** until they are confirmed in EverQuest Legends; the application never presents those records as measured EQL facts.

## Independence

EQLSaK is a fan-made project and is not affiliated with, endorsed by, or sponsored by Daybreak Game Company.
