// Sharing a base: a snapshot of every node, bond and water particle near the
// home site, as text. Because the simulation is deterministic, a shared base
// can be loaded, raided and remixed by someone else.
import { World, type WorldSnapshot } from './world';

const HEADER = 'SYNTH-BASE-1';
const round = (_k: string, v: unknown) =>
  ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>, (n) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100)) : v;

export function exportRegion(world: World, x0: number, x1: number): string {
  const part = world.extract(x0, x1);
  // settle velocities so the receiver gets a base at rest
  for (let i = 0; i < part.n; i++) { part.px[i] = part.x[i]; part.py[i] = part.y[i]; }
  return `${HEADER}\n${JSON.stringify(part.snapshot(), round)}`;
}

/** Replace everything between x0 and x1 with the shared base. Returns how many nodes arrived. */
export function importRegion(world: World, text: string, x0: number, x1: number): number {
  const t = text.trim();
  if (!t.startsWith(HEADER)) throw new Error('this is not Synth base text');
  const snap = JSON.parse(t.slice(HEADER.length)) as WorldSnapshot;
  const src = World.restore(snap, world.terrain, world.cfg);
  for (let i = 0; i < world.n; i++) if (world.alive[i] && world.x[i] >= x0 && world.x[i] <= x1) world.removeNode(i);
  world.absorb(src);
  return src.liveNodes;
}
