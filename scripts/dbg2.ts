import fs from 'fs';
import { flatWorld, run } from '../packages/sim/src/scenarios.ts';
import { RECIPES } from '../packages/sim/src/recipes.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts';
import { toSvg } from './svg.ts';
const out = process.argv[2];
const w = flatWorld();
const d = spawnRecipe(w, RECIPES.dummy, 900, 600 - 5 * 8, { tag: 2 }); run(w, 0.5);
const c = spawnRecipe(w, RECIPES.thornClub, 780, 470, { tag: 1 });
const grip = c.nodes[c.nodes.length - 1]; const gx = w.x[grip], gy = w.y[grip];
fs.writeFileSync(out + '/d0.svg', toSvg(w, 500, 300, 1100, 700));
for (let t = 0; t < 20; t++) { w.grab(grip, gx + (t / 20) * 150, gy); w.step(); if(t%5==4) fs.writeFileSync(out + `/d${1+(t/5|0)}.svg`, toSvg(w, 500, 300, 1100, 700)); }
console.log(w.damageDealt, w.events.length);
