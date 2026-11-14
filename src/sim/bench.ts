// The test bench: drop a draft into a small sandbox copy of the simulation
// and describe what happened in plain text. The purpose tests are the
// milestone 2 gate; the general report is what goes back to the synthesizer.
import { gridCost, parseGrid, pourWater, spawnGrid, type Spawned } from './grid';
import { MATERIALS, Mat, NODE_RADIUS, GLYPH_TO_MAT } from './materials';
import { BUCKET, bounds, moveHand, run } from './scenarios';
import { flatTerrain, tankTerrain } from './terrain';
import { World } from './world';

const D = NODE_RADIUS * 2;
const FLOOR = 600;

export interface BenchResult { pass: boolean; report: string; numbers: Record<string, number> }

function stage(grid: string[], x = 450): { world: World; sp: Spawned } {
  const world = new World(flatTerrain(900, FLOOR));
  const sp = spawnGrid(world, grid, x, FLOOR - (grid.length * D) / 2 - 0.5);
  run(world, 1.5);
  return { world, sp };
}

/** a tank of water 300 wide for float tests */
function tank(): World {
  const world = new World(tankTerrain(900, 300, 600, FLOOR, 140));
  pourWater(world, 304, FLOOR - 95, 596, FLOOR);
  run(world, 2);
  return world;
}

function waterSurface(world: World): number {
  const ys: number[] = [];
  for (let i = 0; i < world.n; i++) if (world.alive[i] && world.mat[i] === Mat.Water) ys.push(world.y[i]);
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length * 0.05)] ?? FLOOR;
}

export function massOf(grid: string[]): number {
  let m = 0;
  for (const [g, n] of Object.entries(gridCost(grid))) m += (MATERIALS[GLYPH_TO_MAT[g]]?.density ?? 0) * n;
  return m;
}

function pieces(world: World, nodes: number[]): number {
  const seen = new Set<number>();
  let c = 0;
  for (const i of nodes) {
    if (!world.alive[i] || seen.has(i)) continue;
    c++;
    for (const j of world.component(i)) seen.add(j);
  }
  return c;
}

/** pour n water particles in a narrow stream above a point */
function pourAbove(world: World, cx: number, topY: number, width: number, n: number): number[] {
  const out: number[] = [];
  const cols = Math.max(2, Math.floor(width / 8.5));
  for (let k = 0; k < n; k++) {
    const col = k % cols, row = Math.floor(k / cols);
    const x = cx + (col - (cols - 1) / 2) * 8.2 + (row % 2 ? 2 : -2);
    out.push(world.addNode(Mat.Water, x, topY - 12 - row * 8.2));
  }
  return out;
}

function countIn(world: World, ids: number[], b: { x0: number; x1: number; y0: number; y1: number }): number {
  let c = 0;
  for (const i of ids) {
    if (world.alive[i] && world.x[i] > b.x0 && world.x[i] < b.x1 && world.y[i] > b.y0 - D && world.y[i] < b.y1) c++;
  }
  return c;
}

// ------------------------------------------------------------ purpose tests

export function testBucket(grid: string[]): BenchResult {
  const { world, sp } = stage(grid);
  const b = bounds(world, sp.nodes);
  const w = pourAbove(world, b.cx, b.y0, Math.max(16, b.x1 - b.x0 - 3 * D), 40);
  run(world, 5);
  const held = countIn(world, w, bounds(world, sp.nodes));
  return { pass: held >= 24, numbers: { held, poured: 40 }, report: `held ${held} of 40 water particles after 5 seconds` };
}

export function testRope(grid: string[]): BenchResult {
  const world = new World(flatTerrain(900, FLOOR));
  const cells = Object.values(gridCost(grid)).reduce((a, n) => a + n, 0);
  const sp = spawnGrid(world, grid, 450, 150);
  const b0 = bounds(world, sp.nodes);
  const long = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0);
  // hold the end node: the one farthest from the centre
  let end = sp.nodes[0], far = -1;
  for (const i of sp.nodes) { const d = Math.hypot(world.x[i] - b0.cx, world.y[i] - b0.cy); if (d > far) { far = d; end = i; } }
  world.grab(end);
  run(world, 8);
  const b1 = bounds(world, sp.nodes);
  const hang = b1.y1 - b1.y0;
  const whole = pieces(world, sp.nodes) === 1;
  world.release();
  run(world, 3);
  const b2 = bounds(world, sp.nodes);
  const pile = b2.y1 - b2.y0 + D;
  const pass = whole && long >= 7 * D && hang >= long * 0.75 && pile <= long * 0.5;
  return { pass, numbers: { cells, long, hang, pile },
    report: `${Math.round(long / D) + 1} cells long; held by one end it hangs ${Math.round(hang / D)} cells down${whole ? '' : ' and broke apart'}; let go, it ${pile <= long * 0.5 ? 'piles up' : 'stays stiff'}` };
}

export function testWall(grid: string[]): BenchResult {
  const { world, sp } = stage(grid);
  const b0 = bounds(world, sp.nodes);
  const height = b0.y1 - b0.y0 + D;
  // throw a stone block at its middle
  const rock = spawnGrid(world, ['SS', 'SS'], b0.x0 - 150, b0.cy);
  for (const i of rock.nodes) world.px[i] = world.x[i] - (260 / 60 / world.cfg.substeps);
  run(world, 4);
  const b1 = bounds(world, sp.nodes);
  const stillTall = b1.y1 - b1.y0 + D >= height * 0.85;
  const moved = Math.abs(b1.cx - b0.cx);
  const whole = pieces(world, sp.nodes) === 1;
  const pass = height >= 5 * D && stillTall && moved < 3 * D && whole;
  return { pass, numbers: { height: height / D, moved },
    report: `stands ${Math.round(height / D)} cells tall; hit by a thrown stone it ${stillTall ? `stayed up and shifted ${Math.round(moved)} units` : 'fell over'}${whole ? '' : ' and broke'}` };
}

/** a soft, inert lump of "flesh" to hurt */
function fleshDummy(world: World, x: number, y: number, w = 3, h = 2): Spawned {
  const grid = Array.from({ length: h }, () => 'N'.repeat(w));
  const cells: Record<string, { phase: number; amp: number }> = {};
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells[`${c},${r}`] = { phase: 0, amp: 0 };
  return spawnGrid(world, grid, x, y, { drive: { freq: 1, cells } });
}

const hpOf = (world: World, nodes: number[]) => nodes.reduce((s, i) => s + (world.alive[i] ? world.hp[i] : 0), 0);

export function testSpikeStrip(grid: string[]): BenchResult {
  const { world, sp } = stage(grid);
  const b0 = bounds(world, sp.nodes);
  const dummy = fleshDummy(world, b0.x0 - 60, b0.y0 - 30);
  const hp0 = hpOf(world, dummy.nodes);
  world.grab(dummy.nodes[0]);
  // drag the dummy across the top of the strip, pressing down, there and back
  const y = b0.y0 - D * 0.9;
  run(world, 0.5, () => moveHand(world, b0.x0 - 30, y, 200));
  run(world, 3, () => moveHand(world, b0.x1 + 40, y, 90));
  run(world, 3, () => moveHand(world, b0.x0 - 40, y, 90));
  world.release();
  const hurt = hp0 - hpOf(world, dummy.nodes);
  const b1 = bounds(world, sp.nodes);
  const moved = Math.abs(b1.cx - b0.cx);
  const low = b0.y1 - b0.y0 + D <= 4 * D;
  const pass = hurt >= 8 && moved < 4 * D && low;
  return { pass, numbers: { hurt, moved },
    report: `a soft body dragged across it took ${hurt.toFixed(0)} damage; the strip shifted ${Math.round(moved)} units${low ? '' : '; it is too tall to walk onto'}` };
}

export function testCage(grid: string[]): BenchResult {
  const world = new World(flatTerrain(900, FLOOR));
  const berry = world.addNode(Mat.Berry, 450, FLOOR - 6.5);
  const sp = spawnGrid(world, grid, 450, FLOOR - (grid.length * D) / 2 - 0.5);
  run(world, 1.5);
  const b0 = bounds(world, sp.nodes);
  const insideAtStart = !!world.alive[berry] && world.x[berry] > b0.x0 && world.x[berry] < b0.x1;
  // shove it with a stone block from the left, then try to reach in with a heart on a stick
  const rock = spawnGrid(world, ['SS', 'SS'], b0.x0 - 140, FLOOR - 14);
  for (const i of rock.nodes) world.px[i] = world.x[i] - (240 / 60 / world.cfg.substeps);
  run(world, 3);
  const probe = spawnGrid(world, ['WWWWH'], b0.x0 - 130, FLOOR - 40, { kind: 1 });
  world.grab(probe.nodes[0]);
  run(world, 3, () => moveHand(world, world.x[berry] - 40, FLOOR - 10, 120));
  run(world, 2, () => moveHand(world, world.x[berry] - 40, b0.y0 - 30, 120));
  run(world, 3, () => moveHand(world, world.x[berry] + 10, FLOOR - 10, 120));
  world.release();
  const safe = !!world.alive[berry];
  const b1 = bounds(world, sp.nodes);
  const moved = Math.abs(b1.cx - b0.cx);
  const pass = insideAtStart && safe;
  return { pass, numbers: { safe: safe ? 1 : 0, moved },
    report: `${insideAtStart ? 'a berry fits inside' : 'the berry does not fit inside'}; shoved by a stone it moved ${Math.round(moved)} units; a raider's heart poked at it ${safe ? 'could not reach the berry' : 'reached and ate the berry'}` };
}

export function testRaft(grid: string[]): BenchResult {
  const world = tank();
  const surface0 = waterSurface(world);
  const sp = spawnGrid(world, grid, 450, surface0 - (grid.length * D) / 2 - 4);
  run(world, 3);
  const b = bounds(world, sp.nodes);
  const cargo = spawnGrid(world, ['SS'], b.cx, b.y0 - 2 * D);
  run(world, 7);
  const surface = waterSurface(world);
  const cb = bounds(world, cargo.nodes);
  const dry = cb.y1 < surface + D * 0.75;
  const aboard = cb.cx > bounds(world, sp.nodes).x0 && cb.cx < bounds(world, sp.nodes).x1;
  const pass = dry && aboard;
  return { pass, numbers: { cargoDepth: cb.y1 - surface },
    report: `on water with two stone cells of cargo: ${aboard ? (dry ? 'floats and keeps the cargo above water' : 'the cargo sank below the surface') : 'the cargo slid off'}` };
}

export function testRamp(grid: string[]): BenchResult {
  // Water poured on the high end should run down the slope and leave by the low end.
  // (A single loose node is a poor test: it sits in the dimples between lattice nodes.)
  let best: BenchResult | null = null;
  for (const flip of [false, true]) {
    const g = flip ? grid.map((r) => [...r].reverse().join('')) : grid;
    const { world, sp } = stage(g);
    const b = bounds(world, sp.nodes);
    let topNode = sp.nodes[0];
    for (const i of sp.nodes) if (world.y[i] < world.y[topNode]) topNode = i;
    const highLeft = world.x[topNode] < b.cx;
    const pourX = highLeft ? Math.max(world.x[topNode], b.x0 + D) + D : Math.min(world.x[topNode], b.x1 - D) - D;
    const w = pourAbove(world, pourX, world.y[topNode] - D, 16, 30);
    run(world, 6);
    let low = 0, back = 0, on = 0;
    for (const i of w) {
      if (!world.alive[i]) continue;
      const beyondLow = highLeft ? world.x[i] > b.x1 - D : world.x[i] < b.x0 + D;
      const beyondHigh = highLeft ? world.x[i] < b.x0 : world.x[i] > b.x1;
      if (beyondLow) low++; else if (beyondHigh) back++; else on++;
    }
    const moved = Math.abs(bounds(world, sp.nodes).cx - b.cx);
    const rise = b.y1 - b.y0, runLen = b.x1 - b.x0;
    const res: BenchResult = {
      pass: low >= 21 && rise >= 2 * D && runLen >= rise && moved < 2 * D,
      numbers: { low, back, on },
      report: `${Math.round(runLen / D) + 1} cells long, ${Math.round(rise / D) + 1} high; of 30 water particles poured on the high end, ${low} ran off the low end, ${back} fell off the back and ${on} stayed on it`,
    };
    if (!best || res.numbers.low > best.numbers.low) best = res;
  }
  return best!;
}

export function testHammer(grid: string[]): BenchResult {
  const world = new World(flatTerrain(900, FLOOR));
  const dummy = fleshDummy(world, 560, FLOOR - 19, 3, 3);
  run(world, 0.5);
  const hp0 = hpOf(world, dummy.nodes);
  const sp = spawnGrid(world, grid, 330, FLOOR - 80);
  // hold the stiff node farthest from the centre of mass (the end of the handle)
  let mx = 0, my = 0, mt = 0;
  for (const i of sp.nodes) { const m = 1 / world.invM[i]; mx += world.x[i] * m; my += world.y[i] * m; mt += m; }
  mx /= mt; my /= mt;
  let grip = sp.nodes[0], far = -1;
  for (const i of sp.nodes) {
    if (MATERIALS[world.mat[i]].sharpness > 0) continue;
    const d = Math.hypot(world.x[i] - mx, world.y[i] - my);
    if (d > far) { far = d; grip = i; }
  }
  world.grab(grip);
  // A heavy head hangs below the hand like a pendulum, so use it the way a
  // person would with a weak wrist: carry it over the target and slam it down.
  const top = FLOOR - 37;
  run(world, 1.2, () => moveHand(world, 330, top - far - 70, 300));
  run(world, 1.5, () => moveHand(world, 560, top - far - 70, 260));
  run(world, 0.8);
  for (let s2 = 0; s2 < 3; s2++) {
    // re-aim at wherever the last blow knocked it
    const tx = bounds(world, dummy.nodes).cx;
    run(world, 0.9, () => moveHand(world, tx, top - far - 70, 300));
    run(world, 0.5);
    run(world, 0.35, () => moveHand(world, tx, top - far + 30, 900));
    run(world, 0.5, () => moveHand(world, tx, top - far - 90, 500));
  }
  const hurt = hp0 - hpOf(world, dummy.nodes);
  const whole = pieces(world, sp.nodes) === 1;
  const mass = mt;
  const pass = hurt >= 4 && whole && mass <= 45; // a wooden club does 0
  return { pass, numbers: { hurt, mass },
    report: `weighs ${mass.toFixed(0)} (the hand lifts 45); three swings at a soft body did ${hurt.toFixed(0)} damage${whole ? '' : ' and it broke'}` };
}

export function testNet(grid: string[]): BenchResult {
  const world = new World(flatTerrain(900, FLOOR));
  const sp = spawnGrid(world, grid, 450, FLOOR - 220);
  const b0 = bounds(world, sp.nodes);
  // pin the two top corners, as if tied between two posts, slightly closer together so it sags
  let left = sp.nodes[0], right = sp.nodes[0];
  for (const i of sp.nodes) {
    if (world.x[i] + world.y[i] * 0.01 < world.x[left] + world.y[left] * 0.01) left = i;
    if (world.x[i] - world.y[i] * 0.01 > world.x[right] - world.y[right] * 0.01) right = i;
  }
  const pins: [number, number, number][] = [[left, world.x[left], world.y[left]], [right, world.x[right], world.y[right]]];
  const hold = () => { for (const [i, x, y] of pins) if (world.alive[i]) { world.x[i] = world.px[i] = x; world.y[i] = world.py[i] = y; } };
  run(world, 2, hold);
  const sag = bounds(world, sp.nodes).y1 - pins[0][2];
  const stones: number[] = [];
  const span = pins[1][1] - pins[0][1];
  // six stones, one at a time, each from a little higher
  for (let k = 0; k < 6; k++) {
    stones.push(world.addNode(Mat.Stone, pins[0][1] + span * (0.3 + 0.08 * k), pins[0][2] - 40 - k * 12));
    run(world, 0.8, hold);
  }
  run(world, 3, hold);
  const caught = stones.filter((i) => world.alive[i] && world.y[i] < FLOOR - 40).length;
  const whole = pieces(world, sp.nodes) === 1;
  const pass = caught >= 4 && whole;
  return { pass, numbers: { caught, sag },
    report: `tied between two posts it sags ${Math.round(sag / D)} cells; it caught ${caught} of 6 falling stones${whole ? '' : ' and tore'}` };
}

export function testLid(grid: string[], bucket: string[] = BUCKET): BenchResult {
  const { world, sp: bk } = stage(bucket);
  const bb = bounds(world, bk.nodes);
  const sp = spawnGrid(world, grid, bb.cx, bb.y0 - (grid.length * D) / 2 - D);
  run(world, 2);
  const stones: number[] = [];
  // six stones, one at a time, from just above
  for (let k = 0; k < 6; k++) {
    stones.push(world.addNode(Mat.Stone, bb.cx - 25 + k * 10, bounds(world, sp.nodes).y0 - 40));
    run(world, 0.7);
  }
  run(world, 3);
  const inside = stones.filter((i) => world.alive[i] && world.x[i] > bb.x0 && world.x[i] < bb.x1 && world.y[i] > bb.y0 + D * 0.5).length;
  const lb = bounds(world, sp.nodes);
  const on = lb.cx > bb.x0 && lb.cx < bb.x1 && lb.y1 < bb.y0 + D * 1.5;
  const pass = inside === 0 && on;
  return { pass, numbers: { inside, on: on ? 1 : 0 },
    report: `set on the bucket it ${on ? 'stays on' : 'fell off or into the bucket'}; ${inside} of 6 stones dropped from above got inside` };
}

export const PURPOSE_TESTS: Record<string, (grid: string[]) => BenchResult> = {
  bucket: testBucket, rope: testRope, wall: testWall, 'spike strip': testSpikeStrip, cage: testCage,
  raft: testRaft, ramp: testRamp, hammer: testHammer, net: testNet, lid: testLid,
};

// ---------------------------------------------------------- general report

/** What happens to this draft in a sandbox, in a few plain lines. */
export function benchReport(gridIn: string[] | string): string {
  const grid = Array.isArray(gridIn) ? gridIn : parseGrid(gridIn);
  const lines: string[] = [];
  const mass = massOf(grid);
  lines.push(`${grid[0].length} by ${grid.length} cells, mass ${mass.toFixed(1)}: ${mass <= 45 ? 'the hand can lift it' : 'too heavy for the hand to lift (limit 45)'}.`);

  // drop it from a little above the floor and see how it lands
  const world = new World(flatTerrain(900, FLOOR));
  const sp = spawnGrid(world, grid, 450, FLOOR - (grid.length * D) / 2 - 30);
  const a = sp.nodes[0], z = sp.nodes[sp.nodes.length - 1];
  const ang0 = Math.atan2(world.y[z] - world.y[a], world.x[z] - world.x[a]);
  run(world, 3);
  const n1 = pieces(world, sp.nodes);
  if (sp.nodes.length > 1 && world.alive[a] && world.alive[z]) {
    let d = Math.atan2(world.y[z] - world.y[a], world.x[z] - world.x[a]) - ang0;
    d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    const b = bounds(world, sp.nodes);
    lines.push(`Dropped on flat ground it ${d > 0.5 ? 'tipped over' : 'landed upright'} and rests ${Math.round((b.x1 - b.x0) / D) + 1} wide by ${Math.round((b.y1 - b.y0) / D) + 1} tall${n1 > 1 ? `, in ${n1} pieces` : ''}.`);
  }
  let anchored = 0;
  for (const i of sp.nodes) if (world.anch[i]) anchored++;
  if (anchored) lines.push(`${anchored} pitch cells stuck to the ground.`);

  // water: pour 40 particles in from above
  const b = bounds(world, sp.nodes);
  const w = pourAbove(world, b.cx, b.y0, Math.max(16, b.x1 - b.x0 - 3 * D), 40);
  run(world, 5);
  const held = countIn(world, w, bounds(world, sp.nodes));
  lines.push(`Poured from above, it held ${held} of 40 water particles after 5 seconds.`);

  // float or sink
  const t = tank();
  const s0 = waterSurface(t);
  const fl = spawnGrid(t, grid, 450, s0 - (grid.length * D) / 2 - 4);
  run(t, 5);
  const fb = bounds(t, fl.nodes);
  const s1 = waterSurface(t);
  lines.push(fb.y0 < s1 ? `In water it floats with ${Math.max(0, Math.round((s1 - fb.y0) / D))} cells above the surface.` : 'In water it sinks.');

  const cost = gridCost(grid);
  if (cost.T) lines.push(`${cost.T} thorn cells will hurt anything that touches them at speed.`);
  if (cost.F && !Object.keys(cost).some((g) => g !== 'F')) lines.push('It is all fiber, so it is limp: it only resists being pulled.');
  return lines.join('\n');
}
