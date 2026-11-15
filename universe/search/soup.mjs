// Random survey of soups. Usage: node search/soup.mjs <seed> <count> <outfile>
import fs from 'node:fs';
import { randomRules, rng32 } from '../rules.js';
import { soupTest } from '../metrics.js';
const seed = +process.argv[2] || 1, COUNT = +process.argv[3] || 100, out = process.argv[4] || `results/soup-${seed}.jsonl`;
const r = rng32(seed * 104729 + 1);
const fd = fs.openSync(out, 'w'); const t0 = Date.now();
for (let i = 0; i < COUNT; i++) {
  const u = r();
  const opts = { bonds: u < 0.25 ? false : true, nonrecip: u < 0.25 && r() < 0.5 ? 1 : 0, K: 1 + Math.floor(r() * 6) };
  const R = randomRules(r, opts);
  const m = soupTest(R);
  fs.writeSync(fd, JSON.stringify({ i, seed, opts, m, R }) + '\n');
}
console.log('done', COUNT, ((Date.now() - t0) / 1000).toFixed(0) + 's');
