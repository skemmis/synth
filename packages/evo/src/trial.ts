import { config } from '../../sim/src/config.ts';
import { M } from '../../sim/src/materials.ts';
import { spawnRecipe } from '../../sim/src/grid.ts';
import type { World } from '../../sim/src/world.ts';
import { toActuation, toRecipe, type Genome } from './genome.ts';

export interface Spawned { tag: number; nodes: number[]; heart: number; }
/** Put a creature into a world, resting just above the ground at x. */
export function spawnCreature(w: World, g: Genome, x: number, tag: number, flip = false): Spawned {
  const r = toRecipe(g); const H = r.grid.length;
  const y = w.terrain.groundY(x) - 10 - ((H - 1) / 2) * config.cell;
  const s = spawnRecipe(w, r, x, y, { tag, act: toActuation(g), flip });
  // spawnRecipe keys actuation by column; a flipped body keeps its own keys, which is fine for an open-loop rhythm
  const heart = s.nodes.find((i) => w.mat[i] === M.HEART) ?? -1;
  return { tag, nodes: s.nodes, heart };
}
export interface TrialResult { dx: number; eaten: number; closer: number; damage: number; alive: boolean; heartX: number; fitness: number; wreck: number; }
export interface TrialOpts { seconds?: number; spawnX: number; dir?: number; }
/** `wreck` is off in the PRD's fitness. Set it above zero to pay creatures for hit points taken off the base (a lever, see prototype 07). */
export const fitnessConfig = { berry: 1000, damage: 150, death: 200, wreck: 0 };
/**
 * One creature run against a world, steppable so the dream view can show it while it runs.
 * PRD fitness: berries eaten (large weight), plus how much closer the heart got to the nearest berry, minus damage taken.
 * The world passed in is mutated; clone it first.
 */
export class Trial {
  c: Spawned; t = 0; steps: number; done = false; w: World; g: Genome;
  private hp0: number; private eaten0: number; private x0: number; private d0: number; private dBest: number; private lastX: number;
  constructor(w: World, g: Genome, opts: TrialOpts, tag = 9000) {
    this.w = w; this.g = g;
    this.c = spawnCreature(w, g, opts.spawnX, tag, (opts.dir ?? -1) > 0);
    this.hp0 = this.c.nodes.reduce((t, i) => t + w.hp[i], 0); this.eaten0 = w.eaten; this.x0 = this.lastX = w.x[this.c.heart];
    this.d0 = this.dBest = this.nearest(); w.recordEvents = false; this.base0 = this.baseHp(); this.steps = Math.round((opts.seconds ?? 15) / config.dt);
  }
  private base0 = 0;
  /** Hit points left in everything that is not this creature, a berry or water. */
  private baseHp(): number { const w = this.w; let t = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] !== this.c.tag && w.mat[i] !== M.BERRY && w.mat[i] !== M.WATER) t += Math.max(0, w.hp[i]); return t; }
  private nearest(): number {
    const w = this.w, h = this.c.heart; let best = 1e9; if (!w.alive[h]) return best;
    for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === M.BERRY) { const dx = w.x[i] - w.x[h], dy = w.y[i] - w.y[h], d = Math.sqrt(dx * dx + dy * dy); if (d < best) best = d; }
    return best;
  }
  /** Advance up to n steps. Returns true when the trial is over. */
  step(n = 1): boolean {
    const w = this.w, h = this.c.heart;
    for (let k = 0; k < n && !this.done; k++) {
      w.step(); this.t++;
      if (!w.alive[h]) { this.done = true; break; }
      this.lastX = w.x[h];
      if (this.t % 15 === 0) { const d = this.nearest(); if (d < this.dBest) this.dBest = d; if (d > 1e8 && this.d0 < 1e8) this.done = true; /* everything is eaten */ }
      if (this.t >= this.steps) this.done = true;
    }
    return this.done;
  }
  result(): TrialResult {
    const w = this.w, alive = !!w.alive[this.c.heart], eaten = w.eaten - this.eaten0;
    const hp1 = this.c.nodes.reduce((t, i) => t + (w.alive[i] ? Math.max(0, w.hp[i]) : 0), 0);
    const damage = (this.hp0 - hp1) / this.hp0, closer = this.d0 < 1e8 ? this.d0 - this.dBest : this.x0 - this.lastX, dx = this.lastX - this.x0;
    const wreck = fitnessConfig.wreck ? Math.max(0, this.base0 - this.baseHp()) : 0;
    const fitness = eaten * fitnessConfig.berry + closer - damage * fitnessConfig.damage - (alive ? 0 : fitnessConfig.death) + wreck * fitnessConfig.wreck;
    return { dx, eaten, closer, damage, alive, heartX: this.lastX, fitness, wreck };
  }
}
export function runTrial(w: World, g: Genome, opts: TrialOpts): TrialResult { const t = new Trial(w, g, opts); while (!t.step(60)); return t.result(); }
