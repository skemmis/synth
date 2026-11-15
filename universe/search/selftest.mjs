// Self-checks: determinism, and the conservation law that rules out fake swimmers.
import { randomRules, randomOrganism, rng32 } from '../rules.js';
import { World } from '../sim.js';
const r = rng32(5); let worst = 0, n = 0;
for (let k = 0; k < 400; k++) {
  const R = randomRules(r, { medium: 'linear' }); const o = randomOrganism(r, R.K);
  const run = () => { const w = new World(R, { cap: 32 }); for (const a of o) w.add(a.t, a.x, a.y); return w; };
  const w = run(), inv = () => { let g = 0, G = 0; for (let i = 0; i < w.n; i++) { const t = w.type[i], c = w.g1 * w.drag[t]; g += c * w.x[i] + w.mass[t] * w.vx[i]; G += c; } return g / G; };
  // settle one step so the first force evaluation is included consistently
  w.T = 0; const i0 = inv(); for (let s = 0; s < 3000; s++) w.step(); const i1 = inv();
  // invariant: drag-weighted centroid + momentum/drag is constant up to g*(v_end - v_start)*dt
  let vmax = 0; for (let i = 0; i < w.n; i++) vmax = Math.max(vmax, Math.abs(w.vx[i]));
  if (w.stat.capHits === 0) { worst = Math.max(worst, Math.abs(i1 - i0) - vmax * w.dt * 2); n++; }
  if (k < 20) { const w2 = run(), w3 = run(); w2.T = w3.T = 0.1; for (let s = 0; s < 500; s++) { w2.step(); w3.step(); } if (w2.hash() !== w3.hash()) throw new Error('not deterministic'); }
}
console.log('linear-drag invariant: worst drift', worst.toExponential(2), 'over', n, 'random universes');
if (worst > 1e-6) { console.error('FAIL'); process.exit(1); }
console.log('determinism: ok');
