// Tune the hidden numbers so that plain hand builds swim. Usage: node search/tune.mjs <seed> <evals>
import fs from 'node:fs';
import { DEFAULTS, rng32 } from '../sim.js';
import { travel, BUILDS } from './try.mjs';
const seed = +process.argv[2] || 1, EVALS = +process.argv[3] || 3000, r = rng32(seed);
// [name, index or -1, low, high, log]
const KNOBS = [['g1', -1, 0.1, 2, 1], ['g2', -1, 0.02, 1.5, 1], ['shadow', -1, 0, 0.95, 0], ['mass', 0, 0.5, 3, 1], ['mass', 1, 0.5, 3, 1], ['drag', 0, 0.3, 3, 1], ['drag', 1, 0.3, 3, 1],
  ['k', 1, 8, 120, 1], ['k', 2, 40, 300, 1], ['damp', 1, 0, 3, 0], ['jitHz', -1, 0.6, 2.5, 1], ['jitForce', -1, 10, 150, 1], ['jitDuty', -1, 0.05, 0.5, 0], ['jitLag', -1, 0, 0.5, 0]];
const get = (p, k) => k[1] < 0 ? p[k[0]] : p[k[0]][k[1]];
const set = (p, k, v) => { if (k[1] < 0) p[k[0]] = v; else { p[k[0]] = [...p[k[0]]]; p[k[0]][k[1]] = v; } };
const names = Object.keys(BUILDS);
function score(p) { let g = 0; const sp = {}; for (const n of names) { const t = travel(BUILDS[n], p, 40); if (t.cap || t.links < BUILDS[n].links.length) return { f: 0, sp }; sp[n] = t.speed; g += Math.log(t.speed + 0.01); } return { f: Math.exp(g / names.length), sp }; }
let best = { ...DEFAULTS }, bs = score(best); console.log('start', bs.f.toFixed(3));
for (let i = 0; i < EVALS; i++) {
  const p = { ...best }; const nm = 1 + Math.floor(r() * 3);
  for (let m = 0; m < nm; m++) { const k = KNOBS[Math.floor(r() * KNOBS.length)], v = get(p, k), g = (r() + r() + r() - 1.5) * 0.5;
    const nv = k[4] ? Math.exp(Math.log(v) + g * Math.log(k[3] / k[2]) * 0.5) : v + g * (k[3] - k[2]) * 0.5; set(p, k, Math.min(k[3], Math.max(k[2], nv))); }
  const s = score(p); if (s.f > bs.f) { best = p; bs = s; console.log(i, s.f.toFixed(3), JSON.stringify(Object.fromEntries(Object.entries(s.sp).map(([a, b]) => [a, +b.toFixed(2)])))); }
}
fs.writeFileSync(`results/tune-${seed}.json`, JSON.stringify({ f: bs.f, sp: bs.sp, p: best }));
console.log(JSON.stringify(Object.fromEntries(KNOBS.map(k => [k[0] + (k[1] < 0 ? '' : k[1]), +get(best, k).toFixed(3)]))));
