// Overnight evolution: a genetic search that keeps the best creature per niche (MAP-Elites style),
// so raids differ instead of converging on one design. Deterministic for a given seed and arena.
import { Rng } from '../../sim/src/rng.ts';
import { M } from '../../sim/src/materials.ts';
import type { World } from '../../sim/src/world.ts';
import { crossover, mutate, nicheOf, randomGenome, type Genome } from './genome.ts';
import { Trial, type TrialResult } from './trial.ts';

export interface Elite { g: Genome; niche: string; fitness: number; result: TrialResult; born: number; }
export interface EvoState { seed: number; night: number; counter: number; archive: Elite[]; history: { night: number; best: number; mean: number; niches: number; trials: number }[]; }
export const nightConfig = { trials: 200, trialSeconds: 20, randomShare: 0.08, crossShare: 0.12, raiders: 3 };

/** Cut a world down to the part a raid crosses: drop everything left of `minX` (the pond, mostly). */
export function makeArena(world: World, minX: number): World {
  const a = world.clone(); a.release();
  for (let i = 0; i < a.n; i++) if (a.alive[i] && a.x[i] < minX) a.removeNode(i);
  // creatures from earlier raids are not part of the base
  for (let i = 0; i < a.n; i++) if (a.alive[i] && a.tag[i] >= 1000 && a.mat[i] === M.HEART) { const t = a.tag[i]; for (let j = 0; j < a.n; j++) if (a.alive[j] && a.tag[j] === t) a.removeNode(j); }
  a.events = []; return a;
}

export class Evolver {
  state: EvoState; rng: Rng;
  current: Trial | null = null; private currentG: Genome | null = null; private queue: Genome[] = [];
  trialsTonight = 0; budget = 0; arena: World | null = null; spawnX = 0; lastResult: { g: Genome; r: TrialResult; kept: boolean } | null = null;
  constructor(seed: number, seeds: Genome[], state?: EvoState) {
    this.state = state ?? { seed, night: 0, counter: 0, archive: [], history: [] };
    this.rng = new Rng(seed + this.state.night * 7919 + 13);
    if (!state) this.queue = seeds.map((g, i) => ({ ...g, name: g.name ?? `seed ${i + 1}` }));
  }
  /** Start a night against a snapshot of the base. Elites are re-tested first: the base may have changed. */
  beginNight(arena: World, spawnX: number, budget = nightConfig.trials) {
    this.arena = arena; this.spawnX = spawnX; this.budget = budget; this.trialsTonight = 0; this.state.night++;
    this.rng = new Rng(this.state.seed + this.state.night * 7919 + 13);
    const old = this.state.archive; this.state.archive = [];
    this.queue = [...this.queue, ...old.sort((a, b) => b.fitness - a.fitness).map((e) => e.g)];
    this.next();
  }
  get done() { return !this.current && this.trialsTonight >= this.budget; }
  private pick(): Genome {
    if (this.queue.length) return this.queue.shift()!;
    const A = this.state.archive, rng = this.rng; const id = `n${this.state.night}.${++this.state.counter}`;
    if (!A.length || rng.chance(nightConfig.randomShare)) return { ...randomGenome(rng), name: id };
    // tournament of two, so fitter elites breed more but every niche gets a turn
    const a = A[rng.int(A.length)], b = A[rng.int(A.length)]; const p = a.fitness >= b.fitness ? a : b;
    if (rng.chance(nightConfig.crossShare) && A.length > 1) return mutate({ ...crossover(p.g, A[rng.int(A.length)].g, rng), name: p.g.name }, rng, id);
    return mutate(p.g, rng, id);
  }
  private next() {
    if (this.trialsTonight >= this.budget || !this.arena) { this.current = null; return; }
    this.currentG = this.pick(); this.current = new Trial(this.arena.clone(), this.currentG, { spawnX: this.spawnX, seconds: nightConfig.trialSeconds, dir: -1 });
  }
  /** Run up to `steps` simulation steps of the current trial. Returns true when the night's budget is spent. */
  advance(steps: number): boolean {
    let left = steps;
    while (left > 0 && this.current) {
      const t = this.current, before = t.t; const fin = t.step(left); left -= t.t - before || 1;
      if (fin) { this.finish(t); this.next(); }
    }
    if (!this.current && this.trialsTonight >= this.budget) this.endNight();
    return this.done;
  }
  private finish(t: Trial) {
    const r = t.result(), g = this.currentG!, niche = nicheOf(g); this.trialsTonight++;
    const A = this.state.archive, i = A.findIndex((e) => e.niche === niche);
    const kept = i < 0 || r.fitness > A[i].fitness;
    if (kept) { const e: Elite = { g, niche, fitness: r.fitness, result: r, born: this.state.night }; if (i < 0) A.push(e); else A[i] = e; }
    this.lastResult = { g, r, kept };
  }
  private ended = 0;
  private endNight() {
    if (this.ended === this.state.night) return; this.ended = this.state.night;
    const A = this.state.archive; const best = Math.max(...A.map((e) => e.fitness)), mean = A.reduce((s, e) => s + e.fitness, 0) / Math.max(1, A.length);
    this.state.history.push({ night: this.state.night, best, mean, niches: A.length, trials: this.trialsTonight });
  }
  /** Run the whole night at once (headless). */
  runNight(arena: World, spawnX: number, budget = nightConfig.trials) { this.beginNight(arena, spawnX, budget); while (!this.advance(100000)); return this.state.history[this.state.history.length - 1]; }
  /** The raid party: the best creatures from different niches. */
  raiders(n = nightConfig.raiders): Elite[] { return this.state.archive.slice().sort((a, b) => b.fitness - a.fitness).slice(0, n); }
}
