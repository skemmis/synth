import { expect, test } from 'vitest';
import { CONFIG, exportRegion, importRegion, makeTerrain, World, spawnGrid } from '../src/sim';
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

test('snapshot and restore reproduce the world exactly', () => {
  const a = scene(5);
  a.release();
  const b = World.restore(JSON.parse(JSON.stringify(a.snapshot(), (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v as any) : v))), a.terrain);
  expect(b.stateHash()).toBe(a.stateHash());
  run(a, 2); run(b, 2);
  expect(b.stateHash()).toBe(a.stateHash());
});

test('an extracted arena behaves like the same region of the full world', () => {
  const w = new World(makeTerrain(CONFIG.world.width, 2));
  spawnGrid(w, BUCKET, 2200, 500);
  spawnGrid(w, ['SS', 'PP'], 2300, 480);
  const arena = w.extract(2000, 2600);
  run(w, 3); run(arena, 3);
  expect(arena.liveNodes).toBe(w.liveNodes);
  expect(arena.stateHash()).toBe(w.stateHash());
});

test('a base exported as text and imported into a fresh world is the same base', () => {
  const a = new World(makeTerrain(CONFIG.world.width, 2));
  spawnGrid(a, BUCKET, 2200, 500);
  spawnGrid(a, ['SSS', 'PPP'], 2300, 480);
  spawnGrid(a, ['WFW'], 2100, 480);
  run(a, 3);
  const text = exportRegion(a, 1700, 2900);
  const b = new World(makeTerrain(CONFIG.world.width, 2));
  spawnGrid(b, ['WWW'], 2250, 500); // something already there gets replaced
  expect(importRegion(b, text, 1700, 2900)).toBe(a.liveNodes);
  expect(b.liveNodes).toBe(a.liveNodes);
  run(b, 2);
  let anchored = 0, bonds = 0;
  for (let i = 0; i < b.n; i++) if (b.alive[i] && b.anch[i]) anchored++;
  for (let k = 0; k < b.bn; k++) if (b.balive[k]) bonds++;
  let bondsA = 0;
  for (let k = 0; k < a.bn; k++) if (a.balive[k]) bondsA++;
  expect(anchored).toBe(3);
  expect(bonds).toBe(bondsA);
});

test('a body tried in the arena does exactly what it does in the live world', async () => {
  const { SEEDS, makeArena, spawnCreature, startTrial } = await import('../src/evo');
  const w = new World(makeTerrain(CONFIG.world.width, 2));
  fillPond(w);
  spawnGrid(w, BUCKET, 2200, 500);
  for (let k = 0; k < 6; k++) w.addNode(6, 2100 + k * 14, 550);
  run(w, 2);
  const t = startTrial(makeArena(w), SEEDS[0], 10);
  const body = spawnCreature(w, SEEDS[0], 3190).body;
  for (let s = 0; s < 600; s++) { t.step(); w.step(); }
  const a = t.world.bodyHeart[t.body], b = w.bodyHeart[body];
  expect(a).toBe(b);
  expect(t.world.x[a]).toBe(w.x[b]);
  expect(t.world.y[a]).toBe(w.y[b]);
});
