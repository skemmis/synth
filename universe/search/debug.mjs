import fs from 'node:fs';
import { World } from '../sim.js';
const all = JSON.parse(fs.readFileSync('results/cilia-3.json'));
const e = all[0]; const R = { ...e.R, g2: 0, shadow: 0 };
console.log(JSON.stringify(e.R.types), e.atoms.map(a => a.t).join(''));
for (let i = 0; i < R.K; i++) for (let j = i; j < R.K; j++) console.log(i, j, JSON.stringify(e.R.pair[i][j]), JSON.stringify(e.R.bond[i][j]));
const w = new World(R, { cap: 32, boundary: 'open' });
for (const a of e.atoms) w.add(a.t, a.x, a.y);
for (let s = 0; s <= 4000; s++) {
  if (s % 500 === 0) {
    let gx = 0, px = 0, gy = 0, py = 0, G = 0;
    for (let i = 0; i < w.n; i++) { const t = w.type[i], g = w.g1 * w.drag[t]; gx += g * w.x[i]; gy += g * w.y[i]; px += w.mass[t] * w.vx[i]; py += w.mass[t] * w.vy[i]; G += g; }
    console.log(s, 'inv', ((gx + px) / G).toFixed(4), ((gy + py) / G).toFixed(4), 'bonds', w.nbonds, JSON.stringify(w.stat), Array.from(w.x.subarray(0, w.n)).map(v => v.toFixed(1)).join(' '));
  }
  w.step();
}
{
  const w = new World(R, { cap: 32, boundary: 'open' });
  for (const a of e.atoms) w.add(a.t, a.x, a.y);
  let shown = 0;
  for (let s = 0; s < 600 && shown < 6; s++) {
    let p0x = 0, drag = 0; for (let i = 0; i < w.n; i++) { const t = w.type[i]; p0x += w.mass[t] * w.vx[i]; drag += w.g1 * w.drag[t] * w.vx[i]; }
    const st0 = JSON.stringify(w.stat), nb0 = w.nbonds;
    w.step();
    let p1x = 0; for (let i = 0; i < w.n; i++) p1x += w.mass[w.type[i]] * w.vx[i];
    const resid = p1x - p0x + drag * w.dt;
    // note: kicks change v before drag is evaluated, so allow a small tolerance
    if (Math.abs(resid) > 0.02) { shown++; console.log('step', s, 'resid', resid.toFixed(4), st0, JSON.stringify(w.stat), nb0, w.nbonds); }
  }
}
