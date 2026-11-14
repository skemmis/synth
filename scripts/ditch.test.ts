import { test } from 'vitest';
import { SEEDS, makeArena, runTrial } from '../src/evo';
import { CONFIG, LAYOUT, Mat, World, makeTerrain } from '../src/sim';
test('ditch', () => {
  const w = new World(makeTerrain(CONFIG.world.width, 1), CONFIG, 512, 2048);
  const sx = LAYOUT.home.stashX, gy = w.terrain.heightAt(sx);
  for (let k = 0; k < 12; k++) w.addNode(Mat.Berry, sx - 20 + (k % 4) * 13, gy - 7 - Math.floor(k / 4) * 11);
  for (let s = 0; s < 60; s++) w.step();
  const arena = makeArena(w);
  console.log('DITCH', JSON.stringify(LAYOUT.ditch), SEEDS.map((s) => { const r = runTrial(arena, s); return `${s.name}: approach ${r.approach.toFixed(0)} ate ${r.eaten} peak ${r.peak.toFixed(1)}`; }).join(' | '));
});
