// Search for crawlers on flat ground; score is the WORST of three slightly different starts, so fragile gaits lose.
import fs from 'fs';
import { Rng } from '../packages/sim/src/rng.ts'; import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { randomGenome, mutate, nicheOf, cellCount, type Genome } from '../packages/evo/src/genome.ts'; import { runTrial } from '../packages/evo/src/trial.ts';
const terrain = Terrain.flat(2400, 900, 600);
const round = (g: Genome): Genome => ({ ...g, freq: Math.round(g.freq * 100) / 100, cells: Object.fromEntries(Object.entries(g.cells).map(([k, v]) => [k, { phase: Math.round(v.phase * 100) / 100, amp: Math.round(v.amp * 100) / 100 }])) });
export const robust = (g: Genome) => Math.min(...[2000, 2007, 1987].map((x) => -runTrial(new World(terrain), g, { spawnX: x, seconds: 15 }).dx));
const score = (g: Genome) => robust(g) - cellCount(g) * 6;
const seed = +process.argv[3]; const rng = new Rng(seed); let pop: { g: Genome; s: number }[] = [];
for (let i = 0; i < 200; i++) { const g = round(randomGenome(rng)); pop.push({ g, s: score(g) }); }
pop.sort((a, b) => b.s - a.s);
for (let gen = 0; gen < 30; gen++) { const elite = pop.slice(0, 12); const kids = []; for (let i = 0; i < 40; i++) { const g = round(mutate(elite[rng.int(elite.length)].g, rng)); kids.push({ g, s: score(g) }); } pop = [...elite, ...kids].sort((a, b) => b.s - a.s); }
const best = pop[0]; fs.writeFileSync(`${process.argv[2]}/seed${seed}.json`, JSON.stringify({ seed, niche: nicheOf(best.g), dx: Math.round(robust(best.g)), cells: cellCount(best.g), g: best.g }));
console.log(seed, nicheOf(best.g), Math.round(robust(best.g)), cellCount(best.g));
