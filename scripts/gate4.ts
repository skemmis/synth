import { runNights } from '../packages/evo/src/scenario.ts';
const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds.length ? seeds : [1]) { const t = performance.now(); const r = runNights(seed); console.log(`seed ${seed}: best by night ${r.history.map((h) => h.best.toFixed(0)).join(' ')} | strategy ${r.strategy}, ate ${r.eaten} | ${((performance.now() - t) / 1000).toFixed(0)} s\n  ${r.niches.join('  ')}`); }
