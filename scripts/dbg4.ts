import fs from 'fs';
import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts';
import { spawnCreature } from '../packages/evo/src/trial.ts'; import { toSvg } from './svg.ts';
const g = JSON.parse(process.argv[3]); const out = process.argv[2];
const w = new World(Terrain.flat(2400, 900, 600)); const c = spawnCreature(w, g, 1800, 5);
for (let t = 0; t <= 300; t++) { if (t % 30 === 0) { let ymin = 1e9, ymax = -1e9; for (const i of c.nodes) { ymin = Math.min(ymin, w.y[i]); ymax = Math.max(ymax, w.y[i]); } console.log(t, 'heart', w.x[c.heart].toFixed(0), w.y[c.heart].toFixed(0), 'y', ymin.toFixed(0), ymax.toFixed(0)); }
  if (t === 60 || t === 66 || t === 72) fs.writeFileSync(`${out}/c${t}.svg`, toSvg(w, w.x[c.heart] - 150, 400, w.x[c.heart] + 150, 650, 2)); w.step(); }
