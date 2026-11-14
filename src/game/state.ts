import { GLYPH_TO_MAT, LAYOUT, MATERIALS, Mat, gridCost, spawnGrid, type Recipe, type World } from '../sim';
import { PRESETS } from './presets';
import type { Scenery } from './render';

/** How generous each source is. Scarcity is a tuning lever (see PRD: the creativity question). */
export const GATHER: Record<string, { glyph: string; perClick: number; label: string }> = {
  tree: { glyph: 'W', perClick: 4, label: 'Tree' },
  outcrop: { glyph: 'S', perClick: 3, label: 'Outcrop' },
  vines: { glyph: 'F', perClick: 4, label: 'Vines' },
  bramble: { glyph: 'T', perClick: 2, label: 'Bramble' },
  resin: { glyph: 'P', perClick: 2, label: 'Resin tree' },
  bush: { glyph: 'B', perClick: 1, label: 'Berry bush' },
};
export const GATHER_COOLDOWN = 0.22;
export const STASH_SIZE = 12;
export const BUSH_STOCK = 6;

const BOOK_KEY = 'synth.book.v1';

export function makeScenery(): Scenery[] {
  const s: Scenery[] = Object.entries(LAYOUT.sources).map(([kind, x]) => ({ kind, x, label: GATHER[kind].label }));
  s.push({ kind: 'home', x: LAYOUT.home.stashX - 90, label: 'Home' });
  s.push({ kind: 'burrow', x: LAYOUT.burrow.x, label: 'Burrow' });
  return s;
}

/** which source, if any, is under a world point */
export function sourceAt(world: World, scenery: Scenery[], x: number, y: number): Scenery | null {
  for (const s of scenery) {
    if (!GATHER[s.kind]) continue;
    const gy = world.terrain.heightAt(s.x);
    const tall = s.kind === 'tree' || s.kind === 'resin' ? 230 : s.kind === 'vines' ? 130 : 80;
    if (Math.abs(x - s.x) < 62 && y < gy + 4 && y > gy - tall) return s;
  }
  return null;
}

/** What the player owns and knows. */
export class Player {
  inventory: Record<string, number> = {};
  book: Recipe[] = [];
  freeBuild = false;
  day = 1;
  bushStock = BUSH_STOCK;

  constructor() {
    for (const m of MATERIALS) if (m.blueprint) this.inventory[m.glyph] = 0;
    this.book = this.loadBook() ?? PRESETS.slice(0, 4).map((r) => ({ ...r }));
  }

  private loadBook(): Recipe[] | null {
    try {
      const raw = localStorage.getItem(BOOK_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch { return null; }
  }

  saveBook() {
    try { localStorage.setItem(BOOK_KEY, JSON.stringify(this.book)); } catch { /* storage may be unavailable */ }
  }

  /** add or replace by name; returns the stored recipe */
  keep(r: Recipe): Recipe {
    const i = this.book.findIndex((b) => b.name === r.name);
    const copy = { ...r, grid: r.grid.slice() };
    if (i >= 0) this.book[i] = copy; else this.book.unshift(copy);
    this.saveBook();
    return copy;
  }

  forget(name: string) {
    this.book = this.book.filter((b) => b.name !== name);
    this.saveBook();
  }

  /** glyph -> how many more are needed; empty when affordable */
  missing(grid: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    if (this.freeBuild) return out;
    for (const [g, n] of Object.entries(gridCost(grid))) {
      const have = this.inventory[g] ?? 0;
      if (have < n) out[g] = n - have;
    }
    return out;
  }

  canAfford(grid: string[]): boolean {
    return Object.keys(this.missing(grid)).length === 0;
  }

  spend(grid: string[]) {
    if (this.freeBuild) return;
    for (const [g, n] of Object.entries(gridCost(grid))) this.inventory[g] = (this.inventory[g] ?? 0) - n;
  }

  add(glyph: string, n: number) {
    this.inventory[glyph] = (this.inventory[glyph] ?? 0) + n;
  }
}

export function describeCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([g, n]) => `${n} ${MATERIALS[GLYPH_TO_MAT[g]]?.name.toLowerCase() ?? g}`)
    .join(', ');
}

/** loose berries on the ground at the home site: what raiders come for */
export function spawnStash(world: World, count = STASH_SIZE) {
  const x0 = LAYOUT.home.stashX;
  const gy = world.terrain.heightAt(x0);
  for (let k = 0; k < count; k++) {
    const col = k % 4, row = Math.floor(k / 4);
    spawnGrid(world, ['B'], x0 - 20 + col * 13 + (row % 2) * 6, gy - 7 - row * 11);
  }
}

/** berries lying in the home site */
export function countStash(world: World): number {
  let c = 0;
  for (let i = 0; i < world.n; i++) {
    if (world.alive[i] && world.mat[i] === Mat.Berry && world.adjN[i] === 0) c++;
  }
  return c;
}
