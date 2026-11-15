// Search for builds that feed themselves: a walled pond, 40 pellets, jitters that run down unless fed.
// Score is pellets eaten in 90 s, averaged over two pellet layouts. This is the game's first goal.
// Usage: node search/forage.mjs <seed> <evals> <out.json>
import fs from 'node:fs';
import { Parts, rng32, JITTER, STICKY, PELLET, ROPE, FUSE, SPRING, ROD } from '../sim.js';
import { runSearch } from './builds.mjs';
const seed = +process.argv[2] || 1, EVALS = +process.argv[3] || 20000, out = process.argv[4] || `results/forage-${seed}.json`;
const params = JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url)));
export function forage(build, params, secs = 90) {
  let eaten = 0, alive = 0, span = 0;
  for (let layout = 1; layout <= 2; layout++) {
    const w = new Parts(params, { W: 48, H: 30, cap: 80, seed: layout });
    const pr = rng32(layout * 977); w.load(build, 10, 15); const n = w.n;
    if (w.component(0).length < n) return null;
    for (let k = 0; k < 40; k++) { let x, y, ok; do { x = 1 + pr() * 46; y = 1 + pr() * 28; ok = Math.hypot(x - 10, y - 15) > 6; } while (!ok); w.add(PELLET, x, y); }
    const steps = Math.round(secs / w.p.dt); for (let s = 0; s < steps; s++) w.step();
    if (w.stat.capHits) return null;
    eaten += w.stat.eaten / 2;
    for (let i = 0; i < w.n; i++) if (w.kind[i] === JITTER && w.e[i] > 0) { alive += 0.5; break; }
    let far = 0; for (const a of build.atoms) for (const b of build.atoms) far = Math.max(far, Math.hypot(a[1] - b[1], a[2] - b[2])); span = far;
  }
  return { f: eaten, eaten, alive, span, n: build.atoms.length };
}
const cellOf = (m, b) => { const nb = m.n <= 5 ? 0 : m.n <= 8 ? 1 : m.n <= 11 ? 2 : 3, sb = m.span < 3 ? 0 : m.span < 5 ? 1 : 2;
  const has = (k) => b.links.some(l => l[2] === k) ? 1 : 0; return `${nb}|${sb}|${has(ROPE)}${has(FUSE)}|${b.atoms.some(a => a[0] === STICKY) ? 1 : 0}`; };
if (process.argv[1].endsWith('forage.mjs')) {
  const init = JSON.parse(fs.readFileSync(new URL('../seeds.json', import.meta.url)));
  runSearch(params, seed, EVALS, init, console.log, out, { measure: forage, cellOf });
}
