import type { World } from '../sim';
import type { Elite, Evolver } from './evolver';
import type { Pool } from './pool';
import { EVO_CONFIG } from './trial';

export interface NightProgress { trials: number; stepsUsed: number; budget: number; best: number; improved: Elite[] }

/**
 * One night of evolution against a fixed arena. Deterministic for a given
 * evolver state and arena: genomes are drawn and reported in batch order,
 * regardless of which worker finishes first.
 */
export async function runNight(
  evolver: Evolver, arena: World, pool: Pool,
  opts: { budgetSteps?: number; batch?: number; onProgress?: (p: NightProgress) => void; cancelled?: () => boolean } = {},
): Promise<Elite[]> {
  const budget = opts.budgetSteps ?? EVO_CONFIG.nightBudgetSteps;
  const batch = opts.batch ?? Math.max(4, pool.size * 3);
  await pool.setArena(arena);
  evolver.beginNight();
  let used = 0, trials = 0;
  while (used < budget && !opts.cancelled?.()) {
    const genomes = Array.from({ length: batch }, () => evolver.next());
    const results = await pool.run(genomes);
    const improved: Elite[] = [];
    results.forEach((r, i) => {
      used += r.steps; trials++;
      if (evolver.report(genomes[i], r)) improved.push(evolver.archive.get([...evolver.archive.keys()].find((k) => evolver.archive.get(k)!.genome.grid.join() === genomes[i].grid.join() && evolver.archive.get(k)!.fitness === r.fitness)!)!);
    });
    opts.onProgress?.({ trials, stepsUsed: used, budget, best: evolver.bestFitness, improved: improved.filter(Boolean) });
  }
  return evolver.best(EVO_CONFIG.raiders);
}
