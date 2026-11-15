// The control, done carefully: same body, plain linear water, no speed-cap hits allowed.
// Reports late speed of the centroid of ALL atoms (no cohesion requirement).
import fs from 'node:fs';
import { World } from '../sim.js';
const rows = JSON.parse(fs.readFileSync(process.argv[2])).filter(r => r.robust > 0.3);
let clean = 0, capped = 0, worst = 0; const out = [];
for (const r of rows) {
  const w = new World({ ...r.R, g2: 0, shadow: 0 }, { cap: r.atoms.length + 1, T: 0 }); for (const a of r.atoms) w.add(a.t, a.x, a.y);
  const cen = () => { let x = 0, y = 0; for (let i = 0; i < w.n; i++) { x += w.x[i]; y += w.y[i]; } return [x / w.n, y / w.n]; };
  for (let s = 0; s < 6000; s++) w.step(); const a = cen(); for (let s = 0; s < 6000; s++) w.step(); const b = cen();
  const sp = Math.hypot(b[0] - a[0], b[1] - a[1]) / 120;
  if (w.stat.capHits > 0) capped++; else { clean++; worst = Math.max(worst, sp); out.push([sp, r.robust, r.key, r.n, w.stat.formed]); r.controlSpeed = sp; }
}
console.log('swimmers', rows.length, 'clean controls', clean, 'capped', capped, 'fastest clean control', worst.toFixed(4), 'widths/s');
fs.writeFileSync('results/controls.json', JSON.stringify(rows.filter(r => r.controlSpeed !== undefined)));
out.sort((a, b) => b[1] - a[1]); console.log(out.slice(0, 6).map(o => o.map(v => typeof v === 'number' ? +v.toFixed(4) : v).join(' ')).join('\n'));
