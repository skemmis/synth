import fs from 'fs';
import { config } from '../packages/sim/src/config.ts'; import { M } from '../packages/sim/src/materials.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts';
import { Terrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts'; import { box } from '../packages/sim/src/bench.ts';
import { toSvg } from './svg.ts';
const out = process.argv[2]; const w = new World(Terrain.flat(1600, 900, 600)); const run = (s: number) => { for (let i = 0; i < s * 60; i++) w.step(); };
const s = spawnRecipe(w, RECIPES.net, 800, 300); const b = box(w, s.nodes);
let L = -1, R = -1; for (const i of s.nodes) { if (Math.abs(w.y[i] - b.y0) > 2) continue; if (L < 0 || w.x[i] < w.x[L]) L = i; if (R < 0 || w.x[i] > w.x[R]) R = i; }
w.addAnchor(L, w.x[L] + 32, w.y[L] - 4, 2000); w.addAnchor(R, w.x[R] - 32, w.y[R] - 4, 2000); run(2.5);
fs.writeFileSync(out + '/n0.svg', toSvg(w, 600, 200, 1000, 650));
const b1 = box(w, s.nodes); for (let k = 0; k < 6; k++) w.addNode(M.WOOD, b1.x0 + 24 + (k * (b1.w - 48)) / 5, b1.y0 - 80 - k * 6, 2);
run(1); fs.writeFileSync(out + '/n1.svg', toSvg(w, 600, 200, 1000, 650)); run(4); fs.writeFileSync(out + '/n2.svg', toSvg(w, 600, 200, 1000, 650));
