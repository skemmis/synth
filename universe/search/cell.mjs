// Search for a whole cell: a closed membrane that stays closed while something attached to it swims.
// Fitness = swim speed x how much of a compartment survives. Seeded with rings (a ring is the one
// thing we place by hand; whether it holds, and whether anything can push it, is up to the rules).
// Usage: node search/cell.mjs <seed> <evals> <outfile> <swimmer elites json...>
import fs from 'node:fs';
import { randomRules, randomOrganism, mutateRules, mutateOrganism, addType, ring, clone, rng32, lerp } from '../rules.js';
import { swimTest } from '../metrics.js';
const seed = +process.argv[2] || 1, EVALS = +process.argv[3] || 50000, out = process.argv[4];
const r = rng32(seed * 6151 + 3);
let elites = []; for (const f of process.argv.slice(5)) elites.push(...JSON.parse(fs.readFileSync(f)));
elites.sort((a, b) => b.f - a.f); elites = elites.slice(0, 60);
const archive = new Map();
const AREA = 8;
function cellOf(R, atoms, m) {
  const sb = R.shadow === 0 ? 0 : R.shadow < 0.6 ? 1 : 2, gb = R.g2 === 0 ? 0 : R.g2 < 0.4 ? 1 : 2;
  const n = atoms.length, nb = n <= 16 ? 0 : n <= 24 ? 1 : n <= 34 ? 2 : 3;
  const ab = m.voidArea < 14 ? 0 : m.voidArea < 28 ? 1 : 2;
  return `${sb}|${gb}|${nb}|${ab}`;
}
function consider(R, atoms) {
  if (atoms.length > 48) return;
  const m = swimTest(R, atoms, { voids: true });
  if (!m || m.bad || !(m.voidArea > 2)) return;
  const f = (0.002 + m.fit * (m.cyclesPerTime > 0.05 ? 1 : 0.2)) * Math.min(1, m.voidArea / AREA);
  const key = cellOf(R, atoms, m), cur = archive.get(key);
  if (!cur || f > cur.f) archive.set(key, { f, R, atoms, m });
}
function seedCell() {
  // a ring type added to a swimmer's universe (or a fresh one), with the swimmer parked on the outside
  let R, rider;
  if (elites.length && r() < 0.8) { const e = elites[Math.floor(r() * elites.length)]; R = clone(e.R); rider = clone(e.atoms); }
  else { R = randomRules(r, { K: 1 + Math.floor(r() * 3) }); rider = randomOrganism(r, R.K, 3, 8); }
  if (R.K >= 6) return null;
  const r0 = lerp(1.0, 1.4, r());
  const M = addType(r, R, { val: 2 + Math.floor(r() * 3), recharge: 0 }, { on: 1, r0, form: r0 * 1.25, k: lerp(30, 120, r()), snap: lerp(0.6, 1.5, r()), life: 0, kick: 0 });
  // let the membrane type bond to at least one rider type, so the rider can hold on
  const hold = Math.floor(r() * (R.K - 1)); const hb = R.bond[hold][M]; hb.on = 1; hb.life = 0; hb.kick = 0; hb.r0 = 1.1; hb.form = 1.5;
  const n = 12 + Math.floor(r() * 12), atoms = ring(M, n, r0);
  const rad = n * r0 / 6.283185307; let lo = Infinity; for (const a of rider) lo = Math.min(lo, a.x);
  for (const a of rider) atoms.push({ t: a.t, x: a.x - lo + rad + 1.1, y: a.y });
  if (r() < 0.5) atoms.push({ t: Math.floor(r() * R.K), x: 0, y: 0 }); // cargo
  return { R, atoms };
}
const t0 = Date.now(), INIT = Math.min(4000, EVALS / 5);
for (let i = 0; i < EVALS; i++) {
  if (i < INIT || archive.size === 0) { const s = seedCell(); if (s) consider(s.R, s.atoms); }
  else {
    const keys = [...archive.keys()], p = archive.get(keys[Math.floor(r() * keys.length)]);
    const R = clone(p.R), atoms = clone(p.atoms), u = r();
    if (u < 0.6) mutateRules(r, R, 0.08, 0.12);
    if (u > 0.4) { mutateOrganism(r, atoms, R.K, 48); if (r() < 0.3) mutateOrganism(r, atoms, R.K, 48); }
    consider(R, atoms);
  }
  if ((i + 1) % 5000 === 0 || i === EVALS - 1) {
    const all = [...archive.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.f - a.f);
    fs.writeFileSync(out, JSON.stringify(all));
    console.log(`seed ${seed} evals ${i + 1} cells ${all.length} best ${all[0]?.f.toFixed(4)} [${all[0]?.key}] area ${all[0]?.m.voidArea.toFixed(1)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
