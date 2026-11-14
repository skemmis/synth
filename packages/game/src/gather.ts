// Sources, inventory and the recipe book (PRD milestone 1).
import { LAYOUT, MATERIALS, GLYPH, type Recipe, recipeToText, parseRecipe, validateRecipe, type World } from '../../sim/src/index.ts';
import type { Game } from './app.ts';
import { el } from './app.ts';
import { costChips } from './panel.ts';

export type Inventory = Record<string, number>;
export interface Source { key: string; glyph: string; x: number; label: string; }
export const SOURCES: Source[] = [
  { key: 'tree', glyph: 'W', x: LAYOUT.sources.tree, label: 'tree' },
  { key: 'outcrop', glyph: 'S', x: LAYOUT.sources.outcrop, label: 'outcrop' },
  { key: 'vines', glyph: 'F', x: LAYOUT.sources.vines, label: 'vines' },
  { key: 'bramble', glyph: 'T', x: LAYOUT.sources.bramble, label: 'bramble' },
  { key: 'resin', glyph: 'P', x: LAYOUT.sources.resin, label: 'resin tree' },
  { key: 'bush', glyph: 'B', x: LAYOUT.sources.bush, label: 'berry bush' },
];
export const canAfford = (inv: Inventory, cost: Record<string, number>) => Object.entries(cost).every(([g, n]) => (inv[g] ?? 0) >= n);
export const missing = (inv: Inventory, cost: Record<string, number>) => Object.entries(cost).filter(([g, n]) => (inv[g] ?? 0) < n).map(([g, n]) => `${n - (inv[g] ?? 0)} more ${MATERIALS[GLYPH[g]].name}`);
export const spend = (inv: Inventory, cost: Record<string, number>) => { for (const [g, n] of Object.entries(cost)) inv[g] = (inv[g] ?? 0) - n; };
export const refund = (inv: Inventory, world: World, nodes: number[]) => { for (const i of nodes) { const m = MATERIALS[world.mat[i]]; if (m.inBlueprint || m.glyph === 'N') inv[m.glyph] = (inv[m.glyph] ?? 0) + 1; } };

export class Gatherer {
  inv: Inventory; pops: { x: number; y: number; t: number; text: string; col: string }[] = [];
  active: Source | null = null; wobble: Record<string, number> = {}; rate = 12; // ticks per unit while held
  onChange: () => void = () => {};
  constructor(start: Inventory = {}) { this.inv = { ...start }; }
  sourceAt(world: World, x: number, y: number): Source | null {
    for (const s of SOURCES) { const gy = world.terrain.groundY(s.x); if (Math.abs(x - s.x) < 60 && y < gy + 6 && y > gy - 170) return s; }
    return null;
  }
  /** Call from onClickWorld. Returns true if the click started gathering. */
  click(g: Game, x: number, y: number, node: number): boolean {
    if (node >= 0) return false; const s = this.sourceAt(g.world, x, y); if (!s) return false;
    this.active = s; this.take(g, s); return true;
  }
  take(g: Game, s: Source) {
    this.inv[s.glyph] = (this.inv[s.glyph] ?? 0) + 1; this.wobble[s.key] = 1;
    const m = MATERIALS[GLYPH[s.glyph]];
    this.pops.push({ x: g.mouse.wx + (g.world.tick % 7) * 4 - 12, y: g.mouse.wy - 10, t: 0, text: '+1 ' + m.name, col: m.color });
    this.onChange();
  }
  step(g: Game) {
    if (this.active && g.mouse.down) { if (g.world.tick % this.rate === 0 && this.sourceAt(g.world, g.mouse.wx, g.mouse.wy) === this.active) this.take(g, this.active); }
    else this.active = null;
    for (const k in this.wobble) this.wobble[k] *= 0.93;
    for (const p of this.pops) { p.t += 1 / 60; p.y -= 0.6; } this.pops = this.pops.filter((p) => p.t < 1);
  }
  drawBack(g: Game, ctx: CanvasRenderingContext2D) {
    const cam = g.cam, z = cam.zoom, w = g.world;
    for (const s of SOURCES) {
      const sx = (s.x - cam.x) * z; if (sx < -200 || sx > cam.w + 200) continue;
      const gy = (w.terrain.groundY(s.x) - cam.y) * z, wob = Math.sin(w.time * 30) * (this.wobble[s.key] ?? 0) * 4 * z;
      ctx.save(); ctx.translate(sx + wob, gy); ctx.scale(z, z); drawSource(ctx, s.key, w.time); ctx.restore();
    }
  }
  drawFront(g: Game, ctx: CanvasRenderingContext2D) {
    const cam = g.cam, z = cam.zoom;
    ctx.font = `700 ${Math.round(13 * z)}px "Nunito", system-ui, sans-serif`; ctx.textAlign = 'center';
    for (const p of this.pops) { ctx.globalAlpha = 1 - p.t; ctx.fillStyle = '#23211e'; ctx.fillText(p.text, (p.x - cam.x) * z + 1, (p.y - cam.y) * z + 1); ctx.fillStyle = p.col; ctx.fillText(p.text, (p.x - cam.x) * z, (p.y - cam.y) * z); }
    ctx.globalAlpha = 1;
  }
  chips(parent: HTMLElement) {
    parent.replaceChildren(); const row = el('div', 'row');
    for (const m of MATERIALS) {
      if (m.fluid || m.glyph === 'H') continue; const n = this.inv[m.glyph] ?? 0; if (m.glyph === 'N' && !n) continue;
      const c = el('span', 'chip'); const d = el('span', 'dot'); d.style.background = m.color; c.append(d, document.createTextNode(`${n} ${m.name}`)); if (!n) c.style.opacity = '.5'; row.append(c);
    }
    parent.append(row);
  }
}
const blob = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, edge: string) => { ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r - 2, 0, 6.2832); ctx.fill(); };
function drawSource(ctx: CanvasRenderingContext2D, key: string, t: number) {
  const C = (g: string) => MATERIALS[GLYPH[g]];
  ctx.lineCap = 'round';
  if (key === 'tree' || key === 'resin') {
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(key === 'tree' ? -8 : 6, -60, 0, -105); ctx.stroke();
    const leaf = key === 'tree' ? ['#7fb069', '#4f7a3f'] : ['#a3b86c', '#66773a'];
    for (const [x, y, r] of [[-28, -112, 30], [26, -118, 28], [0, -140, 34], [-6, -100, 24]]) blob(ctx, x, y + Math.sin(t * 1.3 + x) * 1.5, r, leaf[0], leaf[1]);
    if (key === 'resin') for (const [x, y] of [[-6, -70], [7, -48], [-3, -28]]) blob(ctx, x, y, 7, C('P').color, C('P').edge);
    else for (const [x, y] of [[-14, -40], [12, -22]]) blob(ctx, x, y, 8, C('W').color, C('W').edge);
  } else if (key === 'outcrop') {
    for (const [x, y, r] of [[-30, -14, 22], [8, -22, 30], [38, -10, 18], [-4, -48, 20]]) blob(ctx, x, y, r, C('S').color, C('S').edge);
  } else if (key === 'vines') {
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-34, -120); ctx.lineTo(34, -120); ctx.lineTo(34, 0); ctx.stroke();
    for (let k = -2; k <= 2; k++) for (let j = 0; j < 5 - Math.abs(k); j++) blob(ctx, k * 13 + Math.sin(t * 1.5 + j + k) * 2 * j, -108 + j * 15, 7, C('F').color, C('F').edge);
  } else if (key === 'bramble') {
    ctx.strokeStyle = C('T').edge; ctx.lineWidth = 2;
    for (const [x, y, r] of [[-26, -16, 20], [14, -20, 24], [-4, -44, 20], [36, -12, 14]]) {
      ctx.beginPath(); for (let k = 0; k < 9; k++) { const a = k * 0.698 + x; ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.lineTo(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)); } ctx.stroke();
      blob(ctx, x, y, r, C('T').color, C('T').edge);
    }
  } else if (key === 'bush') {
    for (const [x, y, r] of [[-28, -18, 24], [20, -22, 28], [-2, -46, 24]]) blob(ctx, x, y, r, '#5f9e58', '#3a6b37');
    for (const [x, y] of [[-30, -24], [-8, -52], [14, -34], [30, -14], [2, -16], [-16, -6]]) blob(ctx, x, y, 6, C('B').color, C('B').edge);
  }
}

// ---------- recipe book ----------
export interface BookEntry { recipe: Recipe; talk?: { role: string; text: string }[]; }
export class RecipeBook {
  entries: BookEntry[] = []; key: string; onChange: () => void = () => {};
  constructor(key: string, seed: Recipe[] = []) {
    this.key = key;
    try { const raw = localStorage.getItem(key); if (raw) this.entries = JSON.parse(raw); } catch { /* storage may be unavailable */ }
    if (!this.entries.length) this.entries = seed.map((recipe) => ({ recipe }));
  }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.entries)); } catch { /* fine without it */ } this.onChange(); }
  add(recipe: Recipe, talk?: BookEntry['talk']) {
    const i = this.entries.findIndex((e) => e.recipe.name === recipe.name);
    if (i >= 0) this.entries[i] = { recipe, talk }; else this.entries.unshift({ recipe, talk });
    this.save();
  }
  remove(name: string) { this.entries = this.entries.filter((e) => e.recipe.name !== name); this.save(); }
  exportText(): string { return this.entries.map((e) => recipeToText(e.recipe)).join('\n'); }
  /** Import one or more recipes from text; blocks are separated by blank lines or a new "# name:" line. */
  importText(text: string): { added: number; errors: string[] } {
    const blocks: string[] = []; let cur: string[] = [];
    for (const line of text.replace(/\r/g, '').split('\n')) {
      if (/^#\s*name\s*:/.test(line) && cur.some((l) => l.trim() && !l.startsWith('#'))) { blocks.push(cur.join('\n')); cur = []; }
      if (!line.trim() && cur.some((l) => l.trim() && !l.startsWith('#'))) { blocks.push(cur.join('\n')); cur = []; continue; }
      cur.push(line);
    }
    if (cur.some((l) => l.trim())) blocks.push(cur.join('\n'));
    let added = 0; const errors: string[] = [];
    for (const b of blocks) { const r = parseRecipe(b); const v = validateRecipe(r); if (v.ok) { this.add(r); added++; } else errors.push(`${r.name}: ${v.errors[0]}`); }
    return { added, errors };
  }
  /** Renders the list. `act` receives the chosen recipe. */
  render(parent: HTMLElement, inv: Inventory | null, act: { use: (r: Recipe) => void; edit: (r: Recipe) => void }) {
    parent.replaceChildren();
    for (const e of this.entries) {
      const v = validateRecipe(e.recipe); const row = el('div', 'bookrow');
      const head = el('div', 'row'); head.style.alignItems = 'center';
      const name = el('b', '', e.recipe.name); name.style.flex = '1';
      const use = el('button', 'primary', 'Make'); use.disabled = !!inv && !canAfford(inv, v.cost); use.onclick = () => act.use(e.recipe);
      const edit = el('button', '', 'Edit'); edit.onclick = () => act.edit(e.recipe);
      const del = el('button', '', '×'); del.title = 'Remove from book'; del.setAttribute('aria-label', `Remove ${e.recipe.name}`); del.onclick = () => this.remove(e.recipe.name);
      head.append(name, use, edit, del); row.append(head, costChips(v.cost, inv ?? undefined)); parent.append(row);
    }
  }
}
export const BOOK_CSS = `.bookrow{display:grid;gap:5px;padding:8px 0;border-top:1px solid var(--line)}.bookrow:first-child{border-top:0}`;
