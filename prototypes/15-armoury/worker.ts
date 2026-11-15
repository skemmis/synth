// The burrow's day shift: the same search the night runs, off the main thread, against a saved copy of a base.
import { World, stripTerrain, type WorldSave } from '../../packages/sim/src/index.ts';
import { Evolver, SEEDS, evoConfig, fitnessConfig, type EvoState } from '../../packages/evo/src/index.ts';
interface Run { type: 'run'; world: WorldSave; state: EvoState; seed: number; budget: number; spawnX: number; wreck: number; maxCells: number; nicheBy: 'material' | 'family'; }
let stop = false;
self.onmessage = (e: MessageEvent) => { const m = e.data as Run | { type: 'stop' }; if (m.type === 'stop') stop = true; else run(m); };
async function run(m: Run) {
  stop = false; evoConfig.maxCells = m.maxCells; evoConfig.nicheBy = m.nicheBy; fitnessConfig.wreck = m.wreck;
  const evo = new Evolver(m.seed, SEEDS, m.state); evo.beginNight(World.load(stripTerrain(), m.world), m.spawnX, m.budget);
  while (!stop && !evo.advance(12000)) { (self as any).postMessage({ type: 'progress', trials: evo.trialsTonight }); await new Promise((r) => setTimeout(r, 0)); }
  (self as any).postMessage({ type: 'done', state: evo.state, trials: evo.trialsTonight });
}
