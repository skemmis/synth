// Genetic search with a niche archive (MAP-Elites style): the best creature
// per niche is kept, so raids differ instead of converging on one design.
import { Rng } from '../sim';
import { bodyMass, cellCount, cloneGenome, mutate, randomGenome, type Genome } from './genome';
import type { TrialResult } from './trial';

export interface Elite { genome: Genome; fitness: number; result: TrialResult; niche: string; night: number }

export type Gait = 'crawler' | 'hopper' | 'leaper';
export function gaitOf(peak: number): Gait {
  return peak < 3 ? 'crawler' : peak < 8 ? 'hopper' : 'leaper';
}

/**
 * niche = how it moves (from the trial) + body size + what it is armed with.
 * Keying on behaviour, not just materials, is what keeps raids from all
 * being the same trick in different colours.
 */
export function nicheOf(g: Genome, result?: TrialResult): string {
  const n = cellCount(g.grid);
  const size = n < 9 ? 'small' : n < 18 ? 'medium' : 'large';
  const counts: Record<string, number> = {};
  for (const row of g.grid) for (const c of row) if (c !== '.' && c !== 'H') counts[c] = (counts[c] ?? 0) + 1;
  const total = Math.max(1, n - 1);
  let kind = 'plain';
  if ((counts.T ?? 0) / total >= 0.12) kind = 'thorny';
  else if ((counts.P ?? 0) / total >= 0.12) kind = 'sticky';
  else if ((counts.S ?? 0) / total >= 0.3) kind = 'stony';
  return `${size} ${kind} ${result ? gaitOf(result.peak) : 'crawler'}`;
}

export interface EvolverState { archive: Elite[]; rngState: number; night: number; trials: number }

export class Evolver {
  archive = new Map<string, Elite>();
  rng: Rng;
  night = 0;
  trials = 0;
  /** elites waiting to be re-tested against tonight's base */
  private retest: Genome[] = [];
  /** best fitness seen each night, for the fitness curve */
  history: number[] = [];

  constructor(seed: number, private seeds: Genome[]) {
    this.rng = new Rng(seed);
  }

  /** Start a night. Old elites are forgotten as scores (the base may have changed) but kept as parents. */
  beginNight() {
    this.night++;
    const parents = [...this.archive.values()].sort((a, b) => b.fitness - a.fitness).map((e) => e.genome);
    this.retest = this.night === 1 ? this.seeds.map(cloneGenome) : parents;
    this.archive.clear();
    this.history.push(-Infinity);
  }

  /** the next genome to try */
  next(): Genome {
    if (this.retest.length) return this.retest.shift()!;
    const elites = [...this.archive.values()];
    if (!elites.length || this.rng.next() < 0.06) return randomGenome(this.rng);
    // tournament of two, then one to three mutations
    const a = elites[this.rng.int(elites.length)], b = elites[this.rng.int(elites.length)];
    let g = mutate((a.fitness >= b.fitness ? a : b).genome, this.rng);
    const extra = this.rng.next();
    if (extra < 0.45) g = mutate(g, this.rng);
    if (extra < 0.15) g = mutate(g, this.rng);
    return g;
  }

  report(genome: Genome, result: TrialResult): boolean {
    this.trials++;
    const niche = nicheOf(genome, result);
    const cur = this.archive.get(niche);
    const h = this.history.length - 1;
    if (h >= 0 && result.fitness > this.history[h]) this.history[h] = result.fitness;
    if (!cur || result.fitness > cur.fitness) {
      this.archive.set(niche, { genome: cloneGenome(genome), fitness: result.fitness, result, niche, night: this.night });
      return true;
    }
    return false;
  }

  /** the best n elites, preferring ones that move differently from those already picked */
  best(n: number): Elite[] {
    const sorted = [...this.archive.values()].sort((a, b) => b.fitness - a.fitness);
    const out: Elite[] = [];
    const gaits = new Set<string>();
    for (const e of sorted) {
      const gait = e.niche.split(' ')[2];
      if (out.length < n && !gaits.has(gait)) { out.push(e); gaits.add(gait); }
    }
    for (const e of sorted) if (out.length < n && !out.includes(e)) out.push(e);
    return out.sort((a, b) => b.fitness - a.fitness);
  }

  get bestFitness(): number {
    let m = -Infinity;
    for (const e of this.archive.values()) if (e.fitness > m) m = e.fitness;
    return m;
  }

  save(): EvolverState {
    return { archive: [...this.archive.values()], rngState: this.rng.state, night: this.night, trials: this.trials };
  }

  load(s: EvolverState) {
    this.archive = new Map(s.archive.map((e) => [e.niche, e]));
    this.rng.state = s.rngState; this.night = s.night; this.trials = s.trials;
  }
}

export { bodyMass };
