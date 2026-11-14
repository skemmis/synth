// Check each berry-eating candidate: flat-ground distance, and a real strip run from the burrow to an unguarded stash.
import fs from 'fs';
import { Terrain, LAYOUT, stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts';
import { nicheOf, cellCount, type Genome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts'; import { makeArena } from '../packages/evo/src/evolve.ts'; import { STASH_X } from '../packages/evo/src/scenario.ts';
const list: { from: string; g: Genome }[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const base = new World(stripTerrain()); spawnRecipe(base, RECIPES.berryStack, STASH_X, base.terrain.groundY(STASH_X) - 32); for (let i = 0; i < 90; i++) base.step();
for (const e of list) {
  const flat = Math.min(...[2000, 2007, 1987].map((x) => -runTrial(new World(Terrain.flat(2400, 900, 600)), e.g, { spawnX: x, seconds: 15 }).dx));
  const r = runTrial(makeArena(base, LAYOUT.home[0] - 200), e.g, { spawnX: LAYOUT.burrow - 60, seconds: 20 });
  console.log(e.from, nicheOf(e.g), 'cells', cellCount(e.g), 'flat worst', flat.toFixed(0), 'strip ate', r.eaten, 'fitness', r.fitness.toFixed(0), 'alive', r.alive);
}
