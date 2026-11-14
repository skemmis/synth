// Does the first raider do in the real world (pond and all) exactly what it did alone in the arena?
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts'; import { setDown } from '../packages/sim/src/bench.ts';
import { LAYOUT, stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { makeArena } from '../packages/evo/src/evolve.ts'; import { SEEDS } from '../packages/evo/src/seeds.ts'; import { Trial } from '../packages/evo/src/trial.ts';
const w = new World(stripTerrain()); w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
spawnRecipe(w, RECIPES.berryStack, LAYOUT.home[1] - 110, 568); setDown(w, { name: 'wall', grid: ['WW', 'WW', 'WW'] }, LAYOUT.home[1] + 40, 600);
for (let i = 0; i < 120; i++) w.step(); w.removeNode(w.nearestNode(LAYOUT.home[1] - 110, 560, 40)); // a hole in the numbering
w.compact();
for (const s of SEEDS) {
  const a = new Trial(makeArena(w, LAYOUT.home[0] - 200), s, { spawnX: LAYOUT.burrow - 60, seconds: 20 }), b = new Trial(w.clone(), s, { spawnX: LAYOUT.burrow - 60, seconds: 20 });
  while (!a.step(60)); while (!b.step(60));
  console.log(s.name, 'arena heart x', a.w.x[a.c.heart].toFixed(6), 'real', b.w.x[b.c.heart].toFixed(6), a.w.x[a.c.heart] === b.w.x[b.c.heart] ? 'IDENTICAL' : 'differs', 'ate', a.result().eaten, b.result().eaten);
}
