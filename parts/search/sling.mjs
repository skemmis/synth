// Quick check: which slingshot throws furthest? Pull the cradle back 5 widths, let go, see where the shot lands.
import fs from 'node:fs';
import { Parts, BEAD, JITTER, ROCK, SPRING, ROD, ROPE } from '../sim.js';
const params = JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url)));
function shot(cradleKind, shotKind, link, gap, pull) {
  const w = new Parts(params, { W: 60, H: 30 }); w.add(ROCK, 10, 15 - gap); w.add(ROCK, 10, 15 + gap);
  const c = w.add(cradleKind, 10.6, 15), s = w.add(shotKind, 11.7, 15); w.link(0, c, link); w.link(1, c, link);
  // hold the cradle pulled back with the shot resting against it, then release
  for (let k = 0; k < 150; k++) { w.x[c] = 10.6 - pull; w.y[c] = 15; w.vx[c] = w.vy[c] = 0; w.x[s] = 11.7 - pull; w.y[s] = 15; w.vx[s] = w.vy[s] = 0; w.step(); }
  if (w.nb < 2) return 'links broke';
  for (let k = 0; k < 500; k++) w.step();
  return (w.x[s] - 11.7).toFixed(1);
}
const KN = { [BEAD]: 'bead', [JITTER]: 'jitter' }, LN = { [SPRING]: 'spring', [ROPE]: 'rope', [ROD]: 'rod' };
for (const link of [SPRING, ROPE]) for (const ck of [BEAD, JITTER]) for (const sk of [BEAD, JITTER]) for (const gap of [1.5, 3]) for (const pull of [3, 5])
  console.log(LN[link].padEnd(7), 'cradle', KN[ck].padEnd(7), 'shot', KN[sk].padEnd(7), 'gap', gap, 'pull', pull, '-> flies', shot(ck, sk, link, gap, pull));
