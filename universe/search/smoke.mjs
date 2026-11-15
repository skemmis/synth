import { randomRules, randomOrganism, rng32 } from '../rules.js';
import { swimTest } from '../metrics.js';
const r = rng32(1);
let t0 = Date.now(), best = [], hist = { bad: 0, zero: 0 }, N = +process.argv[2] || 2000;
for (let i = 0; i < N; i++) {
  const R = randomRules(r, {}); const o = randomOrganism(r, R.K);
  const m = swimTest(R, o);
  if (m.bad) hist.bad++; else if (m.fit < 1e-4) hist.zero++;
  if (m.fit > 0) best.push([m.fit, m.cycles, m.beatAmp, R.g2, R.shadow, o.length]);
}
best.sort((a, b) => b[0] - a[0]);
console.log('ms/eval', (Date.now() - t0) / N, hist, 'nonzero', best.length);
console.log(best.slice(0, 15).map(b => b.map(v => +v.toFixed(4)).join(' ')).join('\n'));
