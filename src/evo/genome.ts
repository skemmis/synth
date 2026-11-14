// A creature is a recipe grid with exactly one heart, plus a few numbers
// that drive its sinew. No brain: movement is open-loop rhythm.
import { CREATURE_GLYPHS, EMPTY, MATERIALS, Mat, NODE_RADIUS, Rng, countPieces, spawnGrid, type Drive, type Spawned, type World } from '../sim';

export interface Genome {
  grid: string[];
  /** beats per second for the whole body */
  freq: number;
  /** per sinew cell "col,row": phase (radians) and amplitude (fraction of rest length) */
  cells: Record<string, { phase: number; amp: number }>;
  name?: string;
}

export const EVO_LIMITS = {
  maxSize: 9,
  minCells: 4,
  maxCells: 40,
  freq: [0.6, 2.2] as [number, number],
  amp: [0.08, 0.32] as [number, number],
};

/** letters a body may be built from, weighted towards the useful ones */
const BODY_GLYPHS = ['W', 'W', 'W', 'N', 'N', 'N', 'F', 'S', 'T', 'P'];
void CREATURE_GLYPHS;

export function cloneGenome(g: Genome): Genome {
  return { grid: g.grid.slice(), freq: g.freq, cells: JSON.parse(JSON.stringify(g.cells)), name: g.name };
}

export function toDrive(g: Genome): Drive {
  return { freq: g.freq, cells: g.cells };
}

export function cellCount(grid: string[]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c !== EMPTY) n++;
  return n;
}

export function bodyMass(grid: string[]): number {
  let m = 0;
  for (const row of grid) for (const c of row) {
    const mat = MATERIALS.find((x) => x.glyph === c);
    if (mat) m += mat.density;
  }
  return m;
}

/** trim empty borders and re-key the sinew cells to match */
export function normalise(g: Genome): Genome {
  let rows = g.grid.map((r) => [...r]);
  const w0 = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => [...r, ...Array<string>(w0 - r.length).fill(EMPTY)]);
  let top = 0, bottom = rows.length, left = 0, right = w0;
  const rowEmpty = (r: number) => rows[r].every((c) => c === EMPTY);
  const colEmpty = (c: number) => rows.every((r) => r[c] === EMPTY);
  while (top < bottom - 1 && rowEmpty(top)) top++;
  while (bottom > top + 1 && rowEmpty(bottom - 1)) bottom--;
  while (left < right - 1 && colEmpty(left)) left++;
  while (right > left + 1 && colEmpty(right - 1)) right--;
  const grid = rows.slice(top, bottom).map((r) => r.slice(left, right).join(''));
  const cells: Genome['cells'] = {};
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[0].length; c++) {
    if (grid[r][c] !== 'N') continue;
    cells[`${c},${r}`] = g.cells[`${c + left},${r + top}`] ?? { phase: 0, amp: MATERIALS[Mat.Sinew].actuation };
  }
  return { grid, freq: g.freq, cells, name: g.name };
}

export function isViable(g: Genome): boolean {
  const grid = g.grid;
  if (!grid.length || grid.length > EVO_LIMITS.maxSize || grid[0].length > EVO_LIMITS.maxSize) return false;
  let hearts = 0, n = 0;
  for (const row of grid) for (const c of row) { if (c === 'H') hearts++; if (c !== EMPTY) n++; }
  if (hearts !== 1 || n < EVO_LIMITS.minCells || n > EVO_LIMITS.maxCells) return false;
  return countPieces(grid) === 1;
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.max(lo, Math.min(hi, v));

/** One random change. Returns a viable genome, or the parent unchanged if no change took. */
export function mutate(parent: Genome, rng: Rng): Genome {
  for (let tries = 0; tries < 12; tries++) {
    const g = cloneGenome(parent);
    const rows = [['.', ...Array<string>(g.grid[0].length).fill('.'), '.'], ...g.grid.map((r) => ['.', ...r, '.']), ['.', ...Array<string>(g.grid[0].length).fill('.'), '.']];
    // sinew keys shift by one because of the padding
    const cells: Genome['cells'] = {};
    for (const [k, v] of Object.entries(g.cells)) { const [c, r] = k.split(',').map(Number); cells[`${c + 1},${r + 1}`] = v; }
    const H = rows.length, W = rows[0].length;
    const filled: [number, number][] = [], edgeEmpty: [number, number][] = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (rows[r][c] !== EMPTY) { filled.push([r, c]); continue; }
      let touches = false;
      for (let dr = -1; dr <= 1 && !touches; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < H && cc >= 0 && cc < W && rows[rr][cc] !== EMPTY && (dr === 0 || dc === 0)) { touches = true; break; }
      }
      if (touches) edgeEmpty.push([r, c]);
    }
    const sinewKeys = () => Object.keys(cells);
    const roll = rng.next();
    if (roll < 0.22) {
      // change a cell's material (never the heart)
      const [r, c] = rng.pick(filled);
      if (rows[r][c] === 'H') continue;
      rows[r][c] = rng.pick(BODY_GLYPHS);
    } else if (roll < 0.42 && edgeEmpty.length) {
      const [r, c] = rng.pick(edgeEmpty);
      rows[r][c] = rng.pick(BODY_GLYPHS);
    } else if (roll < 0.56) {
      const [r, c] = rng.pick(filled);
      if (rows[r][c] === 'H') continue;
      rows[r][c] = EMPTY;
    } else if (roll < 0.62) {
      // mirror left to right, phases with it
      for (const row of rows) row.reverse();
      const flipped: Genome['cells'] = {};
      for (const [k, v] of Object.entries(cells)) { const [c, r] = k.split(',').map(Number); flipped[`${W - 1 - c},${r}`] = { phase: Math.PI - v.phase, amp: v.amp }; }
      for (const k of Object.keys(cells)) delete cells[k];
      Object.assign(cells, flipped);
    } else if (roll < 0.8 && sinewKeys().length) {
      const k = rng.pick(sinewKeys());
      cells[k] = { phase: cells[k].phase + rng.range(-1.2, 1.2), amp: cells[k].amp };
    } else if (roll < 0.92 && sinewKeys().length) {
      const k = rng.pick(sinewKeys());
      cells[k] = { phase: cells[k].phase, amp: clamp(cells[k].amp + rng.range(-0.1, 0.1), EVO_LIMITS.amp) };
    } else {
      g.freq = clamp(g.freq + rng.range(-0.35, 0.35), EVO_LIMITS.freq);
    }
    // new sinew cells get random drive
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = `${c},${r}`;
      if (rows[r][c] === 'N' && !cells[k]) cells[k] = { phase: rng.range(0, Math.PI * 2), amp: rng.range(0.15, 0.35) };
      if (rows[r][c] !== 'N' && cells[k]) delete cells[k];
    }
    const out = normalise({ grid: rows.map((r) => r.join('')), freq: g.freq, cells, name: parent.name });
    if (isViable(out)) return out;
  }
  return cloneGenome(parent);
}

/** a small random body around a heart */
export function randomGenome(rng: Rng): Genome {
  const w = 3 + rng.int(4), h = 2 + rng.int(3);
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => (rng.next() < 0.75 ? rng.pick(BODY_GLYPHS) : EMPTY)));
  rows[rng.int(h)][rng.int(w)] = 'H';
  let g: Genome = { grid: rows.map((r) => r.join('')), freq: rng.range(1, 2), cells: {} };
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (rows[r][c] === 'N') g.cells[`${c},${r}`] = { phase: rng.range(0, 6.283), amp: rng.range(0.15, 0.35) };
  g = normalise(g);
  return isViable(g) ? g : randomGenome(rng);
}

/** put a creature in the world with its lowest row resting on the ground at x */
export function spawnCreature(world: World, g: Genome, x: number): Spawned {
  const hgt = g.grid.length * NODE_RADIUS * 2, wid = g.grid[0].length * NODE_RADIUS * 2;
  let ground = Infinity;
  for (let dx = -wid / 2; dx <= wid / 2; dx += 8) ground = Math.min(ground, world.terrain.heightAt(x + dx));
  return spawnGrid(world, g.grid, x, ground - hgt / 2 - 1, { drive: toDrive(g), kind: 1 });
}

export function genomeToText(g: Genome): string {
  return JSON.stringify({ grid: g.grid, freq: +g.freq.toFixed(3), cells: Object.fromEntries(Object.entries(g.cells).map(([k, v]) => [k, { phase: +v.phase.toFixed(3), amp: +v.amp.toFixed(3) }])) });
}
