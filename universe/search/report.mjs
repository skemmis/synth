// Validate and describe elites. Usage: node search/report.mjs <out.json> <elite files...>
// Keeps only swimmers that survive: half time step, 3x duration, thermal noise; and that stop when the
// water is made purely linear (the control that proves they push on the water).
import fs from 'node:fs';
import { swimTest } from '../metrics.js';
import { World } from '../sim.js';
const out = process.argv[2]; let all = [];
for (const f of process.argv.slice(3)) all.push(...JSON.parse(fs.readFileSync(f)).map(e => ({ ...e, src: f })));
all.sort((a, b) => b.f - a.f);
const TOPN = +process.env.TOP || 200, voids = !!process.env.VOIDS;
const rows = [];
for (const e of all.slice(0, TOPN)) {
  const base = swimTest(e.R, e.atoms, { voids });
  const half = swimTest(e.R, e.atoms, { dt: 0.01, voids });
  const long = swimTest(e.R, e.atoms, { steps: 12000, voids });
  const lin = swimTest({ ...e.R, g2: 0, shadow: 0 }, e.atoms);
  let noisy = 0; for (let s = 1; s <= 3; s++) noisy += (swimTest(e.R, e.atoms, { T: 0.05, seed: s, voids }).fit || 0) / 3;
  const robust = Math.min(base.fit || 0, half.fit || 0, long.fit || 0, noisy);
  // which bonds cycle, and what powers the stroke
  const w = new World(e.R, { cap: e.atoms.length + 1 }); for (const a of e.atoms) w.add(a.t, a.x, a.y);
  for (let s = 0; s < 4000; s++) w.step();
  const K = e.R.K; let kickE = 0, pullE = 0; const cyc = [];
  for (let i = 0; i < K; i++) for (let j = i; j < K; j++) {
    const nf = w.formedBy[i * K + j] + (i !== j ? w.formedBy[j * K + i] : 0); if (nf < 5) continue;
    const b = e.R.bond[i][j], st = Math.max(0, b.form - b.r0);
    const ke = 0.5 * b.kick * b.kick * (1 / e.R.types[i].m + 1 / e.R.types[j].m), pe = 0.5 * b.k * st * st;
    kickE += nf * ke; pullE += nf * pe; cyc.push({ i, j, n: nf, life: b.life });
  }
  const power = (base.energyPerTime || 0) * (e.R.eUnit || 50);
  rows.push({
    key: e.key, src: e.src, f: e.f, robust, base: base.fit, half: half.fit, long: long.fit, noisy, linear: lin.fit,
    n: e.atoms.length, types: new Set(e.atoms.map(a => a.t)).size, size: base.size, beatHz: base.cyclesPerTime, power,
    stroke: kickE + pullE === 0 ? 'none' : kickE > 3 * pullE ? 'kick' : pullE > 3 * kickE ? 'pull' : 'mixed',
    water: e.R.g2 > 0 && e.R.shadow > 0 ? 'both' : e.R.g2 > 0 ? 'splash' : e.R.shadow > 0 ? 'slipstream' : 'linear',
    cyc, voidArea: Math.min(base.voidArea || 0, half.voidArea || 0, long.voidArea || 0), R: e.R, atoms: e.atoms, m: base,
  });
}
rows.sort((a, b) => b.robust - a.robust);
fs.writeFileSync(out, JSON.stringify(rows));
const f3 = (v) => (+v || 0).toFixed(3);
console.log('robust base  half  long  noisy linear | n ty size hz    power  stroke water      void  cell');
for (const r of rows.slice(0, +process.env.SHOW || 40)) console.log(f3(r.robust), f3(r.base), f3(r.half), f3(r.long), f3(r.noisy), f3(r.linear), '|', String(r.n).padStart(2), r.types, f3(r.size), f3(r.beatHz).padStart(6), r.power.toFixed(1).padStart(6), r.stroke.padEnd(6), r.water.padEnd(10), f3(r.voidArea), r.key);
const tally = {}; for (const r of rows) if (r.robust > 0.1) { const k = r.stroke + '/' + r.water; tally[k] = (tally[k] || 0) + 1; }
console.log('robust > 0.1 by mechanism:', JSON.stringify(tally), 'of', rows.length);
