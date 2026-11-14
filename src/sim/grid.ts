import { CONFIG } from './config';
import { GLYPH_TO_MAT, MATERIALS, Mat, NODE_RADIUS } from './materials';
import { B_TENSION, type World } from './world';

/** The one recipe format, shared by player, synthesizer and creatures. */
export interface Recipe {
  name: string;
  grid: string[];
  note?: string;
  /** name of the recipe this was remixed from */
  parent?: string;
}

/** Per-creature numbers that drive sinew. Keys are "col,row" of sinew cells. */
export interface Drive {
  freq: number;
  cells: Record<string, { phase: number; amp: number }>;
}

export const EMPTY = '.';

/** Rule switches for design experiments. `allowHearts` lets a player blueprint contain a heart. */
export const GRID_RULES = { allowHearts: false };

/** Turn pasted text into grid rows: trims blank edges, pads rows to equal width. */
export function parseGrid(text: string | string[]): string[] {
  let rows = Array.isArray(text) ? text.slice() : text.split(/\r?\n/);
  // If dots are used for empty cells, spaces are just decoration (people type
  // "W . . W"). If there are no dots at all, spaces are the empty cells.
  const dotted = rows.some((r) => r.includes('.'));
  rows = rows.map((r) => (dotted ? r.replace(/\s/g, '') : r.replace(/\t/g, ' ').replace(/\s+$/, '').replace(/ /g, '.')));
  rows = rows.map((r) => r.toUpperCase());
  while (rows.length && /^\.*$/.test(rows[0])) rows.shift();
  while (rows.length && /^\.*$/.test(rows[rows.length - 1])) rows.pop();
  if (!rows.length) return [];
  const w = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => r.padEnd(w, '.'));
  // trim empty columns left and right
  let l = 0, r = w;
  while (l < r && rows.every((row) => row[l] === '.')) l++;
  while (r > l && rows.every((row) => row[r - 1] === '.')) r--;
  return rows.map((row) => row.slice(l, r));
}

export interface GridCheck { ok: boolean; errors: string[] }

export function validateGrid(
  grid: string[],
  opts: { creature?: boolean; allowDisconnected?: boolean; maxSize?: number } = {},
): GridCheck {
  const errors: string[] = [];
  const max = opts.maxSize ?? CONFIG.recipe.maxSize;
  if (!grid.length) return { ok: false, errors: ['the grid is empty'] };
  const w = grid[0].length;
  if (grid.length > max || w > max) errors.push(`grid is ${w}x${grid.length}; the limit is ${max}x${max}`);
  if (grid.some((r) => r.length !== w)) errors.push('rows have different lengths');
  let cells = 0, hearts = 0;
  for (const row of grid) {
    for (const g of row) {
      if (g === EMPTY) continue;
      cells++;
      const id = GLYPH_TO_MAT[g];
      if (id === undefined) { errors.push(`unknown glyph "${g}"`); continue; }
      const m = MATERIALS[id];
      if (id === Mat.Water) errors.push('water cannot be in a blueprint; it must be scooped');
      else if (m.creatureOnly && !opts.creature && !GRID_RULES.allowHearts) errors.push(`${m.name} (${g}) is creature-only`);
      if (id === Mat.Heart) hearts++;
    }
  }
  if (cells === 0) errors.push('the grid has no cells');
  if (opts.creature && hearts !== 1) errors.push(`a creature needs exactly one heart, found ${hearts}`);
  if (!opts.allowDisconnected && cells > 0 && countPieces(grid) > 1) {
    errors.push('the grid is in more than one piece');
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/** number of 8-connected pieces */
export function countPieces(grid: string[]): number {
  const h = grid.length, w = grid[0]?.length ?? 0;
  const seen = new Uint8Array(w * h);
  let pieces = 0;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || (grid[(s / w) | 0][s % w] ?? EMPTY) === EMPTY) continue;
    pieces++;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % w, cy = (c / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (seen[k] || (grid[ny][nx] ?? EMPTY) === EMPTY) continue;
        seen[k] = 1; stack.push(k);
      }
    }
  }
  return pieces;
}

/** material cost: count of each glyph */
export function gridCost(grid: string[]): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const row of grid) for (const g of row) if (g !== EMPTY) cost[g] = (cost[g] ?? 0) + 1;
  return cost;
}

export function gridSize(grid: string[]): { w: number; h: number } {
  const s = 2 * NODE_RADIUS;
  return { w: (grid[0]?.length ?? 0) * s, h: grid.length * s };
}

export interface Spawned { body: number; nodes: number[] }

/**
 * Build a recipe into the world, centred on (cx, cy).
 * Each cell becomes a node; every pair of touching cells (8 neighbours) is bonded.
 * A bond is tension-only if either end is fiber and actuated if either end is sinew.
 */
export function spawnGrid(
  world: World, grid: string[], cx: number, cy: number,
  opts: { angle?: number; drive?: Drive; kind?: number } = {},
): Spawned {
  const h = grid.length, w = grid[0]?.length ?? 0;
  const s = 2 * NODE_RADIUS;
  const body = world.newBody(opts.kind ?? 0);
  const ids = new Int32Array(w * h).fill(-1);
  const nodes: number[] = [];
  const ca = Math.cos(opts.angle ?? 0), sa = Math.sin(opts.angle ?? 0);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const g = grid[r][c];
      if (g === EMPTY || g === undefined) continue;
      const mat = GLYPH_TO_MAT[g];
      if (mat === undefined) continue;
      const lx = (c - (w - 1) / 2) * s, ly = (r - (h - 1) / 2) * s;
      const i = world.addNode(mat, cx + lx * ca - ly * sa, cy + lx * sa + ly * ca, body);
      ids[r * w + c] = i;
      nodes.push(i);
    }
  }
  const drive = opts.drive;
  const freq = drive?.freq ?? world.cfg.sinew.frequency;
  // each pair once: east, south-west, south, south-east
  const dirs = [[1, 0], [-1, 1], [0, 1], [1, 1]];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const a = ids[r * w + c];
      if (a < 0) continue;
      for (const [dc, dr] of dirs) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 < 0 || c2 >= w || r2 >= h) continue;
        const b = ids[r2 * w + c2];
        if (b < 0) continue;
        const ma = world.mat[a], mb = world.mat[b];
        const flags = ma === Mat.Fiber || mb === Mat.Fiber ? B_TENSION : 0;
        let amp = 0, phase = 0;
        if (ma === Mat.Sinew || mb === Mat.Sinew) {
          // the sinew cell owns the bond; direction is measured outward from it
          const fromA = ma === Mat.Sinew;
          const key = fromA ? `${c},${r}` : `${c2},${r2}`;
          const cell = drive?.cells[key];
          amp = cell?.amp ?? MATERIALS[Mat.Sinew].actuation;
          const dirAngle = Math.atan2(fromA ? dr : -dr, fromA ? dc : -dc);
          phase = (cell?.phase ?? 0) + dirAngle;
        }
        world.addBond(a, b, s * Math.hypot(dc, dr), { flags, amp, phase, freq });
      }
    }
  }
  // bending stiffness: the middle of a straight run of three braced cells is held at the midpoint
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const mid = ids[r * w + c];
      if (mid < 0) continue;
      const bm = MATERIALS[world.mat[mid]].brace;
      if (bm <= 0) continue;
      for (const [dc, dr] of dirs) {
        const c0 = c - dc, r0 = r - dr, c2 = c + dc, r2 = r + dr;
        if (c0 < 0 || c0 >= w || r0 < 0 || c2 < 0 || c2 >= w || r2 >= h) continue;
        const a = ids[r0 * w + c0], b = ids[r2 * w + c2];
        if (a < 0 || b < 0) continue;
        const stiff = Math.min(bm, MATERIALS[world.mat[a]].brace, MATERIALS[world.mat[b]].brace);
        if (stiff <= 0) continue;
        world.addBrace(a, mid, b, stiff);
      }
    }
  }
  return { body, nodes };
}

/** Fill a rectangle with water particles (hex packed, sizes jittered by index). */
export function pourWater(world: World, x0: number, y0: number, x1: number, y1: number, max = 1e9): number[] {
  const r = MATERIALS[Mat.Water].radius;
  const jit = world.cfg.water.radiusJitter;
  const out: number[] = [];
  const step = r * 2 + 0.6;
  let row = 0;
  for (let y = y1 - r; y > y0 && out.length < max; y -= step * 0.9, row++) {
    for (let x = x0 + r + (row % 2 ? step / 2 : 0); x < x1 - r && out.length < max; x += step) {
      if (y + r > world.terrain.heightAt(x)) continue;
      // deterministic size jitter keeps the particles from crystallising
      const k = (out.length * 2654435761) >>> 0;
      const rr = r + (((k >>> 8) % 1000) / 1000 - 0.5) * 2 * jit;
      out.push(world.addNode(Mat.Water, x, y, -1, rr));
    }
  }
  return out;
}

// ------------------------------------------------------------ recipe text

/**
 * Plain-text recipe format, meant to be pasted to a friend:
 *
 *   # Bucket
 *   # note: holds water
 *   # parent: Trough
 *   W...W
 *   WWWWW
 *
 * Recipes are separated by blank lines. A block with no "# name" line is
 * still accepted and gets a default name.
 */
export function formatRecipe(r: Recipe): string {
  const lines = [`# ${r.name}`];
  if (r.note) lines.push(`# note: ${r.note.replace(/\s+/g, ' ')}`);
  if (r.parent) lines.push(`# parent: ${r.parent}`);
  return [...lines, ...r.grid].join('\n');
}

export function formatRecipes(rs: Recipe[]): string {
  return rs.map(formatRecipe).join('\n\n') + '\n';
}

export function parseRecipes(text: string): Recipe[] {
  const out: Recipe[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim().length);
    if (!lines.length) continue;
    const r: Recipe = { name: '', grid: [] };
    const rows: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('#')) {
        const body = t.slice(1).trim();
        const kv = /^(note|parent)\s*:\s*(.*)$/i.exec(body);
        if (kv) (r as any)[kv[1].toLowerCase()] = kv[2];
        else if (!r.name) r.name = body;
      } else rows.push(line);
    }
    r.grid = parseGrid(rows);
    if (!r.grid.length) continue;
    if (!r.name) r.name = `Recipe ${out.length + 1}`;
    out.push(r);
  }
  return out;
}
