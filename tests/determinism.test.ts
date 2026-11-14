import { expect, test } from 'vitest';
import { CONFIG, makeTerrain, World, spawnGrid } from '../src/sim';
import { BUCKET, fillPond, moveHand, run } from '../src/sim/scenarios';

function scene(seed: number) {
  const w = new World(makeTerrain(CONFIG.world.width, seed));
  fillPond(w);
  const b = spawnGrid(w, BUCKET, 380, 430);
  spawnGrid(w, ['FFFFFFFF'], 300, 400);
  spawnGrid(w, ['SS', 'PP'], 450, 380);
  w.grab(b.nodes[0]);
  run(w, 3, () => moveHand(w, 500, 600, 150));
  return w;
}

test('same seed twice gives the same state hash', () => {
  const a = scene(7), b = scene(7);
  expect(a.stateHash()).toBe(b.stateHash());
  expect(scene(8).stateHash()).not.toBe(a.stateHash());
});

test('a clone evolves identically to the original', () => {
  const a = scene(3);
  const b = a.clone();
  b.hand = JSON.parse(JSON.stringify(a.hand));
  run(a, 2); run(b, 2);
  expect(b.stateHash()).toBe(a.stateHash());
});
