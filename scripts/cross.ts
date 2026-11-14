import { stripWorld } from '../packages/sim/src/scenarios.ts'; import { LAYOUT } from '../packages/sim/src/terrain.ts';
import { SEEDS } from '../packages/evo/src/seeds.ts'; import { Trial } from '../packages/evo/src/trial.ts';
for (const s of SEEDS) { const w = stripWorld({ water: false }); const t = new Trial(w, s, { spawnX: LAYOUT.burrow - 60, seconds: 40 }); const xs: number[] = []; while (!t.step(300)) xs.push(Math.round(w.x[t.c.heart])); console.log(s.name, xs.join(' ')); }
