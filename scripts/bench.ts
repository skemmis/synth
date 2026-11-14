// Headless speed: steps per second, and multiples of real time.
import { stripWorld, flatWorld, run } from '../packages/sim/src/scenarios.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts';
import { RECIPES } from '../packages/sim/src/recipes.ts';
const time = (name: string, w: any, secs: number) => { const t = performance.now(); run(w, secs); const ms = performance.now() - t; let live = 0; for (let i = 0; i < w.n; i++) live += w.alive[i]; console.log(`${name}: ${live} nodes, ${(secs * 60 / (ms / 1000)).toFixed(0)} steps/s, ${(secs / (ms / 1000)).toFixed(1)}x real time`); };
const pond = stripWorld(); time('pond (all water)', pond, 5);
const arena = flatWorld(2400); for (let k = 0; k < 16; k++) spawnRecipe(arena, k % 2 ? RECIPES.woodBlock : RECIPES.wall, 300 + k * 110, 520); arena.spawnWater(100, 300, 700, 420);
time('arena (solids + some water)', arena, 5);
