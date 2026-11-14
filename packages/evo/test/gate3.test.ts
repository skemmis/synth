import { describe, it, expect } from 'vitest';
import { Terrain } from '../../sim/src/terrain.ts'; import { World } from '../../sim/src/world.ts'; import { M } from '../../sim/src/materials.ts';
import { RECIPES } from '../../sim/src/recipes.ts'; import { spawnRecipe } from '../../sim/src/grid.ts';
import { SEEDS } from '../src/seeds.ts'; import { runTrial, spawnCreature } from '../src/trial.ts'; import { isViable, mutate, randomGenome } from '../src/genome.ts'; import { Rng } from '../../sim/src/rng.ts';

const flat = () => new World(Terrain.flat(2400, 900, 600));
describe('milestone 3 gate', () => {
  it('every seed crawler travels 30 node diameters over flat ground in 15 simulated seconds', () => {
    for (const s of SEEDS) { const r = runTrial(flat(), s, { spawnX: 2000, seconds: 15 }); expect(-r.dx, s.name).toBeGreaterThanOrEqual(30 * 16); expect(r.alive).toBe(true); }
  });
  it('a heart touching a berry eats it', () => {
    const w = flat(); const berry = w.addNode(M.BERRY, 1000, 592); w.addNode(M.HEART, 1012, 592, 1000);
    for (let i = 0; i < 5; i++) w.step();
    expect(w.alive[berry]).toBe(0); expect(w.eaten).toBe(1);
  });
  it('a creature whose heart is destroyed stops, and its body stays as salvage', () => {
    const w = flat(); const c = spawnCreature(w, SEEDS[0], 2000, 1000); for (let i = 0; i < 60; i++) w.step();
    w.damage(c.heart, 999); const x0 = c.nodes.filter((i) => w.alive[i]).map((i) => w.x[i]);
    for (let i = 0; i < 240; i++) w.step();
    const left = c.nodes.filter((i) => w.alive[i]); expect(left.length).toBe(c.nodes.length - 1);
    expect(left.some((i) => w.mat[i] === M.SINEW)).toBe(true); // sinew is there to salvage
    const moved = Math.max(...left.map((i, k) => Math.abs(w.x[i] - x0[k]))); expect(moved).toBeLessThan(60);
    expect(w.heartsLost).toBe(1);
  });
  it('mutation always yields a viable body with exactly one heart', () => {
    const rng = new Rng(3); let g = randomGenome(rng);
    for (let i = 0; i < 300; i++) { g = mutate(g, rng); expect(isViable(g)).toBe(true); }
  });
});
