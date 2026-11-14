import { config } from './config.ts';
import { GLYPH, MATERIALS, M } from './materials.ts';
import type { World } from './world.ts';

/** A recipe: the one format shared by player, synthesizer and enemies. */
export interface Recipe { name: string; grid: string[]; parent?: string; note?: string; }
/** Per-creature actuation numbers (PRD: Genome). Keys are "col,row" of sinew cells. */
export interface Actuation { freq: number; cells: Record<string, { phase: number; amp: number }>; }

export const MAX_GRID = 16;

/** Text form: optional "# key: value" header lines, then the grid rows. */
export function recipeToText(r: Recipe): string {
  const head = [`# name: ${r.name}`]; if (r.parent) head.push(`# parent: ${r.parent}`); if (r.note) head.push(`# note: ${r.note}`);
  return [...head, ...r.grid].join('\n') + '\n';
}
export function parseRecipe(text: string): Recipe {
  const r: Recipe = { name: 'untitled', grid: [] };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const h = /^#\s*(\w+)\s*:\s*(.*)$/.exec(line);
    if (h) { if (h[1] === 'name') r.name = h[2]; else if (h[1] === 'parent') r.parent = h[2]; else if (h[1] === 'note') r.note = h[2]; continue; }
    if (line.startsWith('#')) continue;
    if (line.length === 0 && r.grid.length === 0) continue;
    r.grid.push(line.replace(/ /g, '.').toUpperCase());
  }
  while (r.grid.length && /^\.*$/.test(r.grid[r.grid.length - 1])) r.grid.pop();
  const w = Math.max(0, ...r.grid.map((l) => l.length));
  r.grid = r.grid.map((l) => l.padEnd(w, '.'));
  return r;
}

export interface Validation { ok: boolean; errors: string[]; cost: Record<string, number>; cells: number; pieces: number; }
export function validateRecipe(r: Recipe, opts: { allowCreature?: boolean; allowPieces?: boolean } = {}): Validation {
  const errors: string[] = [], cost: Record<string, number> = {};
  const g = r.grid; let cells = 0;
  if (g.length === 0) errors.push('The grid is empty.');
  if (g.length > MAX_GRID || g.some((l) => l.length > MAX_GRID)) errors.push(`The grid is larger than ${MAX_GRID} by ${MAX_GRID}.`);
  for (const row of g) for (const ch of row) {
    if (ch === '.') continue;
    const mi = GLYPH[ch];
    if (mi === undefined) { errors.push(`"${ch}" is not a material.`); continue; }
    const mat = MATERIALS[mi];
    if (mat.fluid) { errors.push('Water cannot be in a blueprint; it has to be scooped.'); continue; }
    if (mat.creatureOnly && !opts.allowCreature) { errors.push(`${mat.name} only grows in creatures.`); continue; }
    cost[ch] = (cost[ch] ?? 0) + 1; cells++;
  }
  if (cells === 0 && g.length) errors.push('The grid has no material in it.');
  const pieces = countPieces(g);
  if (pieces > 1 && !opts.allowPieces) errors.push(`The grid is in ${pieces} separate pieces; it should be one connected piece.`);
  return { ok: errors.length === 0, errors: [...new Set(errors)], cost, cells, pieces };
}
export function countPieces(g: string[]): number {
  const H = g.length, W = Math.max(0, ...g.map((l) => l.length));
  const seen = new Uint8Array(W * H); let pieces = 0;
  const at = (c: number, r: number) => (r >= 0 && r < H && c >= 0 && c < g[r].length ? g[r][c] : '.');
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (at(c, r) === '.' || seen[r * W + c]) continue;
    pieces++; const st = [[c, r]]; seen[r * W + c] = 1;
    while (st.length) {
      const [cc, rr] = st.pop()!;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const c2 = cc + dc, r2 = rr + dr;
        if (at(c2, r2) !== '.' && !seen[r2 * W + c2]) { seen[r2 * W + c2] = 1; st.push([c2, r2]); }
      }
    }
  }
  return pieces;
}

// direction index for the 8 neighbours, used for sinew phase offsets
const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1]];
const dirIndex = (dc: number, dr: number) => (dc === 1 && dr === 0 ? 0 : dc === 1 && dr === 1 ? 1 : dc === 0 && dr === 1 ? 2 : 3);

export interface Spawned { nodes: number[]; cellNode: Map<string, number>; tag: number; }
/**
 * Turn a recipe into nodes and bonds. (x, y) is the centre of the grid. Every pair of touching cells,
 * diagonals included, is bonded. Nothing here knows what the object is for.
 */
export function spawnRecipe(world: World, r: Recipe, x: number, y: number, opts: { angle?: number; tag?: number; act?: Actuation; flip?: boolean } = {}): Spawned {
  const g = r.grid, H = g.length, W = Math.max(0, ...g.map((l) => l.length));
  const cs = config.cell, ang = opts.angle ?? 0, ca = Math.cos(ang), sa = Math.sin(ang);
  const cellNode = new Map<string, number>(), nodes: number[] = [], tag = opts.tag ?? 0;
  for (let row = 0; row < H; row++) for (let col = 0; col < g[row].length; col++) {
    const ch = g[row][col]; if (ch === '.') continue;
    const mi = GLYPH[ch]; if (mi === undefined || mi === M.WATER) continue;
    let lx = (col - (W - 1) / 2) * cs; const ly = (row - (H - 1) / 2) * cs;
    if (opts.flip) lx = -lx;
    const i = world.addNode(mi, x + lx * ca - ly * sa, y + lx * sa + ly * ca, tag);
    if (i < 0) continue;
    cellNode.set(col + ',' + row, i); nodes.push(i);
  }
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
    const a = cellNode.get(col + ',' + row); if (a === undefined) continue;
    for (const [dc, dr] of DIRS) {
      const b = cellNode.get(col + dc + ',' + (row + dr)); if (b === undefined) continue;
      const ma = world.mat[a], mb = world.mat[b];
      if (ma === M.SINEW || mb === M.SINEW) {
        // the sinew cell's phase and amplitude drive the bond; direction adds a phase offset
        const key = ma === M.SINEW ? col + ',' + row : col + dc + ',' + (row + dr);
        const cell = opts.act?.cells[key];
        let di = dirIndex(dc, dr); if (ma !== M.SINEW) di += 4; // direction as seen from the sinew cell
        world.addBond(a, b, { amp: cell?.amp ?? MATERIALS[M.SINEW].actuation, phase: (cell?.phase ?? 0) + di * config.sinewDirPhase, freq: opts.act?.freq ?? 1 });
      } else world.addBond(a, b);
    }
  }
  // Rigid materials resist bending: a straight run of three rigid cells gets a brace across its ends.
  // Fiber (rope, hinge) and sinew (muscle) are left free to fold. See DECISIONS.md, rule 9.
  const stiff = (i: number | undefined) => i !== undefined && MATERIALS[world.mat[i]].mode === 'rigid' && world.mat[i] !== M.SINEW;
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
    const a = cellNode.get(col + ',' + row); if (!stiff(a)) continue;
    for (const [dc, dr] of DIRS) {
      const mid = cellNode.get(col + dc + ',' + (row + dr)), b = cellNode.get(col + 2 * dc + ',' + (row + 2 * dr));
      if (stiff(mid) && stiff(b)) world.addBond(a!, b!, { brace: mid! });
    }
  }
  return { nodes, cellNode, tag };
}
