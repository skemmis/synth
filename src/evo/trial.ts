import { CONFIG, LAYOUT, Mat, type World } from '../sim';
import { spawnCreature, type Genome } from './genome';

export const EVO_CONFIG = {
  /** each body is tried from these start offsets (world units) and scored on its worst run,
   *  so a path that only works from one exact spot does not count */
  startOffsets: [0, -30],
  /** seconds simulated per trial */
  trialSeconds: 20,
  /** simulation steps the whole night may spend */
  nightBudgetSteps: 800 * 20 * 60,
  /** fitness weights */
  berryWeight: 100,
  approachWeight: 1,      // per node diameter closer to the nearest berry
  damageWeight: 0.15,     // per hit point lost
  /** how many creatures raid, each from a different niche */
  raiders: 3,
  /** seconds a raid lasts */
  raidSeconds: 45,
  /** arena margins around home and burrow, world units */
  arenaLeft: LAYOUT.home.x0 - 120,
  arenaRight: LAYOUT.burrow.x + 180,
};

export interface TrialResult {
  fitness: number;
  eaten: number;
  /** node diameters closer to the nearest berry than at the start (best reached) */
  approach: number;
  damage: number;
  alive: boolean;
  steps: number;
  /** highest the heart got above the ground, in cells: tells a crawler from a hopper */
  peak: number;
}

/**
 * The arena is a copy of the live world with everything far from the raid
 * route switched off. Same node numbers, same collision order: a body tried
 * here does exactly what it will do in the raid if nothing else changes.
 */
export function makeArena(world: World): World {
  return world.clone().maskOutside(EVO_CONFIG.arenaLeft, EVO_CONFIG.arenaRight);
}

function nearestBerry(world: World, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < world.n; i++) {
    if (!world.alive[i] || world.mat[i] !== Mat.Berry) continue;
    const d = Math.hypot(world.x[i] - x, world.y[i] - y);
    if (d < best) best = d;
  }
  return best;
}

export interface LiveTrial {
  world: World;
  body: number;
  step(): void;
  result(): TrialResult;
  done: boolean;
}

/** Start a trial in a private copy of the arena. step() it yourself, or use runTrial. */
export function startTrial(arena: World, genome: Genome, seconds = EVO_CONFIG.trialSeconds, offset = 0): LiveTrial {
  const world = arena.clone();
  const sp = spawnCreature(world, genome, LAYOUT.burrow.x - 60 + offset);
  const body = sp.body;
  const heart0 = world.bodyHeart[body];
  const eaten0 = world.berriesEaten;
  const d0 = heart0 >= 0 ? nearestBerry(world, world.x[heart0], world.y[heart0]) : Infinity;
  let best = d0, steps = 0, peak = 0;
  const total = Math.round(seconds / CONFIG.dt);
  const t: LiveTrial = {
    world, body, done: false,
    step() {
      if (t.done) return;
      world.step();
      steps++;
      const hrt = world.bodyHeart[body];
      if (hrt >= 0 && steps % 6 === 0) {
        const d = nearestBerry(world, world.x[hrt], world.y[hrt]);
        if (d < best) best = d;
        const up = (world.terrain.heightAt(world.x[hrt]) - world.y[hrt]) / 12;
        if (up > peak) peak = up;
      }
      // stop early when the creature is dead or there is nothing left to eat
      if (steps >= total || hrt < 0 || (steps % 30 === 0 && world.count(Mat.Berry) === 0)) t.done = true;
    },
    result() {
      const eaten = world.bodyEaten[body] ?? 0;
      void eaten0;
      const approach = isFinite(d0) && isFinite(best) ? (d0 - best) / 12 : 0;
      const damage = world.bodyDamage[body] ?? 0;
      const alive = world.bodyHeart[body] >= 0;
      const fitness = eaten * EVO_CONFIG.berryWeight + approach * EVO_CONFIG.approachWeight - damage * EVO_CONFIG.damageWeight;
      return { fitness, eaten, approach, damage, alive, steps, peak };
    },
  };
  return t;
}

/** Score a body: its worst result over the start offsets. Steps are the total spent. */
export function runTrial(arena: World, genome: Genome, seconds = EVO_CONFIG.trialSeconds): TrialResult {
  let worst: TrialResult | null = null, steps = 0;
  for (const offset of EVO_CONFIG.startOffsets) {
    const t = startTrial(arena, genome, seconds, offset);
    while (!t.done) t.step();
    const r = t.result();
    steps += r.steps;
    if (!worst || r.fitness < worst.fitness) worst = r;
  }
  return { ...worst!, steps };
}
