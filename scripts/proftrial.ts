import { Rng } from '../packages/sim/src/rng.ts'; import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { randomGenome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts';
const rng = new Rng(1); const terrain = Terrain.flat(2400, 900, 600); const t = performance.now();
for (let i = 0; i < 100; i++) runTrial(new World(terrain), randomGenome(rng), { spawnX: 2000 });
console.log((performance.now() - t) / 100, 'ms/trial');
