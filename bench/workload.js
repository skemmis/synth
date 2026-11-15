// The benchmark workload: a fixed, seeded list of swim-test trials.
// Trial i is a random rule set plus a random body, drawn from one seeded stream, exactly the way the
// swimmer search draws its first generation. Every machine runs the same trials.
import { World } from '../universe/sim.js';
import { randomRules, randomOrganism, rng32 } from '../universe/rules.js';
import { swimTest, components } from '../universe/metrics.js';

export const SEED = 20261115;
export const STEPS = 4000;      // steps per trial, the swim test's default
export const MAXN = 16;         // most atoms in a trial body
// The reference run: 4,000 trials in the cloud sandbox (4 threads of a 2.1 GHz Xeon, Node 22).
export const CLOUD = { trials: 4000, checksum: '91801d7a', single: 250, multi: 965, threads: 4, cpu: 'Intel Xeon 2.1 GHz (cloud sandbox)' };

// The generator uses exp, log, sin and cos, which JavaScript engines may round differently in the last
// bit (Node 22 and Chrome 153 do). Rounding every generated number to six decimals removes that, so
// every engine gets the same trials. The simulation itself uses only exactly-rounded operations.
function quantize(o) {
  if (typeof o === 'number') return Math.round(o * 1e6) / 1e6;
  if (o && typeof o === 'object') for (const k in o) o[k] = quantize(o[k]);
  return o;
}

export function makeTrials(count, seed = SEED) {
  const r = rng32(seed), out = [];
  for (let i = 0; i < count; i++) { const R = randomRules(r, {}); out.push(quantize({ R, atoms: randomOrganism(r, R.K) })); }
  return out;
}

// The CPU path is the search's own swim test, unchanged.
export function runTrial(t) { const m = swimTest(t.R, t.atoms); return m.bad ? -1 : m.fit; }

// Order-sensitive hash of every result, to twelve decimals. Equal checksums mean the same results.
export function checksum(fits) {
  let h = 2166136261 >>> 0;
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  for (let i = 0; i < fits.length; i++) { f[0] = Math.round(fits[i] * 1e12); h = Math.imul(h ^ u[0], 16777619); h = Math.imul(h ^ u[1], 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- Scoring from snapshots. The GPU cannot run the swim test's bookkeeping, so it hands back the
// atom positions at the half, three-quarter and end marks plus the final bonds, and this function
// repeats the swim test's arithmetic on them. snapshotFit(cpuSnapshots(t)) equals runTrial(t) exactly.
export function snapshotFit(s) {
  if (s.bad) return -1;
  const n = s.n;
  for (let i = 0; i < n; i++) if (!(s.x2[i] === s.x2[i]) || !(s.y2[i] === s.y2[i])) return -1;
  const c = components({ n, nbonds: s.nbonds, ba: s.ba, bb: s.bb, x: s.x2, y: s.y2, boundary: 'open' }, 1.5);
  let big = 0; for (let k = 1; k < c.count; k++) if (c.sizes[k] > c.sizes[big]) big = k;
  const body = []; for (let i = 0; i < n; i++) if (c.comp[i] === big) body.push(i);
  const cen = (X, Y) => { let x = 0, y = 0; for (const i of body) { x += X[i]; y += Y[i]; } return [x / body.length, y / body.length]; };
  const c0 = cen(s.x0, s.y0), c1 = cen(s.x1, s.y1), c2 = cen(s.x2, s.y2);
  const d1 = [c1[0] - c0[0], c1[1] - c0[1]], d2 = [c2[0] - c1[0], c2[1] - c1[1]];
  const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
  const net = Math.hypot(d1[0] + d2[0], d1[1] + d2[1]);
  const halfTime = (STEPS - (STEPS >> 1)) * s.dt;
  let spread0 = 0; for (const i of body) spread0 = Math.max(spread0, Math.hypot(s.x0[i] - c0[0], s.y0[i] - c0[1]));
  let spread2 = 0; for (const i of body) spread2 = Math.max(spread2, Math.hypot(s.x2[i] - c2[0], s.y2[i] - c2[1]));
  const cohesive = body.length >= 3 && body.length >= 0.75 * n && spread0 < spread2 * 1.5 + 1;
  const sustain = Math.min(l1, l2) / (Math.max(l1, l2) + 1e-9);
  return cohesive ? (net / halfTime) * (0.25 + 0.75 * sustain) : 0;
}

// Run a trial on the CPU but only keep what the GPU path keeps. `stopAt` cuts the run short (for
// comparing early positions with the GPU, before rounding differences have had time to grow).
export function cpuSnapshots(t, stopAt = STEPS) {
  const w = new World(t.R, { cap: t.atoms.length + 1, boundary: 'open', T: 0, seed: 7 });
  for (const a of t.atoms) w.add(a.t, a.x, a.y);
  const n = w.n, h = STEPS >> 1, q3 = h + (STEPS >> 2), s = { n, dt: w.dt, bad: false };
  const grab = (k) => { s['x' + k] = Float64Array.from(w.x.subarray(0, n)); s['y' + k] = Float64Array.from(w.y.subarray(0, n)); };
  for (let i = 0; i < stopAt; i++) {
    w.step();
    if (i === h - 1) grab(0);
    if (i === q3 - 1) grab(1);
    if (w.stat.capHits > 0 || !(w.x[0] === w.x[0])) { s.bad = true; break; }
  }
  grab(2);
  s.nbonds = w.nbonds; s.ba = w.ba.slice(0, w.nbonds); s.bb = w.bb.slice(0, w.nbonds); s.formed = w.stat.formed;
  return s;
}

export function summarize(fits) {
  let bad = 0, zero = 0, pos = 0, sum = 0, best = 0;
  for (const f of fits) { if (f < 0) bad++; else if (f < 1e-4) zero++; else pos++; if (f > 0) sum += f; if (f > best) best = f; }
  return { trials: fits.length, unstable: bad, still: zero, moving: pos, meanFit: sum / fits.length, bestFit: best };
}

export { World };
