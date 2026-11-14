// Random search plus hill climbing for creatures that cross flat ground. Used to pick the seed crawlers.
import { Rng } from '../packages/sim/src/rng.ts'; import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { randomGenome, mutate, nicheOf, toRecipe, type Genome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts';
const rng = new Rng(+(process.argv[2] ?? 1)); const terrain = Terrain.flat(2400, 900, 600);
const score = (g: Genome) => { const w = new World(terrain); return -runTrial(w, g, { spawnX: 1800, seconds: 15 }).dx; }; // leftward distance
let pop: { g: Genome; s: number }[] = []; const t0 = performance.now();
for (let i = 0; i < 300; i++) { const g = randomGenome(rng); pop.push({ g, s: score(g) }); }
pop.sort((a, b) => b.s - a.s); console.log('random quartiles', [0, 30, 75, 150, 225].map((i) => pop[i].s.toFixed(0))); console.log('random best', pop.slice(0, 5).map((p) => p.s.toFixed(0)), ((performance.now() - t0) / 300).toFixed(1), 'ms/trial');
for (let gen = 0; gen < 30; gen++) {
  const elite = pop.slice(0, 20); const kids = [];
  for (let i = 0; i < 60; i++) { const g = mutate(elite[rng.int(elite.length)].g, rng); kids.push({ g, s: score(g) }); }
  pop = [...elite, ...kids].sort((a, b) => b.s - a.s);
}
const seen = new Set<string>();
for (const p of pop) { const n = nicheOf(p.g); if (seen.has(n)) continue; seen.add(n); console.log(`\n${n}: ${p.s.toFixed(0)} units in 15 s, freq ${p.g.freq.toFixed(2)}\n${toRecipe(p.g).grid.join('\n')}\n${JSON.stringify(p.g)}`); if (seen.size >= 5) break; }
