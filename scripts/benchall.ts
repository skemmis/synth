import { bench } from '../packages/sim/src/bench.ts';
import { RECIPES } from '../packages/sim/src/recipes.ts';
for (const k of Object.keys(RECIPES)) { const t = performance.now(); const b = bench(RECIPES[k]); console.log(`\n${k} (${(performance.now() - t).toFixed(0)}ms): ${b.text}`); }
