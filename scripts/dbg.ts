import fs from 'fs';
import { stripWorld, run } from '../packages/sim/src/scenarios.ts';
import { RECIPES } from '../packages/sim/src/recipes.ts';
import { spawnRecipe } from '../packages/sim/src/grid.ts';
import { LAYOUT } from '../packages/sim/src/terrain.ts';
import { toSvg } from './svg.ts';
const out = process.argv[2];
const w = stripWorld(); run(w, 2);
{ let ys:number[]=[]; for(let i=0;i<w.n;i++) ys.push(w.y[i]); ys.sort((a,b)=>a-b); let v=0; for(let i=0;i<w.n;i++) v+=Math.hypot(w.x[i]-w.px[i],w.y[i]-w.py[i])*480; console.log('surface', ys[10], 'bottom', ys[ys.length-1], 'avg speed', v/w.n); }
fs.writeFileSync(out + '/a.svg', toSvg(w, 0, 300, 1000, 800));
const px = 450; const s = spawnRecipe(w, RECIPES.bucket, px, LAYOUT.base - 120);
const hold = s.nodes[0]; console.log('hold', w.x[hold], w.y[hold]);
let hy = w.y[hold];
for (let i = 0; i < 300; i++) { hy = Math.min(hy + 2, LAYOUT.base + 30); w.grab(hold, px, hy); w.step(); }
fs.writeFileSync(out + '/b.svg', toSvg(w, 0, 300, 1000, 800));
for (let i = 0; i < 300; i++) { hy = Math.max(hy - 1.5, LAYOUT.base - 160); w.grab(hold, px, hy); w.step(); }
fs.writeFileSync(out + '/c.svg', toSvg(w, 0, 300, 1000, 800));
