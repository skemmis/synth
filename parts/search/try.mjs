// Hand builds, checked headless: does it travel? (no walls, free energy, 60 s, second half measured)
import { Parts, BEAD, JITTER, STICKY, ROD, SPRING, ROPE, FUSE } from '../sim.js';
export function travel(build, params = {}, secs = 60) {
  const w = new Parts(params, { W: 8, H: 8, walls: false, freeEnergy: true, cap: 200 });
  w.load(build, 4, 4); const n = w.n;
  const cen = () => { let x = 0, y = 0; for (let i = 0; i < n; i++) { x += w.x[i]; y += w.y[i]; } return [x / n, y / n]; };
  const steps = Math.round(secs / w.p.dt); for (let s = 0; s < steps / 2; s++) w.step(); const a = cen(); for (let s = 0; s < steps / 2; s++) w.step(); const b = cen();
  return { speed: Math.hypot(b[0] - a[0], b[1] - a[1]) / (secs / 2), links: w.nb, cap: w.stat.capHits };
}
const S3 = 0.866;
export const BUILDS = {
  // rod triangle body, a jitter at one corner holding a bead on a spring
  tadpole: { atoms: [[BEAD, 0, 0], [BEAD, 1, 0], [JITTER, 0.5, S3], [BEAD, 0.5, S3 + 1.4]], links: [[0, 1, ROD], [1, 2, ROD], [0, 2, ROD], [2, 3, SPRING]] },
  // the same with the paddle on a rope
  roper: { atoms: [[BEAD, 0, 0], [BEAD, 1, 0], [JITTER, 0.5, S3], [BEAD, 0.5, S3 + 1.4]], links: [[0, 1, ROD], [1, 2, ROD], [0, 2, ROD], [2, 3, ROPE]] },
  // a ladder of rods with jitters down one side on springs: the cilium bet
  ladder: (() => { const atoms = [], links = []; const N = 5;
    for (let k = 0; k < N; k++) { atoms.push([k % 2 ? JITTER : BEAD, 0, k * 1.1]); atoms.push([BEAD, 1.1, k * 1.1]); }
    for (let k = 0; k < N; k++) { links.push([2 * k, 2 * k + 1, ROD]); if (k) { links.push([2 * k - 1, 2 * k + 1, ROD]); links.push([2 * k - 2, 2 * k, SPRING]); links.push([2 * k - 2, 2 * k + 1, ROD]); } }
    return { atoms, links }; })(),
  // two jitters in a row, one bead each end: a three-link chain
  worm: { atoms: [[BEAD, 0, 0], [JITTER, 1.2, 0], [JITTER, 2.4, 0], [BEAD, 3.6, 0]], links: [[0, 1, SPRING], [1, 2, SPRING], [2, 3, SPRING]] },
};
if (process.argv[1].endsWith('try.mjs')) for (const [name, b] of Object.entries(BUILDS)) { const r = travel(b); console.log(name.padEnd(10), 'speed', r.speed.toFixed(3), 'links', r.links, 'cap', r.cap); }
