// Turn ditch-crossing walkers into eaters on the real strip: heart tried in every cell, then hill-climb on an unguarded stash.
import fs from 'fs';
import { Rng } from '../packages/sim/src/rng.ts'; import { LAYOUT, stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts';
import { mutate, isViable, toRecipe, cellCount, type Genome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts';
import { makeArena } from '../packages/evo/src/evolve.ts'; import { SEEDS } from '../packages/evo/src/seeds.ts'; import { STASH_X } from '../packages/evo/src/scenario.ts';
const base = new World(stripTerrain()); spawnRecipe(base, RECIPES.berryStack, STASH_X, base.terrain.groundY(STASH_X) - 32); for (let i = 0; i < 90; i++) base.step();
const score = (g: Genome) => { let s = 1e9; for (const off of [60, 74]) { const r = runTrial(makeArena(base, LAYOUT.home[0] - 200), g, { spawnX: LAYOUT.burrow - off, seconds: 20 }); s = Math.min(s, r.fitness); } return s - cellCount(g) * 4; };
const out: any[] = []; const pick = process.argv[3] ? [SEEDS[+process.argv[3]]] : SEEDS;
for (const base0 of pick) {
  const rng = new Rng(11); const cands: Genome[] = [base0];
  const hr = base0.grid.findIndex((r) => r.includes('H')), hc = base0.grid[hr].indexOf('H');
  for (let r = 0; r < base0.grid.length; r++) for (let c = 0; c < base0.grid[r].length; c++) {
    const ch = base0.grid[r][c]; if (ch === '.' || ch === 'H') continue;
    const grid = base0.grid.map((l) => l.split('')); grid[r][c] = 'H'; grid[hr][hc] = ch; const g: Genome = { ...base0, grid: grid.map((l) => l.join('')), cells: { ...base0.cells } };
    if (ch === 'N') { g.cells[`${hc},${hr}`] = g.cells[`${c},${r}`]; delete g.cells[`${c},${r}`]; }
    if (isViable(g)) cands.push(g);
  }
  let pop = cands.map((g) => ({ g, s: score(g) })).sort((a, b) => b.s - a.s);
  for (let gen = 0; gen < 14; gen++) { const elite = pop.slice(0, 8); const kids = []; for (let i = 0; i < 24; i++) { const g = mutate(elite[rng.int(elite.length)].g, rng); kids.push({ g, s: score(g) }); } pop = [...elite, ...kids].sort((a, b) => b.s - a.s); console.log((base0 as any).name, gen, pop[0].s.toFixed(0)); }
  console.log((base0 as any).name, 'best', pop[0].s.toFixed(0), '\n' + toRecipe(pop[0].g).grid.join('\n')); out.push({ from: (base0 as any).name, score: pop[0].s, g: pop[0].g });
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
}
