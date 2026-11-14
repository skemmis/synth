// Milestone 3 gate: a seed crawler travels 30 node diameters over flat
// ground in 15 simulated seconds. Plus the creature rules: hearts eat
// berries, creatures die when the heart is destroyed, corpses stay.
import { describe, expect, test } from 'vitest';
import { SEEDS, spawnCreature } from '../src/evo';
import { Mat, World, flatTerrain, spawnGrid } from '../src/sim';
import { moveHand, run } from '../src/sim/scenarios';

function crawl(i: number) {
  const world = new World(flatTerrain(3000, 600), undefined, 128, 512);
  const sp = spawnCreature(world, SEEDS[i], 2000);
  run(world, 0.5);
  const x0 = world.x[world.bodyHeart[sp.body]];
  run(world, 15);
  const heart = world.bodyHeart[sp.body];
  return { cells: (x0 - world.x[heart]) / 12, whole: world.component(heart).length, nodes: sp.nodes.length };
}

describe('milestone 3 gate', () => {
  test('every seed crawler travels 30 node diameters in 15 seconds', () => {
    const lines: string[] = [];
    SEEDS.forEach((s, i) => {
      const r = crawl(i);
      lines.push(`${s.name} (${s.grid.join('/')}): ${r.cells.toFixed(1)} diameters, ${r.whole}/${r.nodes} cells still attached`);
      expect(r.cells).toBeGreaterThanOrEqual(30);
    });
    console.log(`GATE seed crawlers over flat ground in 15 s:\n  ${lines.join('\n  ')}`);
  });

  test('a heart that reaches a berry eats it', () => {
    const world = new World(flatTerrain(3000, 600), undefined, 128, 512);
    const sp = spawnCreature(world, SEEDS[0], 1500);
    for (let k = 0; k < 6; k++) world.addNode(Mat.Berry, 1380 - k * 30, 593);
    run(world, 12);
    expect(world.bodyEaten[sp.body]).toBeGreaterThan(0);
    expect(world.count(Mat.Berry)).toBe(6 - world.berriesEaten);
  });

  test('a thorn club kills a creature; the corpse stays, heartless, and can be salvaged', () => {
    const world = new World(flatTerrain(3000, 600), undefined, 256, 1024);
    // a slow, inert body so the club can find it
    const sp = spawnGrid(world, ['WWHWW', 'NWWWN'], 1500, 587, { kind: 1, drive: { freq: 1, cells: { '0,1': { phase: 0, amp: 0 }, '4,1': { phase: 0, amp: 0 } } } });
    const club = spawnGrid(world, ['WWWT', '...T'], 1440, 540);
    world.grab(club.nodes[0]);
    // scrub the thorn head back and forth across wherever the heart is
    for (let s = 0; s < 40 && world.bodyHeart[sp.body] >= 0; s++) {
      const hx = world.x[world.bodyHeart[sp.body]], hy = world.y[world.bodyHeart[sp.body]];
      run(world, 0.25, () => moveHand(world, hx - 36 + (s % 2 ? -40 : 40) - 12, hy - 14, 700));
    }
    expect(world.bodyHeart[sp.body]).toBe(-1);                       // dead
    const corpse = sp.nodes.filter((i) => world.alive[i]);
    expect(corpse.length).toBeGreaterThan(0);                         // corpse remains
    console.log(`GATE death: heart destroyed, ${corpse.length} of ${sp.nodes.length} cells left as a corpse (${corpse.filter((i) => world.mat[i] === Mat.Sinew).length} sinew), took ${world.bodyDamage[sp.body].toFixed(0)} damage`);
  });
});
