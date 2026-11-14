// The ten scripted requests from the PRD's milestone 2 gate, each with a headless physical test of its purpose.
import { bench, box, setDown, type BenchFacts } from '../../sim/src/bench.ts';
import { config } from '../../sim/src/config.ts';
import { M } from '../../sim/src/materials.ts';
import { spawnRecipe, type Recipe } from '../../sim/src/grid.ts';
import { RECIPES } from '../../sim/src/recipes.ts';
import { Terrain, basin } from '../../sim/src/terrain.ts';
import { World } from '../../sim/src/world.ts';

const GY = 600;
const flat = () => new World(Terrain.flat(1600, 900, GY));
const run = (w: World, s: number, each?: (i: number) => void) => { for (let i = 0, n = Math.round(s / config.dt); i < n; i++) { each?.(i); w.step(); } };
export interface PurposeResult { pass: boolean; detail: string; }
type Test = (r: Recipe, f: BenchFacts) => PurposeResult;

const cage: Test = (r) => {
  // find an empty cell sealed off from the outside (8-connected walls, 4-connected flood)
  const g = r.grid, H = g.length, W = g[0]?.length ?? 0; const out = new Set<string>(); const st: [number, number][] = [];
  const empty = (c: number, rr: number) => rr < 0 || rr >= H || c < 0 || c >= W || g[rr][c] === '.';
  for (let c = -1; c <= W; c++) { st.push([c, -1], [c, H]); } for (let rr = -1; rr <= H; rr++) { st.push([-1, rr], [W, rr]); }
  while (st.length) { const [c, rr] = st.pop()!; const k = c + ',' + rr; if (out.has(k) || c < -1 || c > W || rr < -1 || rr > H || !empty(c, rr)) continue; out.add(k); st.push([c + 1, rr], [c - 1, rr], [c, rr + 1], [c, rr - 1]); }
  let cell: [number, number] | null = null;
  for (let rr = 0; rr < H && !cell; rr++) for (let c = 0; c < W; c++) if (g[rr][c] === '.' && !out.has(c + ',' + rr)) { cell = [c, rr]; break; }
  if (!cell) return { pass: false, detail: 'no enclosed space in the grid' };
  const w = flat(); const s = spawnRecipe(w, r, 800, 300, { tag: 1 });
  const berry = w.addNode(M.BERRY, 800 + (cell[0] - (W - 1) / 2) * 16, 300 + (cell[1] - (H - 1) / 2) * 16, 2);
  // hold a corner, spin it about, then drop it
  const hold = s.nodes[0]; w.grab(hold, w.x[hold], w.y[hold]); w.hand.spin = 1; run(w, 2); w.hand.spin = -1; run(w, 1.5); w.release(); run(w, 3);
  const b = box(w, s.nodes); const inside = w.alive[berry] && w.x[berry] > b.x0 && w.x[berry] < b.x1 && w.y[berry] > b.y0 && w.y[berry] < b.y1;
  return { pass: !!inside, detail: inside ? 'a berry stayed inside through shaking and a drop' : 'the berry got out' };
};
const raft: Test = (r, f) => {
  if (!f.floats) return { pass: false, detail: 'it sinks' };
  const w = new World(Terrain.from(1600, 900, (x) => GY + basin(x, 540, 1060, 150, 50))); w.spawnWater(600, GY + 40, 1000, GY + 148); run(w, 1.5);
  const s = spawnRecipe(w, r, 800, GY - 20, { tag: 1 }); run(w, 3);
  const b = box(w, s.nodes); const cargo = spawnRecipe(w, { name: 'cargo', grid: ['SS'] }, b.cx, b.y0 - 40, { tag: 2 }); run(w, 6);
  const c = box(w, cargo.nodes); const b2 = box(w, s.nodes);
  const ok = c.y1 < GY + 150 - 30 && c.x0 > b2.x0 - 12 && c.x1 < b2.x1 + 12;
  return { pass: ok, detail: ok ? 'floats and carries two stone nodes' : 'floats, but two stone nodes sank it or rolled off' };
};
const ramp: Test = (r) => {
  // Single nodes cannot roll and a grid ramp starts with a full step, so the fair test is downhill:
  // a ball set on the high end should run down the slope and off the low end.
  const w = flat(); const s = setDown(w, r, 800); run(w, 1.5); const b = box(w, s.nodes);
  for (const i of s.nodes) if (Math.abs(w.y[i] - b.y1) < 4) w.addAnchor(i, w.x[i], GY, 400); // hold the foot still for the test
  let hi = s.nodes[0]; for (const i of s.nodes) if (w.y[i] < w.y[hi] - 1) hi = i;
  const dir = w.x[hi] > b.cx ? -1 : 1; // downhill direction
  const ball = w.addNode(M.WOOD, w.x[hi] + dir * 4, w.y[hi] - 17, 2); const x0 = w.x[ball];
  run(w, 4);
  const ran = (w.x[ball] - x0) * dir, sloped = b.h >= 30 && Math.abs(w.x[hi] - b.cx) > b.w * 0.25;
  return { pass: sloped && ran >= b.w * 0.7, detail: sloped ? `a ball set on the high end ran ${(ran / 16).toFixed(1)} nodes downhill` : 'it has no high end and low end' };
};
const net: Test = (r) => {
  const w = flat(); const s = spawnRecipe(w, r, 800, 300, { tag: 1 }); const b = box(w, s.nodes);
  // hang it between two posts by its top corners, with some slack so it can sag
  let L = -1, R = -1;
  for (const i of s.nodes) { if (Math.abs(w.y[i] - b.y0) > 2) continue; if (L < 0 || w.x[i] < w.x[L]) L = i; if (R < 0 || w.x[i] > w.x[R]) R = i; }
  const slack = b.w * 0.2;
  w.addAnchor(L, w.x[L] + slack, w.y[L] - 4, 2000); w.addAnchor(R, w.x[R] - slack, w.y[R] - 4, 2000); run(w, 2.5);
  const drops: number[] = []; const b1 = box(w, s.nodes);
  for (let k = 0; k < 6; k++) { drops.push(w.addNode(M.WOOD, b1.cx + ((k * 37) % 50 - 25) * (b1.w / 120), b1.y0 - 60, 2)); run(w, 0.5); }
  run(w, 3);
  const caught = drops.filter((i) => w.alive[i] && w.y[i] < GY - 40).length;
  return { pass: caught >= 4, detail: `hung between two posts it caught ${caught} of 6 dropped nodes` };
};
const lid: Test = (r, f) => {
  const w = flat(); const bk = setDown(w, RECIPES.pail, 800); // the open-topped pail without its handle would be better; use a plain U
  for (const i of bk.nodes) w.removeNode(i);
  const u = setDown(w, { name: 'u', grid: ['W.....W', 'W.....W', 'W.....W', 'WWWWWWW'] }, 800); run(w, 1);
  const ub = box(w, u.nodes); const H = r.grid.length;
  const s = spawnRecipe(w, r, ub.cx, ub.y0 - 12 - (H * 16) / 2, { tag: 2 }); run(w, 3);
  const lb = box(w, s.nodes);
  const covers = lb.x0 <= ub.x0 + 4 && lb.x1 >= ub.x1 - 4, onTop = lb.y1 < ub.y0 + 20 && lb.y1 > ub.y0 - 40;
  // then nudge the tub: the lid should ride along
  const base = u.nodes[u.nodes.length - 1]; const bx = w.x[base], by = w.y[base]; for (let t = 0; t < 60; t++) { w.grab(base, bx + (t / 60) * 48, by); w.step(); } w.release(); run(w, 1.5);
  const ub2 = box(w, u.nodes), lb2 = box(w, s.nodes); const still = lb2.y1 < ub2.y0 + 20 && lb2.x0 <= ub2.x0 + 10 && lb2.x1 >= ub2.x1 - 10;
  void f;
  return { pass: covers && onTop && still, detail: covers && onTop ? (still ? 'covers an open tub and stays on when the tub is nudged' : 'covers a tub but slid off when nudged') : 'does not sit across the top of a 7-wide tub' };
};

export const SCRIPTED: { request: string; key: string; test: Test }[] = [
  { key: 'bucket', request: 'I need a bucket to move this water', test: (_r, f) => ({ pass: f.pourHeld >= 15 && f.stands, detail: `held ${f.pourHeld} of ${f.pourTotal} drops poured in` + (f.stands ? '' : ', but it does not stand up') }) },
  { key: 'rope', request: 'I need a rope', test: (_r, f) => ({ pass: f.hangsLimp && f.cells >= 5, detail: f.hangsLimp ? 'drapes and folds when held' : 'stays stiff when held' }) },
  { key: 'wall', request: 'Build me a wall to keep things out', test: (_r, f) => ({ pass: f.stands && f.heightCells >= 4 && f.shoveMoved < 24, detail: `${f.stands ? 'stands' : 'does not stand'}, ${f.heightCells} nodes tall, a shove moved it ${(f.shoveMoved / 16).toFixed(1)} nodes` }) },
  { key: 'spike strip', request: 'I want a spike strip to lay on the ground', test: (_r, f) => ({ pass: f.dropDamageToBlock > 2 && f.widthCells >= 4, detail: `a block dropped on it took ${f.dropDamageToBlock.toFixed(0)} damage` }) },
  { key: 'cage', request: 'Make a cage to keep my berries in', test: cage },
  { key: 'raft', request: 'I need a raft', test: raft },
  { key: 'ramp', request: 'Give me a ramp', test: ramp },
  { key: 'hammer', request: 'I need a hammer to smash things', test: (_r, f) => ({ pass: f.spinDamage > 2, detail: `spun into a wooden post it did ${f.spinDamage.toFixed(0)} damage` }) },
  { key: 'net', request: 'I need a net to catch things', test: net },
  { key: 'lid', request: 'Make a lid for my bucket', test: lid },
];
export function judge(key: string, r: Recipe): PurposeResult & { report: string } {
  const b = bench(r); const t = SCRIPTED.find((s) => s.key === key)!; return { ...t.test(r, b.facts), report: b.text };
}
