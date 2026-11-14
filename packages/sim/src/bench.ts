// The test bench: drop a draft into small sandbox worlds and describe what happened in plain words.
// It measures the same handful of things for every recipe. It never knows what the recipe is "for".
import { config } from './config.ts';
import { M } from './materials.ts';
import { spawnRecipe, type Recipe } from './grid.ts';
import { RECIPES } from './recipes.ts';
import { Terrain, basin } from './terrain.ts';
import { World } from './world.ts';

const GY = 600;
const flat = () => new World(Terrain.flat(1600, 900, GY));
const tank = () => { const w = new World(Terrain.from(1600, 900, (x) => GY + basin(x, 540, 1060, 150, 50))); w.spawnWater(600, GY + 40, 1000, GY + 148); return w; };
const run = (w: World, s: number, each?: () => void) => { for (let i = 0, n = Math.round(s / config.dt); i < n; i++) { each?.(); w.step(); } };
export const box = (w: World, nodes: number[]) => {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
  for (const i of nodes) { if (!w.alive[i]) continue; n++; x0 = Math.min(x0, w.x[i]); x1 = Math.max(x1, w.x[i]); y0 = Math.min(y0, w.y[i]); y1 = Math.max(y1, w.y[i]); }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, n, cx: (x0 + x1) / 2 };
};
const liveBonds = (w: World) => { let c = 0; for (let k = 0; k < w.nb; k++) if (w.balive[k] && w.bb[k] >= 0 && !(w.bflags[k] & 20)) c++; return c; };
const dims = (r: Recipe) => ({ H: r.grid.length, W: Math.max(0, ...r.grid.map((l) => l.length)) });
/** Spawn so the lowest row rests just above the ground. */
export function setDown(w: World, r: Recipe, x: number, groundY = GY, gap = 2) {
  const { H } = dims(r); return spawnRecipe(w, r, x, groundY - 8 - gap - ((H - 1) / 2) * config.cell, { tag: 1 });
}
const tiltOf = (w: World, a: number, b: number, ang0: number) => {
  let d = Math.atan2(w.y[b] - w.y[a], w.x[b] - w.x[a]) - ang0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) * 180 / Math.PI;
};

export interface BenchFacts {
  cells: number; widthCells: number; heightCells: number;
  settledTilt: number; settledHeight: number; brokeOnLanding: number; stands: boolean;
  shoveMoved: number; stuckDown: boolean;
  pourTotal: number; pourHeld: number;
  floats: boolean; aboveWater: number;
  hangLength: number; hangsLimp: boolean;
  dropDamageToBlock: number; dropDamageToSelf: number;
  spinDamage: number;
}
export interface BenchResult { facts: BenchFacts; text: string; }

export function bench(r: Recipe): BenchResult {
  const { W, H } = dims(r);
  const f = { cells: 0, widthCells: W, heightCells: H } as BenchFacts;
  // 1. set it down on flat ground
  let w = flat(); let s = setDown(w, r, 800); f.cells = s.nodes.length;
  const a = s.nodes[0], b = s.nodes[s.nodes.length - 1]; const ang0 = Math.atan2(w.y[b] - w.y[a], w.x[b] - w.x[a]);
  const bonds0 = liveBonds(w), b0 = box(w, s.nodes);
  run(w, 3);
  const b1 = box(w, s.nodes);
  f.settledTilt = s.nodes.length > 1 ? tiltOf(w, a, b, ang0) : 0; f.settledHeight = (b1.h + 16) / 16; f.brokeOnLanding = bonds0 - liveBonds(w);
  f.stands = f.settledTilt < 20 && b1.h > b0.h * 0.8 - 4 && f.brokeOnLanding === 0;
  // 2. pour water over it
  const settled = w.clone();
  f.pourTotal = w.spawnWater(b1.cx - 34, b1.y0 - 110, b1.cx + 34, b1.y0 - 40);
  run(w, 5);
  const b2 = box(w, s.nodes); let held = 0;
  for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === M.WATER && w.x[i] > b2.x0 && w.x[i] < b2.x1 && w.y[i] > b2.y0 - 8 && w.y[i] < Math.min(b2.y1, GY - 12)) held++;
  f.pourHeld = held;
  // 3. shove the top sideways with a modest pull
  w = settled.clone();
  let top = s.nodes[0]; for (const i of s.nodes) if (w.alive[i] && w.y[i] < w.y[top]) top = i;
  const x0 = box(w, s.nodes).cx;
  { const c = w.cfg.handForce; w.cfg.handForce = 6; for (let t = 0; t < 90; t++) { w.grab(top, w.x[top] + 40, w.y[top]); w.step(); } w.cfg.handForce = c; }
  w.release(); run(w, 1);
  f.shoveMoved = Math.abs(box(w, s.nodes).cx - x0);
  let anch = 0; for (let k = 0; k < w.nb; k++) if (w.balive[k] && w.bb[k] < 0) anch++;
  f.stuckDown = anch > 0 && f.shoveMoved < 8;
  // 4. drop a wood block on it
  w = settled.clone();
  const hpSelf0 = s.nodes.reduce((t, i) => t + (w.alive[i] ? w.hp[i] : 0), 0);
  const blk = spawnRecipe(w, RECIPES.woodBlock, b1.cx, b1.y0 - 220, { tag: 2 }); const hpB0 = blk.nodes.reduce((t, i) => t + w.hp[i], 0);
  run(w, 3);
  f.dropDamageToBlock = hpB0 - blk.nodes.reduce((t, i) => t + (w.alive[i] ? Math.max(0, w.hp[i]) : 0), 0);
  f.dropDamageToSelf = hpSelf0 - s.nodes.reduce((t, i) => t + (w.alive[i] ? Math.max(0, w.hp[i]) : 0), 0);
  // 5. float it
  w = tank(); run(w, 1.5);
  let surf = 1e9; { const ys: number[] = []; for (let i = 0; i < w.n; i++) if (w.mat[i] === M.WATER) ys.push(w.y[i]); ys.sort((p, q) => p - q); surf = ys[Math.floor(ys.length * 0.03)] ?? GY; }
  s = spawnRecipe(w, r, 800, surf - 30 - (H * config.cell) / 2, { tag: 1 }); run(w, 4);
  let above = 0, alive = 0; for (const i of s.nodes) if (w.alive[i]) { alive++; if (w.y[i] < surf + 4) above++; }
  f.aboveWater = alive ? above / alive : 0; const fb = box(w, s.nodes); f.floats = fb.y1 < GY + 150 - 30 && f.aboveWater > 0.05;
  // 6. hold it by its middle node: a rope drapes, a beam does not
  w = flat(); s = spawnRecipe(w, r, 800, 250, { tag: 1 });
  const e0 = s.nodes[0], e1 = s.nodes[s.nodes.length - 1], mid = s.nodes[s.nodes.length >> 1];
  const span0 = Math.hypot(w.x[e1] - w.x[e0], w.y[e1] - w.y[e0]);
  w.grab(mid, w.x[mid], w.y[mid]); run(w, 3);
  const span1 = w.alive[e0] && w.alive[e1] ? Math.hypot(w.x[e1] - w.x[e0], w.y[e1] - w.y[e0]) : 0;
  f.hangLength = (box(w, s.nodes).h + 16) / 16;
  f.hangsLimp = span0 > 40 && span1 < span0 * 0.7;
  // 7. hold the lowest node and spin it into a wooden post
  w = flat(); const post = spawnRecipe(w, RECIPES.dummy, 800 + Math.max(44, 0.7 * H * 16), GY - 40, { tag: 2 }); run(w, 0.4);
  const hp0 = post.nodes.reduce((t, i) => t + w.hp[i], 0);
  s = spawnRecipe(w, r, 800, GY - 62 - (H * 16) / 2, { tag: 1 });
  let grip = s.nodes[0]; for (const i of s.nodes) if (w.y[i] > w.y[grip] + 1 || (Math.abs(w.y[i] - w.y[grip]) < 1 && Math.abs(w.x[i] - 800) < Math.abs(w.x[grip] - 800))) grip = i;
  const gx = w.x[grip], gy = w.y[grip];
  for (let k = 0; k < 2; k++) { w.grab(grip, gx, gy); w.hand.spin = 1; run(w, 0.8); w.hand.spin = -1; run(w, 0.8); }
  f.spinDamage = hp0 - post.nodes.reduce((t, i) => t + (w.alive[i] ? Math.max(0, w.hp[i]) : 0), 0);
  return { facts: f, text: describe(f) };
}
export function describe(f: BenchFacts): string {
  const L: string[] = [];
  L.push(f.stands ? `Set on flat ground it stayed as built, ${f.settledHeight.toFixed(0)} nodes tall.` : f.brokeOnLanding ? `Set on flat ground, ${f.brokeOnLanding} bonds broke.` : `Set on flat ground it fell or slumped: tilted ${f.settledTilt.toFixed(0)} degrees and ended ${f.settledHeight.toFixed(0)} nodes tall.`);
  L.push(f.pourHeld >= 3 ? `Poured ${f.pourTotal} drops of water over it: it held ${f.pourHeld}.` : `Poured ${f.pourTotal} drops of water over it: it held none.`);
  L.push(f.stuckDown ? 'A sideways shove did not move it; it is stuck to the ground.' : `A sideways shove at the top moved it ${(f.shoveMoved / 16).toFixed(1)} nodes.`);
  L.push(f.floats ? `In deep water it floats with ${(f.aboveWater * 100).toFixed(0)}% of its nodes above the surface.` : 'In deep water it sinks.');
  L.push(f.hangsLimp ? 'Held by its middle it drapes and folds like rope or cloth.' : 'Held by its middle it keeps its shape.');
  L.push(f.dropDamageToBlock > 0.5 ? `A wood block dropped on it took ${f.dropDamageToBlock.toFixed(0)} damage.` : 'A wood block dropped on it was not hurt.');
  if (f.dropDamageToSelf > 0.5) L.push(`It took ${f.dropDamageToSelf.toFixed(0)} damage from that drop.`);
  L.push(f.spinDamage > 0.5 ? `Held by its lowest node and spun into a wooden post, it did ${f.spinDamage.toFixed(0)} damage.` : 'Held by its lowest node and spun into a wooden post, it did no damage.');
  return L.join(' ');
}
