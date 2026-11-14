import { LAYOUT, Mat, type World } from '../sim';
import type { Genome } from './genome';
import { startTrial } from './trial';

export type Breach = 'vault' | 'climb' | 'shove' | 'smash' | 'none';

/**
 * How did this creature get past a barrier? Replays its trial and watches
 * the barrier (every non-berry, non-water node that was in the arena).
 */
export function classifyBreach(arena: World, genome: Genome): { breach: Breach; eaten: number } {
  const t = startTrial(arena, genome);
  const w = t.world;
  const wall: number[] = [];
  let top = Infinity, wx = 0;
  for (let i = 0; i < arena.n; i++) {
    if (!arena.alive[i] || arena.mat[i] === Mat.Berry || arena.mat[i] === Mat.Water) continue;
    wall.push(i); top = Math.min(top, arena.y[i]); wx += arena.x[i];
  }
  if (!wall.length) return { breach: 'none', eaten: 0 };
  wx /= wall.length;
  const x0 = wall.map((i) => arena.x[i]);
  let breach: Breach = 'none';
  while (!t.done) {
    t.step();
    const h = w.bodyHeart[t.body];
    if (h < 0 || breach !== 'none' || w.x[h] >= wx) continue;
    // the heart has just passed the line of the barrier: what state is the barrier in?
    let lost = 0, moved = 0, topNow = Infinity;
    wall.forEach((i, k) => {
      if (!w.alive[i]) { lost++; return; }
      moved = Math.max(moved, Math.abs(w.x[i] - x0[k]));
      topNow = Math.min(topNow, w.y[i]);
    });
    if (lost > 0) breach = 'smash';
    else if (moved > 18 || topNow > top + 9) breach = 'shove';      // pushed aside or knocked flat first
    else breach = w.y[h] < top - 30 ? 'vault' : 'climb';             // barrier still standing: over it
  }
  void LAYOUT;
  return { breach, eaten: w.bodyEaten[t.body] ?? 0 };
}
