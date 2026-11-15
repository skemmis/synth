// How much gravity can the swimmers take? Sink speed of an idle build, and climb of a worm pointed up.
import fs from 'node:fs';
import { Parts, BEAD, JITTER, FLOAT, SPRING, ROD } from '../sim.js';
const params = JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url)));
const worm = (up) => ({ atoms: [[BEAD, 0, 0], [JITTER, 0, 1.2 * up], [JITTER, 0, 2.4 * up], [BEAD, 0, 3.6 * up]], links: [[0, 1, SPRING], [1, 2, SPRING], [2, 3, SPRING]] });
const tri = { atoms: [[BEAD, 0, 0], [BEAD, 1, 0], [BEAD, 0.5, 0.87]], links: [[0, 1, ROD], [1, 2, ROD], [0, 2, ROD]] };
const lift = { atoms: [[BEAD, 0, 0], [BEAD, 1, 0], [BEAD, 0.5, 0.87], [FLOAT, 0.5, -0.9]], links: [[0, 1, ROD], [1, 2, ROD], [0, 2, ROD], [3, 0, ROD], [3, 1, ROD]] };
function dy(build, g, secs = 20) { const w = new Parts({ ...params, gravity: g }, { W: 8, H: 8, walls: false, freeEnergy: true, cap: 32 }); w.load(build, 4, 4); const n = w.n; const c = () => { let y = 0; for (let i = 0; i < n; i++) y += w.y[i]; return y / n; };
  const a = c(); for (let s = 0; s < secs / w.p.dt; s++) w.step(); return (c() - a) / secs; }
console.log('gravity  triangle sinks  worm-up  worm-down  worm-upward-reversed  one float lifts a triangle');
for (const g of [0, 0.02, 0.05, 0.1, 0.2, 0.4]) console.log(String(g).padEnd(8), dy(tri, g).toFixed(2).padStart(8), dy(worm(1), g).toFixed(2).padStart(12), dy(worm(-1), g).toFixed(2).padStart(9), ''.padStart(8), dy(lift, g).toFixed(2).padStart(12));
