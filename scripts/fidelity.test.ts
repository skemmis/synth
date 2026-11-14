// Does a dream trial predict what the same body does in the live world?
import { test } from 'vitest';
import { Evolver, LocalPool, SEEDS, makeArena, runNight, runTrial, spawnCreature } from '../src/evo';
import { CONFIG, LAYOUT, Mat, World, makeTerrain, pourWater } from '../src/sim';

function liveWorld(): World {
  const w = new World(makeTerrain(CONFIG.world.width, 1), CONFIG, 2048, 8192);
  const p = LAYOUT.pond;
  pourWater(w, p.x - p.halfWidth, LAYOUT.groundY + p.depth * 0.2, p.x + p.halfWidth, LAYOUT.groundY + p.depth + 5);
  const sx = LAYOUT.home.stashX, gy = w.terrain.heightAt(sx);
  for (let k = 0; k < 12; k++) w.addNode(Mat.Berry, sx - 20 + (k % 4) * 13, gy - 7 - Math.floor(k / 4) * 11);
  for (let s = 0; s < 240; s++) w.step();
  return w;
}

test('fidelity', async () => {
  const world = liveWorld();
  const arena = makeArena(world);
  const evo = new Evolver(4242, SEEDS);
  await runNight(evo, arena, new LocalPool(), { batch: 8, budgetSteps: 300 * 20 * 60 });
  for (let n = 0; n < 3; n++) await runNight(evo, arena, new LocalPool(), { batch: 8, budgetSteps: 300 * 20 * 60 });
  const elites = [...evo.archive.values()].sort((a, b) => b.fitness - a.fitness).slice(0, 8);
  for (const e of elites) {
    const again = runTrial(arena, e.genome);
    // the same body, alone, in a copy of the full live world
    const live = world.clone();
    const b = spawnCreature(live, e.genome, LAYOUT.burrow.x - 60).body;
    const heart = live.bodyHeart[b]; const x0 = live.x[heart];
    for (let s = 0; s < 20 * 60; s++) live.step();
    const hl = live.bodyHeart[b];
    // and in a second arena cut slightly differently (different node order and table size)
    const arena2 = world.extract(LAYOUT.home.x0 - 300, LAYOUT.burrow.x + 400);
    const other = runTrial(arena2, e.genome);
    console.log(`${e.genome.grid.join('/').padEnd(22)} dream: ate ${e.result.eaten} approach ${e.result.approach.toFixed(0)} | same arena again: ate ${again.eaten} approach ${again.approach.toFixed(0)} | other cut: ate ${other.eaten} approach ${other.approach.toFixed(0)} | live world: ate ${live.bodyEaten[b]} moved ${hl >= 0 ? ((x0 - live.x[hl]) / 12).toFixed(0) : 'dead'}`);
  }
}, 3600000);
