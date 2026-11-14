// A creature is a recipe grid with exactly one heart, plus a few numbers that drive its sinew (PRD: Genome).
import { Rng } from '../../sim/src/rng.ts';
import { countPieces, type Actuation, type Recipe } from '../../sim/src/grid.ts';

export interface Genome { grid: string[]; freq: number; cells: Record<string, { phase: number; amp: number }>; name?: string; parent?: string; }
export const GW = 9, GH = 7; // genome canvas
const BODY = 'WWWWNNNNNFTSP'; // mutation alphabet, weighted
export const evoConfig = { minCells: 5, maxCells: 26, freqMin: 0.6, freqMax: 2.2, ampMax: 0.4 };

const blank = () => Array.from({ length: GH }, () => '.'.repeat(GW));
const setc = (g: string[], c: number, r: number, ch: string) => { g[r] = g[r].slice(0, c) + ch + g[r].slice(c + 1); };
const cellsOf = (g: string[]) => { const out: [number, number][] = []; for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] !== '.') out.push([c, r]); return out; };
export const cellCount = (g: Genome) => cellsOf(g.grid).length;

export function toRecipe(g: Genome): Recipe { return { name: g.name ?? 'creature', grid: trimGrid(g.grid).grid, parent: g.parent }; }
/** Actuation keyed by cell position in the trimmed grid. */
export function toActuation(g: Genome): Actuation {
  const t = trimGrid(g.grid); const cells: Actuation['cells'] = {};
  for (const [k, v] of Object.entries(g.cells)) { const [c, r] = k.split(',').map(Number); if (g.grid[r]?.[c] === 'N') cells[`${c - t.dc},${r - t.dr}`] = v; }
  return { freq: g.freq, cells };
}
export function trimGrid(grid: string[]): { grid: string[]; dc: number; dr: number } {
  let r0 = 0, r1 = grid.length - 1; while (r0 < r1 && /^\.*$/.test(grid[r0])) r0++; while (r1 > r0 && /^\.*$/.test(grid[r1])) r1--;
  let c0 = 1e9, c1 = -1; for (let r = r0; r <= r1; r++) for (let c = 0; c < grid[r].length; c++) if (grid[r][c] !== '.') { c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  if (c1 < 0) return { grid: ['.'], dc: 0, dr: 0 };
  return { grid: grid.slice(r0, r1 + 1).map((l) => l.slice(c0, c1 + 1).padEnd(c1 - c0 + 1, '.')), dc: c0, dr: r0 };
}
export function isViable(g: Genome): boolean {
  const cells = cellsOf(g.grid); let hearts = 0; for (const [c, r] of cells) if (g.grid[r][c] === 'H') hearts++;
  return hearts === 1 && cells.length >= evoConfig.minCells && cells.length <= evoConfig.maxCells && countPieces(g.grid) === 1;
}
function syncCells(g: Genome, rng: Rng) {
  const keep: Genome['cells'] = {};
  for (const [c, r] of cellsOf(g.grid)) if (g.grid[r][c] === 'N') keep[`${c},${r}`] = g.cells[`${c},${r}`] ?? { phase: rng.range(0, Math.PI * 2), amp: rng.range(0.15, evoConfig.ampMax) };
  g.cells = keep;
}
export function randomGenome(rng: Rng): Genome {
  for (;;) {
    const grid = blank(); const n = 6 + rng.int(12);
    let c = GW >> 1, r = GH >> 1; setc(grid, c, r, 'H'); let placed = 1, guard = 0;
    while (placed < n && guard++ < 400) {
      const cells = cellsOf(grid); const [bc, br] = cells[rng.int(cells.length)];
      const nc = bc + rng.int(3) - 1, nr = br + rng.int(3) - 1;
      if (nc < 0 || nc >= GW || nr < 0 || nr >= GH || grid[nr][nc] !== '.') continue;
      setc(grid, nc, nr, BODY[rng.int(BODY.length)]); placed++;
    }
    const g: Genome = { grid, freq: rng.range(evoConfig.freqMin, evoConfig.freqMax), cells: {} }; syncCells(g, rng);
    if (isViable(g)) return g;
  }
}
/** PRD mutations: change a cell's material, add or remove an edge cell, mirror the body, jitter phase, amplitude and frequency. */
export function mutate(parent: Genome, rng: Rng, name?: string): Genome {
  for (let attempt = 0; attempt < 30; attempt++) {
    const g: Genome = { grid: parent.grid.slice(), freq: parent.freq, cells: JSON.parse(JSON.stringify(parent.cells)), parent: parent.name, name };
    const ops = 1 + (rng.chance(0.35) ? 1 : 0) + (rng.chance(0.1) ? 1 : 0);
    for (let o = 0; o < ops; o++) {
      const cells = cellsOf(g.grid); const roll = rng.next();
      if (roll < 0.22) { // change a material
        const [c, r] = cells[rng.int(cells.length)]; if (g.grid[r][c] !== 'H') setc(g.grid, c, r, BODY[rng.int(BODY.length)]);
      } else if (roll < 0.44) { // add an edge cell
        const [bc, br] = cells[rng.int(cells.length)]; const nc = bc + rng.int(3) - 1, nr = br + rng.int(3) - 1;
        if (nc >= 0 && nc < GW && nr >= 0 && nr < GH && g.grid[nr][nc] === '.') setc(g.grid, nc, nr, BODY[rng.int(BODY.length)]);
      } else if (roll < 0.58) { // remove a cell
        const [c, r] = cells[rng.int(cells.length)]; if (g.grid[r][c] !== 'H') setc(g.grid, c, r, '.');
      } else if (roll < 0.63) { // mirror
        g.grid = g.grid.map((l) => l.split('').reverse().join('')); const m: Genome['cells'] = {};
        for (const [k, v] of Object.entries(g.cells)) { const [c, r] = k.split(',').map(Number); m[`${GW - 1 - c},${r}`] = v; } g.cells = m;
      } else if (roll < 0.7) { // shift the whole body one cell if there is room
        const dc = rng.int(3) - 1, dr = rng.int(3) - 1; const ok = cells.every(([c, r]) => c + dc >= 0 && c + dc < GW && r + dr >= 0 && r + dr < GH);
        if (ok && (dc || dr)) { const ng = blank(); const m: Genome['cells'] = {}; for (const [c, r] of cells) { setc(ng, c + dc, r + dr, g.grid[r][c]); const v = g.cells[`${c},${r}`]; if (v) m[`${c + dc},${r + dr}`] = v; } g.grid = ng; g.cells = m; }
      } else if (roll < 0.78) { // swap two neighbouring cells (this is how the heart moves within the body)
        const [c, r] = rng.chance(0.5) ? cells.find(([cc, rr]) => g.grid[rr][cc] === 'H')! : cells[rng.int(cells.length)];
        const nc = c + rng.int(3) - 1, nr = r + rng.int(3) - 1;
        if (nc >= 0 && nc < GW && nr >= 0 && nr < GH && (nc !== c || nr !== r)) { const a = g.grid[r][c], b = g.grid[nr][nc]; setc(g.grid, c, r, b); setc(g.grid, nc, nr, a); }
      } else if (roll < 0.88) { // jitter one sinew cell
        const keys = Object.keys(g.cells); if (keys.length) { const v = g.cells[keys[rng.int(keys.length)]]; v.phase += rng.range(-0.8, 0.8); v.amp = Math.max(0.05, Math.min(evoConfig.ampMax, v.amp + rng.range(-0.1, 0.1))); }
      } else g.freq = Math.max(evoConfig.freqMin, Math.min(evoConfig.freqMax, g.freq * rng.range(0.8, 1.25)));
    }
    syncCells(g, rng);
    if (isViable(g)) return g;
  }
  return { ...parent, grid: parent.grid.slice(), cells: JSON.parse(JSON.stringify(parent.cells)), name, parent: parent.name };
}
export function crossover(a: Genome, b: Genome, rng: Rng): Genome {
  // body from a, rhythm from b where cells line up
  const g: Genome = { grid: a.grid.slice(), freq: rng.chance(0.5) ? a.freq : b.freq, cells: {} };
  for (const k of Object.keys(a.cells)) g.cells[k] = { ...(rng.chance(0.5) && b.cells[k] ? b.cells[k] : a.cells[k]) };
  return g;
}
/** Niche = body size band by dominant non-wood material (MAP-Elites style). */
export function nicheOf(g: Genome): string {
  const count: Record<string, number> = {}; let n = 0;
  for (const row of g.grid) for (const ch of row) if (ch !== '.') { n++; count[ch] = (count[ch] ?? 0) + 1; }
  const size = n <= 9 ? 'small' : n <= 16 ? 'medium' : 'large';
  let dom = 'wood', best = 0; for (const [ch, label] of [['T', 'thorny'], ['S', 'stony'], ['P', 'sticky'], ['F', 'stringy']] as const) if ((count[ch] ?? 0) >= 2 && (count[ch] ?? 0) > best) { best = count[ch]; dom = label; }
  if (dom === 'wood' && (count.N ?? 0) > n * 0.45) dom = 'sinewy';
  return `${size} ${dom}`;
}
/** A pronounceable name for the n-th creature bred, so raid reports read like a bestiary and not a log. Pure function of n. */
export function creatureName(n: number): string {
  const A = ['Mor', 'Ska', 'Thi', 'Bru', 'Gna', 'Vel', 'Ock', 'Zib', 'Hul', 'Pry', 'Dra', 'Kes', 'Yor', 'Fen', 'Wim', 'Quo'], B = ['ra', 'li', 'to', 'ne', 'ku', 'sha', 'bo', 'mi', 'ga', 'ze'], C = ['k', 'x', 'th', 'n', 'rl', 'sk', 'm', 'p', 'zz', ''];
  let h = (n * 2654435761) >>> 0; const a = A[h % A.length]; h = Math.floor(h / A.length); const b = B[h % B.length]; h = Math.floor(h / B.length); return a + b + C[h % C.length];
}
