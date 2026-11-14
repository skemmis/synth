# Synth (working title)

A 2D survival and crafting game with no recipe list. Every object is a small lattice of raw-material nodes,
and what it does comes only from the physics of those materials. You describe what you need to a
synthesizer, it proposes a grid of letters, and the simulation decides whether it works. At night, creatures
built from the same materials evolve against a copy of your base, then the best three raid it.

This repository is the proof of concept described in the PRD. `DECISIONS.md` logs every default chosen,
every rule added and every gate result.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the printed address. Controls: drag with the mouse, `Q`/`E` rotate what you hold, `A`/`D` or drag
the sky to look around, right-click breaks an object back into materials, `Space` pauses.

The synthesizer works offline with a small set of shapes. For free-form requests, open **Talk → Settings**
and paste an Anthropic API key. The key is kept in the browser's local settings only.

## Tests and gates

```bash
npm test
```

runs every milestone gate that can run quickly, as headless scenarios (bucket holds water, rope swings, seed
crawlers cross ground, export/import, the ten synthesizer requests against recorded replies).

```bash
npm run gate:m4
```

runs the five-seed, five-night evolution gate (about four minutes).

```bash
ANTHROPIC_API_KEY=... npm run gate:live
```

runs the ten synthesizer requests against the live API. This has not been run yet.

## Layout

| Folder | Contents | Rule |
| --- | --- | --- |
| `src/sim` | Nodes, bonds, water, collisions, damage, materials table, grids, test bench | Pure TypeScript, no DOM, no dependencies |
| `src/evo` | Genomes, mutation, trials, niche archive, worker pool, raids | Imports only `sim` |
| `src/synth` | Prompt building, provider adapters, validation, cache | No simulation logic |
| `src/game` | Rendering, input, hand, day and night flow, recipe book, saves, sound | The only code that touches the DOM |
| `tests` | Gate tests, one file per milestone | |
| `scripts` | Playtest helpers, the seed search, the balance campaign | |
| `builds` | Single-file playable snapshots of each milestone and variant | |

Every tunable number is in `src/sim/materials.ts` (one row per material), `src/sim/config.ts`, or the
`EVO_CONFIG` block in `src/evo/trial.ts`.

## Builds

```bash
npm run build:single
```

writes one self-contained `dist/index.html`. `VITE_VARIANT=garden` or `VITE_VARIANT=tame` selects a variant.
