// Creature bookkeeping for the game layer: who is alive, what they ate, and inspection.
import { M, MATERIALS, type World } from '../../sim/src/index.ts';
import { spawnCreature, toRecipe, nicheOf, type Genome } from '../../evo/src/index.ts';
import type { Game } from './app.ts';

export interface Creature { tag: number; g: Genome; heart: number; nodes: number[]; alive: boolean; ate: number; born: number; name: string; }
export class Creatures {
  list: Creature[] = []; nextTag = 1000; selected: Creature | null = null; onChange: () => void = () => {};
  spawn(w: World, g: Genome, x: number, dir = -1): Creature {
    const tag = this.nextTag++; const s = spawnCreature(w, g, x, tag, dir > 0);
    const c: Creature = { tag, g, heart: s.heart, nodes: s.nodes, alive: true, ate: 0, born: w.tick, name: g.name ?? nicheOf(g) };
    this.list.push(c); this.onChange(); return c;
  }
  byTag(tag: number) { return this.list.find((c) => c.tag === tag) ?? null; }
  /** Read the sim's events since last call: berries eaten, hearts destroyed. */
  step(w: World) {
    if (!w.events.length) return; let changed = false;
    for (const e of w.events) {
      if (e.type === 'eat') { const c = this.byTag(e.body); if (c) { c.ate++; changed = true; } }
      if (e.type === 'death' && e.mat === M.HEART) { const c = this.byTag(e.body); if (c) { c.alive = false; changed = true; } }
    }
    w.events.length = 0; if (changed) this.onChange();
  }
  aliveCount() { return this.list.filter((c) => c.alive).length; }
  /** Remove living creatures from the world (survivors leave at dawn). Corpses stay. */
  dismiss(w: World) { for (const c of this.list) if (c.alive) for (const i of c.nodes) if (w.alive[i] && w.tag[i] === c.tag) w.removeNode(i); this.list = this.list.filter((c) => !c.alive); this.onChange(); }
  drawLabels(g: Game, ctx: CanvasRenderingContext2D) {
    const w = g.world, cam = g.cam, z = cam.zoom; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(11 * z)}px "Nunito", system-ui, sans-serif`;
    for (const c of this.list) {
      if (!c.alive || !w.alive[c.heart]) continue; const sx = (w.x[c.heart] - cam.x) * z, sy = (w.y[c.heart] - cam.y) * z - 34 * z;
      if (sx < -50 || sx > cam.w + 50) continue;
      ctx.fillStyle = c === this.selected ? '#f0b429' : 'rgba(35,33,30,.7)'; ctx.fillText(c.name + (c.ate ? ` · ate ${c.ate}` : ''), sx, sy);
    }
  }
  recipeOf(c: Creature) { return { ...toRecipe(c.g), name: c.name }; }
}
export const describeGenome = (g: Genome) => { const n: Record<string, number> = {}; for (const r of g.grid) for (const ch of r) if (ch !== '.') n[ch] = (n[ch] ?? 0) + 1; return Object.entries(n).map(([k, v]) => `${v} ${MATERIALS.find((m) => m.glyph === k)!.name}`).join(', ') + `, beats ${g.freq.toFixed(1)} times a second`; };
