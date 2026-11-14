// Evolution without a wall: can anything reach and eat the stash at all?
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts';
import { LAYOUT, stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { Evolver, makeArena } from '../packages/evo/src/evolve.ts'; import { SEEDS } from '../packages/evo/src/seeds.ts'; import { STASH_X } from '../packages/evo/src/scenario.ts'; import { toRecipe } from '../packages/evo/src/genome.ts';
const w = new World(stripTerrain()); spawnRecipe(w, RECIPES[process.argv[3] ?? 'berryStack'], STASH_X, w.terrain.groundY(STASH_X) - 32); for (let i = 0; i < 90; i++) w.step();
const extra = process.env.EXTRA ? JSON.parse(fs.readFileSync(process.env.EXTRA, 'utf8')).map((e: any) => e.g) : []; const evo = new Evolver(+process.argv[2], [...SEEDS, ...extra]);
for (let n = 0; n < +(process.env.NIGHTS ?? 4); n++) { const h = evo.runNight(makeArena(w, LAYOUT.home[0] - 200), LAYOUT.burrow - 60); console.log('night', h.night, 'best', h.best.toFixed(0), 'mean', h.mean.toFixed(0), 'niches', h.niches); }
for (const e of evo.raiders(3)) console.log(e.niche, e.fitness.toFixed(0), 'ate', e.result.eaten, '\n' + toRecipe(e.g).grid.join('\n'));
import fs from 'fs'; import { Trial } from '../packages/evo/src/trial.ts'; import { toSvg } from './svg.ts'; import { M } from '../packages/sim/src/materials.ts';
{ const a = makeArena(w, LAYOUT.home[0] - 200); const t = new Trial(a, evo.raiders(1)[0].g, { spawnX: LAYOUT.burrow - 60, seconds: 20 }); let k = 0;
  while (!t.step(1)) { if (t.t % 150 === 0 && t.t >= 600) fs.writeFileSync(`${process.argv[4]}/e${k++}.svg`, toSvg(a, STASH_X - 150, 430, STASH_X + 250, 650, 2)); }
  console.log('berries left', a.count(M.BERRY), 'heart x', a.x[t.c.heart].toFixed(0), 'stash', STASH_X); }
