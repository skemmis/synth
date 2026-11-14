import { CONFIG, LAYOUT, Mat, type World } from '../sim';
import type { Elite } from './evolver';
import { spawnCreature } from './genome';
import { EVO_CONFIG } from './trial';

export interface RaidOutcome { eaten: number; killed: number; survivors: number; berriesLeft: number }

/** Run a raid in the live world without a screen: spawn, simulate, then send survivors home. */
export function runRaid(world: World, elites: Elite[], seconds = EVO_CONFIG.raidSeconds): RaidOutcome {
  const before = world.count(Mat.Berry);
  const bodies: number[] = [];
  const total = Math.round((seconds + (elites.length - 1) * 4) / CONFIG.dt);
  for (let s = 0; s < total; s++) {
    const t = s * CONFIG.dt;
    if (bodies.length < elites.length && t >= bodies.length * 4) {
      bodies.push(spawnCreature(world, elites[bodies.length].genome, LAYOUT.burrow.x - 60).body);
    }
    world.step();
    if (bodies.length === elites.length && s % 30 === 0 && (world.count(Mat.Berry) === 0 || bodies.every((b) => world.bodyHeart[b] < 0))) break;
  }
  let killed = 0, survivors = 0;
  for (const b of bodies) {
    if (world.bodyHeart[b] >= 0) {
      survivors++;
      for (let i = 0; i < world.n; i++) if (world.alive[i] && world.body[i] === b) world.removeNode(i);
    } else killed++;
  }
  const left = world.count(Mat.Berry);
  return { eaten: before - left, killed, survivors, berriesLeft: left };
}
