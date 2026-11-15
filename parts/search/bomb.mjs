import fs from 'node:fs';
import { Parts, BEAD, FUSE } from '../sim.js';
const base = JSON.parse(fs.readFileSync('params.json'));
for (const kick of [8, 14, 20, 30]) for (const snap of [0.12, 0.08]) {
  const w = new Parts({ ...base, fuseKick: kick, snap: [0.6, 2.5, 0.6, snap, 0.6] }, { W: 48, H: 30 });
  w.add(BEAD, 24, 15); for (let k = 0; k < 6; k++) w.add(BEAD, 24 + 1.05 * Math.cos(k * Math.PI / 3), 15 + 1.05 * Math.sin(k * Math.PI / 3));
  for (let k = 0; k < 6; k++) { w.link(0, k + 1, FUSE); w.link(k + 1, (k + 1) % 6 + 1, FUSE); }
  for (let s = 0; s < 200; s++) w.step(); const quiet = w.stat.snapped;
  w.vx[1] += 12; for (let s = 0; s < 300; s++) w.step();
  let far = 0; for (let i = 0; i < w.n; i++) far = Math.max(far, Math.hypot(w.x[i] - 24, w.y[i] - 15));
  console.log('kick', kick, 'snap', snap, 'broke when left alone', quiet, 'broke after a flick', w.stat.snapped, 'of 12; flung', far.toFixed(1), 'cap', w.stat.capHits);
}
