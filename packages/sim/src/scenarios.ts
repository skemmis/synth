// Headless scenarios. Each returns plain numbers; tests assert on them, and the test bench reuses them later.
import { config } from './config.ts';
import { M } from './materials.ts';
import { spawnRecipe, type Recipe } from './grid.ts';
import { RECIPES } from './recipes.ts';
import { LAYOUT, stripTerrain, Terrain } from './terrain.ts';
import { World } from './world.ts';

export const run = (w: World, seconds: number, each?: (t: number) => void) => {
  const steps = Math.round(seconds / config.dt);
  for (let i = 0; i < steps; i++) { each?.(i * config.dt); w.step(); }
};
export function stripWorld(opts: { water?: boolean } = {}): World {
  const w = new World(stripTerrain());
  if (opts.water !== false) w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
  return w;
}
export const flatWorld = (width = 1600, y = 600) => new World(Terrain.flat(width, 900, y));

const bbox = (w: World, nodes: number[]) => {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const i of nodes) { if (!w.alive[i]) continue; x0 = Math.min(x0, w.x[i]); x1 = Math.max(x1, w.x[i]); y0 = Math.min(y0, w.y[i]); y1 = Math.max(y1, w.y[i]); }
  return { x0, x1, y0, y1 };
};
export const waterInside = (w: World, nodes: number[]) => { const b = bbox(w, nodes); return w.countIn(M.WATER, b.x0, b.x1, b.y0, b.y1); };

/** Gate 0a: scoop water from the pond with a bucket and carry it to the ditch. */
export function bucketCarry(recipe: Recipe = RECIPES.bucket, speed = 220) {
  const w = stripWorld();
  run(w, 2); // let the pond settle
  const px = (LAYOUT.pond[0] + LAYOUT.pond[1]) / 2, top = LAYOUT.base - 120;
  const s = spawnRecipe(w, recipe, px, top);
  // hold it by its topmost node
  let hold = s.nodes[0]; for (const i of s.nodes) if (w.y[i] < w.y[hold] - 1 || (Math.abs(w.y[i] - w.y[hold]) < 1 && Math.abs(w.x[i] - px) < Math.abs(w.x[hold] - px))) hold = i;
  let hx = w.x[hold], hy = w.y[hold];
  const moveTo = (tx: number, ty: number, v: number) => {
    for (let guard = 0; guard < 60 * 120; guard++) {
      const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy), st = v * config.dt;
      if (d <= st) { hx = tx; hy = ty; w.grab(hold, hx, hy); w.step(); break; }
      hx += (dx / d) * st; hy += (dy / d) * st; w.grab(hold, hx, hy); w.step();
    }
  };
  w.grab(hold, hx, hy); run(w, 0.5);
  moveTo(px, LAYOUT.base + 30, 120); // dunk
  run(w, 2.5);
  moveTo(px, LAYOUT.base - 160, 90); // lift
  run(w, 1);
  const scooped = waterInside(w, s.nodes);
  const dx = (LAYOUT.ditch[0] + LAYOUT.ditch[1]) / 2;
  moveTo(dx, LAYOUT.base - 160, speed);
  run(w, 1);
  const arrived = waterInside(w, s.nodes);
  // pour: lower into the ditch and spin
  moveTo(dx, LAYOUT.base - 40, 120);
  w.hand.spin = 1; run(w, 2.5); w.hand.spin = 0; w.release(); run(w, 2);
  const inDitch = w.countIn(M.WATER, LAYOUT.ditch[0], LAYOUT.ditch[1]);
  return { scooped, arrived, kept: scooped ? arrived / scooped : 0, inDitch, world: w };
}

/** Gate 0b: a fiber chain held by one end hangs and swings. */
export function ropeSwing() {
  const w = flatWorld();
  const s = spawnRecipe(w, RECIPES.rope, 800, 200); // horizontal, 12 links
  const first = s.nodes[0], last = s.nodes[s.nodes.length - 1];
  w.grab(first, w.x[first], w.y[first]);
  const len = (s.nodes.length - 1) * config.cell;
  let minX = 1e9, maxX = -1e9, crossings = 0, prevSide = 0, maxLen = 0;
  run(w, 8, () => {
    const dx = w.x[last] - w.x[first]; minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
    const side = Math.sign(dx); if (side && prevSide && side !== prevSide) crossings++; if (side) prevSide = side;
    maxLen = Math.max(maxLen, Math.hypot(dx, w.y[last] - w.y[first]));
  });
  run(w, 20);
  const hangDx = Math.abs(w.x[last] - w.x[first]), hangDy = w.y[last] - w.y[first];
  let intact = 0; for (let k = 0; k < w.nb; k++) if (w.balive[k]) intact++;
  return { len, swingLeft: minX, swingRight: maxX, crossings, maxLen, hangDx, hangDy, intact };
}

/** Gate 0c: swing a club into a dummy; report damage to the dummy. */
export function clubHit(club: Recipe) {
  const w = flatWorld();
  const d = spawnRecipe(w, RECIPES.dummy, 900, 600 - 5 * 8, { tag: 2 });
  run(w, 0.5);
  const hp0 = d.nodes.reduce((a, i) => a + w.hp[i], 0);
  // hold the club upright by the bottom of its shaft, then spin it (E) so the head comes down on the dummy
  const c = spawnRecipe(w, club, 822, 470, { tag: 1 });
  const grip = c.nodes[c.nodes.length - 1];
  const gx = w.x[grip], gy = w.y[grip];
  for (let k = 0; k < 3; k++) {
    w.grab(grip, gx, gy); w.hand.spin = 1; run(w, 0.8);
    w.hand.spin = -1; run(w, 0.8);
  }
  w.release(); run(w, 0.5);
  const hp1 = d.nodes.reduce((a, i) => a + (w.alive[i] ? Math.max(0, w.hp[i]) : 0), 0);
  return { damage: hp0 - hp1, dummyAlive: d.nodes.filter((i) => w.alive[i]).length };
}

/** Gate 0d: a block with pitch underneath resists a sideways pull that slides a plain block. */
export function pitchStick(recipe: Recipe) {
  const w = flatWorld();
  const s = spawnRecipe(w, recipe, 800, 600 - 30);
  run(w, 1.5);
  const x0 = w.x[s.nodes[0]];
  // a steady sideways shove, well under the hand's limit, applied by a slow hand
  const top = s.nodes[1];
  for (let t = 0; t < 120; t++) { w.grab(top, w.x[top] + 6, w.y[top]); w.step(); }
  w.release(); run(w, 1);
  let anchors = 0; for (let k = 0; k < w.nb; k++) if (w.balive[k] && w.bb[k] < 0) anchors++;
  return { moved: Math.abs(w.x[s.nodes[0]] - x0), anchors };
}
