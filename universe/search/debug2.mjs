import fs from 'node:fs';
import { World } from '../sim.js';
const P = JSON.parse(fs.readFileSync('gallery/presets.json'));
for (const id of ['control', 'slow-kicker']) for (const boundary of ['open', 'periodic']) {
  const p = P.find(p => p.id === id);
  const w = new World(p.rules, { cap: 100, boundary, W: 80, H: 80, T: 0 });
  for (const a of p.atoms) w.add(a.t, a.x + 40, a.y + 40);
  const inv = () => { let gx = 0, gy = 0, G = 0, cx = 0, cy = 0; for (let i = 0; i < w.n; i++) { const t = w.type[i], g = w.g1 * w.drag[t]; gx += g * w.x[i] + w.mass[t] * w.vx[i]; gy += g * w.y[i] + w.mass[t] * w.vy[i]; G += g; cx += w.x[i] / w.n; cy += w.y[i] / w.n; } return [gx / G, gy / G, cx, cy]; };
  const a = inv(); for (let s = 0; s < 1500; s++) w.step(); const b = inv(); for (let s = 0; s < 4500; s++) w.step(); const c = inv();
  console.log(id, boundary, 'invariant drift', (c[0] - a[0]).toFixed(3), (c[1] - a[1]).toFixed(3), 'centroid 0-30s', Math.hypot(b[2] - a[2], b[3] - a[3]).toFixed(2), '30-120s', Math.hypot(c[2] - b[2], c[3] - b[3]).toFixed(2), 'formed', w.stat.formed);
}
{
  const p = P.find(p => p.id === 'control');
  const w = new World(p.rules, { cap: 100, boundary: 'open', T: 0 });
  for (const a of p.atoms) w.add(a.t, a.x, a.y);
  const inv = () => { let gy = 0, G = 0; for (let i = 0; i < w.n; i++) { const t = w.type[i], g = w.g1 * w.drag[t]; gy += g * w.y[i] + w.mass[t] * w.vy[i]; G += g; } return gy / G; };
  let last = inv();
  for (let s = 0; s < 6000; s++) { const st = JSON.stringify(w.stat), nb = w.nbonds; w.step(); const v = inv(); if (Math.abs(v - last) > 0.05) console.log('step', s, 'jump', (v - last).toFixed(3), st, JSON.stringify(w.stat), nb, w.nbonds, 'maxv', Math.max(...Array.from(w.vy.subarray(0, w.n)).map(Math.abs)).toFixed(1)); last = v; }
  console.log('cap', w.stat.capHits, 'T', p.rules.T, 'nonrecip', p.rules.nonrecip);
}
