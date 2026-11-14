// The milestone 4 test base: berries behind a wood wall three nodes high.
import { spawnRecipe } from '../../sim/src/grid.ts'; import { RECIPES } from '../../sim/src/recipes.ts';
import { LAYOUT, stripTerrain } from '../../sim/src/terrain.ts'; import { World } from '../../sim/src/world.ts'; import { box, setDown } from '../../sim/src/bench.ts';
import { Evolver, makeArena, nightConfig } from './evolve.ts'; import { SEEDS } from './seeds.ts'; import { Trial } from './trial.ts';

export const STASH_X = LAYOUT.home[1] - 110, WALL_X = LAYOUT.home[1] + 40;
export function testBase(): { world: World; wall: number[] } {
  const w = new World(stripTerrain());
  spawnRecipe(w, RECIPES.berryStack, STASH_X, w.terrain.groundY(STASH_X) - 32);
  const wall = setDown(w, { name: 'wall', grid: ['WW', 'WW', 'WW'] }, WALL_X, w.terrain.groundY(WALL_X)).nodes;
  for (let i = 0; i < 90; i++) w.step();
  return { world: w, wall };
}
export type Strategy = 'none' | 'over' | 'through' | 'shove' | 'under';
/** Re-run the best raider and say how it got past the wall. */
export function classify(evo: Evolver, base: World, wall: number[]): { strategy: Strategy; eaten: number } {
  const best = evo.raiders(1)[0]; if (!best) return { strategy: 'none', eaten: 0 };
  const arena = makeArena(base, LAYOUT.home[0] - 200); const b0 = box(arena, wall); let bonds0 = 0; for (let k = 0; k < arena.nb; k++) if (arena.balive[k]) bonds0++;
  const t = new Trial(arena, best.g, { spawnX: LAYOUT.burrow - 60, seconds: nightConfig.trialSeconds }); let overY = 1e9, crossed = false;
  while (!t.step(1)) { const x = arena.x[t.c.heart]; if (!crossed && x < b0.x0 - 8) { crossed = true; } if (!crossed && x < b0.x1 + 16 && x > b0.x0 - 16) overY = Math.min(overY, arena.y[t.c.heart]); }
  const r = t.result(); const b1 = box(arena, wall); const lost = wall.filter((i) => !arena.alive[i]).length;
  if (!crossed && r.eaten === 0) return { strategy: 'none', eaten: 0 };
  let strategy: Strategy = 'over';
  if (lost > 0) strategy = 'through'; else if (Math.abs(b1.cx - b0.cx) > 20 || b1.h < b0.h - 12) strategy = 'shove';
  return { strategy, eaten: r.eaten };
}
export function runNights(seed: number, nights = 5, budget = nightConfig.trials) {
  const { world, wall } = testBase(); const evo = new Evolver(seed, SEEDS);
  for (let n = 0; n < nights; n++) evo.runNight(makeArena(world, LAYOUT.home[0] - 200), LAYOUT.burrow - 60, budget);
  return { history: evo.state.history, ...classify(evo, world, wall), niches: evo.state.archive.map((e) => `${e.niche}:${e.fitness.toFixed(0)}`), evo };
}
