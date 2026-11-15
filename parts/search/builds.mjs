// Search over builds a person could make (5 to 15 atoms, goo-style placement) under fixed hidden numbers.
// Keeps the fastest swimmer in each bin of: size, how elongated, how much it bends, number of jitters.
// Usage: node search/builds.mjs <seed> <evals> <out.json> [params.json]
import fs from 'node:fs';
import { Parts, rng32, BEAD, JITTER, STICKY, ROD, SPRING, ROPE, FUSE } from '../sim.js';
const MAIN = process.argv[1].endsWith('builds.mjs');
const seed = MAIN ? +process.argv[2] || 1 : 1, EVALS = +process.argv[3] || 20000, out = process.argv[4] || `results/builds-${seed}.json`;
let r = rng32(seed * 7919 + 5); const NMAX = 15, REACH = 2.1;
const KINDS = [BEAD, BEAD, JITTER, STICKY], LK = [ROD, ROD, SPRING, SPRING, ROPE, FUSE];
const pick = (a) => a[Math.floor(r() * a.length)];

// place one atom the way the sandbox does: near the build, linked to its one or two nearest atoms
function grow(b) {
  for (let t = 0; t < 30; t++) {
    const p = pick(b.atoms), ang = r() * 6.2832, d = 1 + r() * 0.6, x = p[1] + d * Math.cos(ang), y = p[2] + d * Math.sin(ang);
    const near = []; let ok = true;
    b.atoms.forEach((q, i) => { const dd = Math.hypot(q[1] - x, q[2] - y); if (dd < 0.92) ok = false; else if (dd < REACH) near.push([dd, i]); });
    if (!ok || !near.length) continue;
    near.sort((a, c) => a[0] - c[0]); const i = b.atoms.length, lk = pick(LK);
    b.atoms.push([pick(KINDS), x, y]);
    for (const e of near.slice(0, r() < 0.7 ? 2 : 1)) b.links.push([i, e[1], r() < 0.7 ? lk : pick(LK)]);
    return true;
  }
  return false;
}
function randomBuild() { const b = { atoms: [[pick(KINDS), 0, 0]], links: [] }; const n = 4 + Math.floor(r() * 9); while (b.atoms.length < n) if (!grow(b)) break; return b; }
function removeAtom(b, i) { b.atoms.splice(i, 1); b.links = b.links.filter(l => l[0] !== i && l[1] !== i).map(l => [l[0] > i ? l[0] - 1 : l[0], l[1] > i ? l[1] - 1 : l[1], l[2]]); }
function mutate(b) {
  const u = r();
  if (u < 0.3 && b.atoms.length < NMAX) grow(b);
  else if (u < 0.42 && b.atoms.length > 3) removeAtom(b, Math.floor(r() * b.atoms.length));
  else if (u < 0.56) pick(b.atoms)[0] = pick(KINDS);
  else if (u < 0.72 && b.links.length) pick(b.links)[2] = pick(LK);
  else if (u < 0.8 && b.links.length > 2) b.links.splice(Math.floor(r() * b.links.length), 1);
  else if (u < 0.88) { const i = Math.floor(r() * b.atoms.length), j = Math.floor(r() * b.atoms.length); const d = Math.hypot(b.atoms[i][1] - b.atoms[j][1], b.atoms[i][2] - b.atoms[j][2]);
    if (i !== j && d < REACH + 0.6 && !b.links.some(l => (l[0] === i && l[1] === j) || (l[0] === j && l[1] === i))) b.links.push([i, j, pick(LK)]); }
  else if (u < 0.94) { const i = Math.floor(r() * b.atoms.length), j = Math.floor(r() * b.atoms.length); if (i !== j) { // swap placement order (changes which jitter fires first)
      const t = b.atoms[i]; b.atoms[i] = b.atoms[j]; b.atoms[j] = t; for (const l of b.links) for (const k of [0, 1]) l[k] = l[k] === i ? j : l[k] === j ? i : l[k]; } }
  else { const a = pick(b.atoms); a[1] += (r() - 0.5) * 0.5; a[2] += (r() - 0.5) * 0.5; }
  return b;
}
function valid(b) {
  if (b.atoms.length < 3 || b.atoms.length > NMAX) return false;
  for (let i = 0; i < b.atoms.length; i++) for (let j = i + 1; j < b.atoms.length; j++) if (Math.hypot(b.atoms[i][1] - b.atoms[j][1], b.atoms[i][2] - b.atoms[j][2]) < 0.9) return false;
  for (const l of b.links) { const d = Math.hypot(b.atoms[l[0]][1] - b.atoms[l[1]][1], b.atoms[l[0]][2] - b.atoms[l[1]][2]); if (d > REACH + 0.6) return false; }
  return b.atoms.some(a => a[0] === JITTER);
}
// run a build in open water and measure travel, shape and bending
export function measure(build, params, secs = 50, seedN = 1) {
  const w = new Parts(params, { W: 8, H: 8, walls: false, freeEnergy: true, cap: 64, seed: seedN });
  w.load(build, 4, 4); const n = w.n, links0 = w.nb;
  if (w.component(0).length < n) return null; // must be one piece
  // the two atoms furthest apart mark the ends; bending is how much the angle at the middle swings
  let A = 0, B = 1, far = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.hypot(w.x[i] - w.x[j], w.y[i] - w.y[j]); if (d > far) { far = d; A = i; B = j; } }
  const cen = () => { let x = 0, y = 0; for (let i = 0; i < n; i++) { x += w.x[i]; y += w.y[i]; } return [x / n, y / n]; };
  const steps = Math.round(secs / w.p.dt), half = steps >> 1; let a0, s1 = 0, s2 = 0, m = 0, lenSum = 0;
  for (let s = 0; s < steps; s++) {
    w.step(); if (s === half) a0 = cen();
    if (s > half && (s & 3) === 0) { const c = cen(), ax = w.x[A] - c[0], ay = w.y[A] - c[1], bx = w.x[B] - c[0], by = w.y[B] - c[1];
      const cr = ax * by - ay * bx, dt = ax * bx + ay * by, bend = cr / (Math.sqrt(cr * cr + dt * dt) + 1e-9); // sine of the angle between the two arms
      s1 += bend; s2 += bend * bend; m++; lenSum += Math.hypot(w.x[A] - w.x[B], w.y[A] - w.y[B]); }
  }
  if (w.stat.capHits || w.nb < links0 - w.stat.glued || w.stat.snapped) return null; // nothing may break
  const b = cen(), speed = Math.hypot(b[0] - a0[0], b[1] - a0[1]) / (secs / 2);
  let gxx = 0, gxy = 0, gyy = 0; for (let i = 0; i < n; i++) { const ax = w.x[i] - b[0], ay = w.y[i] - b[1]; gxx += ax * ax; gxy += ax * ay; gyy += ay * ay; }
  const tr = gxx + gyy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - (gxx * gyy - gxy * gxy))), aspect = Math.sqrt((tr / 2 + disc) / Math.max(1e-6, tr / 2 - disc));
  const bendAmp = Math.sqrt(Math.max(0, s2 / m - (s1 / m) ** 2));
  return { speed, aspect, bendAmp, length: lenSum / m, n, jitters: build.atoms.filter(a => a[0] === JITTER).length };
}
function cellOf(m) {
  const nb = m.n <= 5 ? 0 : m.n <= 8 ? 1 : m.n <= 11 ? 2 : 3, ab = m.aspect < 1.8 ? 0 : m.aspect < 3.5 ? 1 : 2;
  const bb = m.bendAmp < 0.05 ? 0 : m.bendAmp < 0.2 ? 1 : 2, jb = Math.min(m.jitters, 3) - 1;
  return `${nb}|${ab}|${bb}|${jb}`;
}
// Run a build search. init: builds to start from. Returns elites sorted fastest first.
export function runSearch(params, seedN, evals, init = [], log = null, outFile = null, custom = null) {
  r = rng32(seedN * 7919 + 5);
  const archive = new Map(), t0 = Date.now();
  const consider = custom ? (b) => { if (!valid(b)) return; const m = custom.measure(b, params); if (!m) return; const key = custom.cellOf(m, b), cur = archive.get(key); if (!cur || m.f > cur.f) archive.set(key, { f: m.f, build: b, m }); }
    : (b) => { if (!valid(b)) return; const m = measure(b, params, 50, 1); if (!m) return; const key = cellOf(m), cur = archive.get(key); if (cur && m.speed <= cur.f) return;
    const m2 = measure(b, params, 50, 2); if (!m2) return; const f = Math.min(m.speed, m2.speed); if (!cur || f > cur.f) archive.set(key, { f, build: b, m }); };
  for (const b of init) consider(JSON.parse(JSON.stringify(b)));
  const sorted = () => [...archive.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.f - a.f);
  for (let i = 0; i < evals; i++) {
    if (i < evals / 10 || !archive.size) consider(randomBuild());
    else { const keys = [...archive.keys()], p = archive.get(pick(keys)), b = JSON.parse(JSON.stringify(p.build)); mutate(b); if (r() < 0.4) mutate(b); consider(b); }
    if (log && ((i + 1) % 10000 === 0 || i === evals - 1)) { const all = sorted(); if (outFile) fs.writeFileSync(outFile, JSON.stringify(all));
      const bendy = custom ? null : all.filter(e => e.m.aspect >= 2.5 && e.m.bendAmp >= 0.2)[0];
      log(`seed ${seedN} evals ${i + 1} cells ${all.length} best ${all[0].f.toFixed(2)} [${all[0].key}] best long bender ${bendy ? bendy.f.toFixed(2) + ' n' + bendy.m.n : '-'} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
  }
  return sorted();
}
if (MAIN) {
  const params = JSON.parse(fs.readFileSync(process.argv[5] || new URL('../params.json', import.meta.url)));
  runSearch(params, seed, EVALS, [], console.log, out);
}
