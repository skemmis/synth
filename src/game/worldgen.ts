import { CONFIG, LAYOUT, makeTerrain, pourWater, spawnGrid, World } from '../sim';
import { PRESETS } from './presets';

/** A fresh world: terrain plus a settled pond. */
export function buildWorld(seed: number, starters = true): World {
  const world = new World(makeTerrain(CONFIG.world.width, seed), CONFIG, 2048, 8192);
  const p = LAYOUT.pond;
  pourWater(world, p.x - p.halfWidth, LAYOUT.groundY + p.depth * 0.2, p.x + p.halfWidth, LAYOUT.groundY + p.depth + 5);
  for (let s = 0; s < 120; s++) world.step();
  if (starters) {
    const gy = (x: number) => world.terrain.heightAt(x);
    const find = (n: string) => PRESETS.find((r) => r.name === n)!.grid;
    spawnGrid(world, find('Bucket'), 700, gy(700) - 40);
    spawnGrid(world, find('Rope'), 860, gy(860) - 10);
    spawnGrid(world, find('Plank'), 1000, gy(1000) - 10);
    spawnGrid(world, find('Stone block'), 1120, gy(1120) - 16);
    for (let s = 0; s < 60; s++) world.step();
  }
  return world;
}
