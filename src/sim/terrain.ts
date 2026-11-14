import { Rng } from './rng';

/** Where things sit along the strip. All numbers are world units. */
export const LAYOUT = {
  groundY: 560,
  pond: { x: 380, halfWidth: 230, depth: 95, edge: 70 },
  sources: {
    tree: 760, outcrop: 930, vines: 1090, bramble: 1250, resin: 1410, bush: 1570,
  },
  home: { x0: 1800, x1: 2540, stashX: 2300 },
  ditch: { x: 2760, halfWidth: 150, depth: 28, edge: 130 },
  burrow: { x: 3040 },
  roughness: 7,
} as const;

export type Layout = typeof LAYOUT;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** depth multiplier (0..1) of a basin centred at cx */
function basin(x: number, cx: number, halfWidth: number, edge: number): number {
  const d = Math.abs(x - cx);
  return 1 - smooth((d - (halfWidth - edge)) / edge);
}

/** Static heightmap. y grows downward, so a larger h is lower ground. */
export class Terrain {
  readonly dx = 8;
  readonly h: Float32Array;
  constructor(readonly width: number, h: Float32Array) { this.h = h; }

  heightAt(x: number): number {
    const f = x / this.dx;
    let i = Math.floor(f);
    const last = this.h.length - 1;
    if (i < 0) return this.h[0];
    if (i >= last) return this.h[last];
    const t = f - i;
    return this.h[i] * (1 - t) + this.h[i + 1] * t;
  }

  /** dh/dx */
  slopeAt(x: number): number {
    let i = Math.floor(x / this.dx);
    const last = this.h.length - 1;
    if (i < 0) i = 0;
    if (i >= last) i = last - 1;
    return (this.h[i + 1] - this.h[i]) / this.dx;
  }
}

export function makeTerrain(width: number, seed: number, layout: Layout = LAYOUT): Terrain {
  const dx = 8;
  const n = Math.ceil(width / dx) + 1;
  const h = new Float32Array(n);
  const rng = new Rng(seed);
  // a few low sine bumps, flattened at the home site
  const waves = [0, 1, 2, 3].map(() => ({
    k: rng.range(0.004, 0.02), p: rng.range(0, 6.28), a: rng.range(0.3, 1),
  }));
  for (let i = 0; i < n; i++) {
    const x = i * dx;
    let bump = 0;
    for (const w of waves) bump += Math.sin(x * w.k + w.p) * w.a;
    const flat =
      smooth((x - (layout.home.x0 - 150)) / 150) * (1 - smooth((x - layout.home.x1) / 150));
    bump *= layout.roughness * (1 - flat);
    let y = layout.groundY + bump;
    y += layout.pond.depth * basin(x, layout.pond.x, layout.pond.halfWidth, layout.pond.edge);
    y += layout.ditch.depth * basin(x, layout.ditch.x, layout.ditch.halfWidth, layout.ditch.edge);
    h[i] = y;
  }
  return new Terrain(width, h);
}

/** A featureless floor, for tests and the test bench. */
export function flatTerrain(width: number, y: number): Terrain {
  const n = Math.ceil(width / 8) + 1;
  return new Terrain(width, new Float32Array(n).fill(y));
}

/** A basin with sloped sides, for float tests: floor at y between x0 and x1, banks `depth` higher. */
export function tankTerrain(width: number, x0: number, x1: number, y: number, depth: number): Terrain {
  const n = Math.ceil(width / 8) + 1;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * 8;
    const out = Math.max(x0 - x, x - x1, 0);
    h[i] = y - Math.min(depth, out * 1.2);
  }
  return new Terrain(width, h);
}
