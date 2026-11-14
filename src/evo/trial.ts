import { CONFIG, LAYOUT, Mat, type World } from '../sim';
import { spawnCreature, type Genome } from './genome';

export const EVO_CONFIG = {
  /** seconds simulated per trial */
  trialSeconds: 20,
  /** simulation steps the whole night may spend */
  nightBudgetSteps: 400 * 20 * 60,
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
}

/** cut the part of the world that matters to a raid */
export function makeArena(world: World): World {
  const a = world.extract(EVO_CONFIG.arenaLeft, EVO_CONFIG.arenaRight);
  a.hand.active = false;
  return a;
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
export function startTrial(arena: World, genome: Genome, seconds = EVO_CONFIG.trialSeconds): LiveTrial {
  const world = arena.clone();
  const sp = spawnCreature(world, genome, LAYOUT.burrow.x - 60);
  const body = sp.body;
  const heart0 = world.bodyHeart[body];
  const eaten0 = world.berriesEaten;
  const d0 = heart0 >= 0 ? nearestBerry(world, world.x[heart0], world.y[heart0]) : Infinity;
  let best = d0, steps = 0;
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
      return { fitness, eaten, approach, damage, alive, steps };
    },
  };
  return t;
}

export function runTrial(arena: World, genome: Genome, seconds = EVO_CONFIG.trialSeconds): TrialResult {
  const t = startTrial(arena, genome, seconds);
  while (!t.done) t.step();
  return t.result();
}
