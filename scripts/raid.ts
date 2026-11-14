// Does a dream carry over to the raid? Evolve, then send the party at the real base and compare berries eaten.
import { LAYOUT } from '../packages/sim/src/terrain.ts'; import { M } from '../packages/sim/src/materials.ts';
import { runNights, testBase } from '../packages/evo/src/scenario.ts'; import { spawnCreature } from '../packages/evo/src/trial.ts';
const seed = +process.argv[2], gap = +(process.argv[3] ?? 150); const r = runNights(seed, +(process.argv[4] ?? 3)); const party = r.evo.raiders(3);
const { world: w } = testBase(); const e0 = w.eaten, b0 = w.count(M.BERRY);
for (let t = 0; t < 28 * 60 + gap * 2; t++) { if (t % gap === 0 && t / gap < party.length) spawnCreature(w, party[t / gap].g, LAYOUT.burrow - 60, 1000 + t / gap); w.step(); }
console.log(`seed ${seed} gap ${gap}: dreams ate ${party.map((p) => p.result.eaten).join(',')} | raid ate ${w.eaten - e0}, berries gone ${b0 - w.count(M.BERRY)}, hearts lost ${w.heartsLost}`);
