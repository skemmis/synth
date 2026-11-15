// Quality-diversity (MAP-Elites) search for swimmers. A genome is a rule set plus a placement of atoms.
// Usage: node search/cilia.mjs <seed> <evals> <outfile> [medium] [seedfile]
import fs from 'node:fs';
import { randomRules, randomOrganism, mutateRules, mutateOrganism, clone, rng32 } from '../rules.js';
import { swimTest } from '../metrics.js';

const seed = +process.argv[2] || 1, EVALS = +process.argv[3] || 100000, out = process.argv[4] || `results/cilia-${seed}.json`;
const medium = process.argv[5] || 'any', seedfile = process.argv[6];
const r = rng32(seed * 7919 + 13);
const lock = medium === 'any' ? {} : { medium: true };
const archive = new Map();
// FORCES_ONLY=1 switches bonds off and allows one-sided (non-reciprocal) forces, as in 'particle life'
const EXTRA = process.env.FORCES_ONLY ? { bonds: false, nonrecip: 1 } : {};
if (process.env.FORCES_ONLY) lock.bonds = true;

export function cellOf(R, atoms, m) {
  const sb = R.shadow === 0 ? 0 : R.shadow < 0.6 ? 1 : 2;
  const gb = R.g2 === 0 ? 0 : R.g2 < 0.4 ? 1 : 2;
  const n = atoms.length, nb = n <= 4 ? 0 : n <= 8 ? 1 : n <= 14 ? 2 : 3;
  const used = new Set(atoms.map(a => a.t)).size, tb = Math.min(used, 4) - 1;
  return `${sb}|${gb}|${nb}|${tb}`;
}
function score(m) {
  if (!m || m.bad) return 0;
  return m.fit * (m.cyclesPerTime > 0.05 ? 1 : 0.2);
}
function consider(R, atoms) {
  const m = swimTest(R, atoms);
  const f = score(m);
  if (f <= 0) return;
  const key = cellOf(R, atoms, m), cur = archive.get(key);
  if (!cur || f > cur.f) archive.set(key, { f, R, atoms, m });
}
if (seedfile) for (const e of JSON.parse(fs.readFileSync(seedfile))) consider(e.R, e.atoms);
const INIT = Math.min(5000, EVALS / 5);
let t0 = Date.now();
for (let i = 0; i < EVALS; i++) {
  if (i < INIT || archive.size === 0) {
    const R = randomRules(r, { medium, ...EXTRA }); consider(R, randomOrganism(r, R.K));
  } else {
    const keys = [...archive.keys()], p = archive.get(keys[Math.floor(r() * keys.length)]);
    const R = clone(p.R), atoms = clone(p.atoms), u = r();
    if (u < 0.6) mutateRules(r, R, 0.1, 0.12, lock);
    if (u > 0.4) { mutateOrganism(r, atoms, R.K); if (r() < 0.3) mutateOrganism(r, atoms, R.K); }
    consider(R, atoms);
  }
  if ((i + 1) % 20000 === 0 || i === EVALS - 1) {
    const all = [...archive.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.f - a.f);
    fs.writeFileSync(out, JSON.stringify(all));
    console.log(`seed ${seed} evals ${i + 1} cells ${all.length} best ${all[0]?.f.toFixed(4)} [${all[0]?.key}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
