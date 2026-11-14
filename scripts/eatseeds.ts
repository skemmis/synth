// Turn walkers into eaters: try the heart in every cell of each walker, then hill-climb on berries eaten.
import fs from 'fs';
import { Rng } from '../packages/sim/src/rng.ts'; import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts';
import { mutate, isViable, toRecipe, cellCount, type Genome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts';
const dir = process.argv[2]; const terrain = Terrain.flat(2400, 900, 600);
const score = (g: Genome) => { let s = 0; for (const [x, stash] of [[2000, 1500], [1990, 1420]]) { const w = new World(terrain); spawnRecipe(w, RECIPES.berryStack, stash, 568); spawnRecipe(w, RECIPES.berryPile, stash - 60, 580); const r = runTrial(w, g, { spawnX: x, seconds: 20 }); s += r.fitness; } return s / 2 - cellCount(g) * 4; };
const out: any[] = [];
for (const f of fs.readdirSync(dir)) {
  const base: Genome = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')).g; const rng = new Rng(7);
  const cands: Genome[] = [base];
  // the heart swapped into every other cell
  const hr = base.grid.findIndex((r) => r.includes('H')), hc = base.grid[hr].indexOf('H');
  for (let r = 0; r < base.grid.length; r++) for (let c = 0; c < base.grid[r].length; c++) {
    const ch = base.grid[r][c]; if (ch === '.' || ch === 'H') continue;
    const grid = base.grid.map((l) => l.split('')); grid[r][c] = 'H'; grid[hr][hc] = ch; const g: Genome = { ...base, grid: grid.map((l) => l.join('')), cells: { ...base.cells } };
    if (ch === 'N') { g.cells[`${hc},${hr}`] = g.cells[`${c},${r}`]; delete g.cells[`${c},${r}`]; }
    if (isViable(g)) cands.push(g);
  }
  let pop = cands.map((g) => ({ g, s: score(g) })).sort((a, b) => b.s - a.s);
  for (let gen = 0; gen < 12; gen++) { const elite = pop.slice(0, 8); const kids = []; for (let i = 0; i < 24; i++) { const g = mutate(elite[rng.int(elite.length)].g, rng); kids.push({ g, s: score(g) }); } pop = [...elite, ...kids].sort((a, b) => b.s - a.s); }
  console.log(f, 'best', pop[0].s.toFixed(0), '\n' + toRecipe(pop[0].g).grid.join('\n')); out.push({ from: f, score: pop[0].s, g: pop[0].g });
  fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
}
