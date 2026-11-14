/// <reference lib="webworker" />
// Runs trials off the main thread. The arena arrives once per night as a snapshot.
import { Terrain, World, type WorldSnapshot } from '../sim';
import type { Genome } from './genome';
import { runTrial } from './trial';

let arena: World | null = null;

type Msg =
  | { type: 'arena'; snap: WorldSnapshot; width: number; h: Float32Array }
  | { type: 'trial'; id: number; genome: Genome; seconds: number };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === 'arena') {
    arena = World.restore(m.snap, new Terrain(m.width, m.h));
    (self as unknown as Worker).postMessage({ type: 'ready' });
  } else if (m.type === 'trial' && arena) {
    const result = runTrial(arena, m.genome, m.seconds);
    (self as unknown as Worker).postMessage({ type: 'result', id: m.id, result });
  }
};
