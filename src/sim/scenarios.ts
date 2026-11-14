// Headless scenarios. Each returns plain numbers; the gate tests assert on
// them, and the synthesizer's test bench reuses them to describe a draft.
import { CONFIG } from './config';
import { parseGrid, pourWater, spawnGrid } from './grid';
import { Mat, NODE_RADIUS } from './materials';
import { LAYOUT, Terrain, flatTerrain, makeTerrain } from './terrain';
import { World } from './world';

const D = NODE_RADIUS * 2;

/** optional observer, called after every step of run(); used to film scenarios */
export const observer: { fn: ((w: World) => void) | null } = { fn: null };

export function run(world: World, seconds: number, each?: (t: number) => void) {
  const steps = Math.round(seconds / world.cfg.dt);
  for (let s = 0; s < steps; s++) {
    each?.(s * world.cfg.dt);
    world.step();
    observer.fn?.(world);
  }
}

/** move the hand toward a point at a limited speed (units/s), like a mouse would */
export function moveHand(world: World, x: number, y: number, speed: number) {
  const h = world.hand;
  const dx = x - h.x, dy = y - h.y;
  const d = Math.hypot(dx, dy);
  const max = speed * world.cfg.dt;
  if (d <= max) { h.x = x; h.y = y; } else { h.x += (dx / d) * max; h.y += (dy / d) * max; }
}

export function bounds(world: World, nodes: number[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
  for (const i of nodes) {
    if (!world.alive[i]) continue;
    n++;
    x0 = Math.min(x0, world.x[i]); x1 = Math.max(x1, world.x[i]);
    y0 = Math.min(y0, world.y[i]); y1 = Math.max(y1, world.y[i]);
  }
  return { x0, x1, y0, y1, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function waterInside(world: World, nodes: number[]): number {
  const b = bounds(world, nodes);
  let c = 0;
  for (let i = 0; i < world.n; i++) {
    if (!world.alive[i] || world.mat[i] !== Mat.Water) continue;
    if (world.x[i] > b.x0 && world.x[i] < b.x1 && world.y[i] > b.y0 && world.y[i] < b.y1) c++;
  }
  return c;
}

export function fillPond(world: World, depth = 0.8) {
  const p = LAYOUT.pond;
  const top = LAYOUT.groundY + p.depth * (1 - depth);
  return pourWater(world, p.x - p.halfWidth, top, p.x + p.halfWidth, LAYOUT.groundY + p.depth + 5);
}

export const BUCKET = parseGrid(`
W.....W
W.....W
W.....W
W.....W
WWWWWWW`);

/** Scoop from the pond with a recipe, carry it to the ditch. */
export function bucketCarry(grid: string[] = BUCKET, seed = 1) {
  const world = new World(makeTerrain(CONFIG.world.width, seed));
  fillPond(world);
  run(world, 2);
  const pondWater = world.count(Mat.Water);
  const px = LAYOUT.pond.x;
  const sp = spawnGrid(world, grid, px - 120, LAYOUT.groundY - 90);
  // grab the middle of the bottom row
  const b0 = bounds(world, sp.nodes);
  const grip = world.nodeAt(b0.cx, b0.y1, D);
  world.grab(grip);
  const gy = world.hand.y;
  const hand = world.hand;
  const turn = (to: number) => {
    const max = world.cfg.hand.rotateSpeed * world.cfg.dt;
    hand.angle += Math.max(-max, Math.min(max, to - hand.angle));
  };
  const dipY = LAYOUT.groundY + LAYOUT.pond.depth - 30;
  // tip the mouth forward, dip, sweep through the water, right it, lift out
  run(world, 1.0, () => { turn(1.25); moveHand(world, px - 120, dipY, 140); });
  run(world, 1.2, () => { turn(1.25); moveHand(world, px + 40, dipY, 140); });
  run(world, 1.0, () => { turn(0); moveHand(world, px + 90, dipY - 10, 140); });
  run(world, 2.5, () => { turn(0); moveHand(world, px + 90, gy - 40, 90); });
  run(world, 1.0);
  const scooped = waterInside(world, sp.nodes);
  // carry to the ditch at a brisk but steady pace
  const dx = LAYOUT.ditch.x;
  const carryY = LAYOUT.groundY - 130;
  let t = 0;
  while (Math.abs(world.hand.x - dx) > 1 && t < 40) {
    moveHand(world, dx, carryY, 260);
    world.step();
    observer.fn?.(world);
    t += world.cfg.dt;
  }
  run(world, 1.0);
  const arrived = waterInside(world, sp.nodes);
  return { pondWater, scooped, arrived, kept: scooped ? arrived / scooped : 0, carrySeconds: t, world, nodes: sp.nodes };
}

/** A fiber chain held by one end: does it hang, swing, and fold? */
export function ropeSwing(links = 12) {
  const world = new World(flatTerrain(800, 600));
  const grid = [Array(links).fill('F').join('')]; // laid out horizontally
  const sp = spawnGrid(world, grid, 400, 200);
  const first = sp.nodes[0], last = sp.nodes[links - 1];
  world.grab(first);
  const pivotX = world.hand.x, pivotY = world.hand.y;
  const restLen = (links - 1) * D;
  let maxLen = 0, minX = Infinity, maxX = -Infinity, crossings = 0, side = 1;
  run(world, 6, () => {
    const dx = world.x[last] - pivotX, dy = world.y[last] - pivotY;
    maxLen = Math.max(maxLen, Math.hypot(dx, dy));
    minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
    const s = dx >= 0 ? 1 : -1;
    if (s !== side) { crossings++; side = s; }
  });
  run(world, 12);
  const hangDx = Math.abs(world.x[last] - pivotX);
  const hangDy = world.y[last] - pivotY;
  const intact = sp.nodes.every((i, k) => k === 0 || world.findBond(i, sp.nodes[k - 1]) >= 0);
  // let go: a rope should collapse into a pile, not stand like a stick
  world.release();
  run(world, 3);
  const pile = bounds(world, sp.nodes);
  return { restLen, maxLen, swingLeft: minX, swingRight: maxX, crossings, hangDx, hangDy, intact,
    pileHeight: pile.y1 - pile.y0 + D, pileWidth: pile.x1 - pile.x0 + D };
}

/** Swing a club into a wooden dummy; report the damage done to the dummy. */
export function clubHit(clubGrid: string[]) {
  const world = new World(flatTerrain(900, 600));
  const dummy = spawnGrid(world, parseGrid('WWW\nWWW\nWWW\nWWW\nWWW'), 520, 600 - 5 * NODE_RADIUS - 1);
  run(world, 0.5);
  const hp0 = dummy.nodes.reduce((s, i) => s + world.hp[i], 0);
  const club = spawnGrid(world, clubGrid, 300, 600 - 40);
  const b = bounds(world, club.nodes);
  world.grab(world.nodeAt(b.x0, b.cy, D)); // hold the left end
  run(world, 0.3);
  // three swings: pull back, then drive the head through the dummy
  for (let s = 0; s < 3; s++) {
    run(world, 0.5, () => moveHand(world, 300, 560, 900));
    run(world, 0.5, () => moveHand(world, 520, 560, 900));
  }
  const hp1 = dummy.nodes.reduce((s, i) => s + (world.alive[i] ? world.hp[i] : 0), 0);
  const clubLeft = club.nodes.filter((i) => world.alive[i]).length;
  return { damage: hp0 - hp1, dummyLeft: dummy.nodes.filter((i) => world.alive[i]).length, clubLeft };
}

/** Rest a block on a slope-free floor and tug it sideways with the hand. */
export function tugBlock(grid: string[], pull = 70, seconds = 1.0) {
  const world = new World(flatTerrain(800, 600));
  const h = grid.length * D;
  const sp = spawnGrid(world, grid, 400, 600 - h / 2 - 1);
  run(world, 1.0);
  const b0 = bounds(world, sp.nodes);
  world.grab(world.nodeAt(b0.cx, b0.y0, D));
  const hx = world.hand.x, hy = world.hand.y;
  run(world, seconds, () => moveHand(world, hx + pull, hy, 200));
  world.release();
  run(world, 1.0);
  const b1 = bounds(world, sp.nodes);
  let anchored = 0;
  for (const i of sp.nodes) if (world.anch[i]) anchored++;
  return { moved: Math.abs(b1.cx - b0.cx), anchored };
}

/** Drop a single-material block into deep water; where does it settle relative to the surface? */
export function floatTest(glyph: string) {
  const ter = new Terrain(400, new Float32Array(51).map((_, i) => (i < 6 || i > 44 ? 300 : 520)));
  const world = new World(ter);
  pourWater(world, 50, 380, 350, 520);
  run(world, 2);
  const grid = parseGrid(`${glyph}${glyph}\n${glyph}${glyph}`);
  const sp = spawnGrid(world, grid, 200, 330);
  run(world, 8);
  const ys: number[] = [];
  for (let i = 0; i < world.n; i++) if (world.alive[i] && world.mat[i] === Mat.Water) ys.push(world.y[i]);
  ys.sort((a, b) => a - b);
  const surface = ys[Math.floor(ys.length * 0.05)];
  const b = bounds(world, sp.nodes);
  return { surface, top: b.y0, bottom: b.y1, floor: 520, depthBelowSurface: b.cy - surface };
}

/** steps per second for a small busy world (performance report) */
export function benchmark(nodes = 400, seconds = 5) {
  const world = new World(flatTerrain(1200, 600));
  const side = Math.round(Math.sqrt(nodes / 8));
  let n = 0, k = 0;
  while (n < nodes) {
    const g = Array.from({ length: 2 }, () => 'WWWW');
    spawnGrid(world, g, 100 + (k % 12) * 80, 560 - Math.floor(k / 12) * 40);
    n += 8; k++;
  }
  void side;
  const steps = Math.round(seconds * 60);
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) world.step();
  const ms = performance.now() - t0;
  return { nodes: world.liveNodes, stepsPerSecond: (steps / ms) * 1000, realtimeFactor: (steps / 60) / (ms / 1000) };
}
