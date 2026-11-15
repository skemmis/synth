// Validate elites: half time step, 3x longer run, and the linear-drag control (must not swim).
import fs from 'node:fs';
import { swimTest } from '../metrics.js';
const files = process.argv.slice(2);
let all = []; for (const f of files) all.push(...JSON.parse(fs.readFileSync(f)));
all.sort((a, b) => b.f - a.f);
const f3 = (v) => (v === undefined ? '-' : (+v).toFixed(3));
console.log('cell      f      half-dt  long   linear | n types cyc/t beatAmp hz  size  g1 g2 shadow');
for (const e of all.slice(0, +process.env.TOP || 25)) {
  const half = swimTest(e.R, e.atoms, { dt: 0.01 });
  const long = swimTest(e.R, e.atoms, { steps: 12000 });
  const lin = swimTest({ ...e.R, g2: 0, shadow: 0 }, e.atoms);
  const m = e.m;
  console.log(e.key.padEnd(9), f3(e.f), f3(half.fit), f3(long.fit), f3(lin.fit), '|', m.n, new Set(e.atoms.map(a => a.t)).size, f3(m.cyclesPerTime), f3(m.beatAmp), f3(m.beatHz), f3(m.size), f3(e.R.g1), f3(e.R.g2), f3(e.R.shadow));
}
