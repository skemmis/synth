// Static heightmap. y grows downward; ground is solid below groundY(x).
export class Terrain {
  dx: number; width: number; height: number; h: Float64Array;
  constructor(width: number, height: number, dx = 16) {
    this.dx = dx; this.width = width; this.height = height;
    this.h = new Float64Array(Math.ceil(width / dx) + 2);
  }
  groundY(x: number): number {
    const f = Math.min(Math.max(x / this.dx, 0), this.h.length - 1.001);
    const i = Math.floor(f), t = f - i;
    return this.h[i] * (1 - t) + this.h[i + 1] * t;
  }
  slope(x: number): number {
    const f = Math.min(Math.max(x / this.dx, 0), this.h.length - 1.001);
    const i = Math.floor(f);
    return (this.h[i + 1] - this.h[i]) / this.dx;
  }
  /** Build from a function of x. */
  static from(width: number, height: number, fn: (x: number) => number, dx = 16): Terrain {
    const t = new Terrain(width, height, dx);
    for (let i = 0; i < t.h.length; i++) t.h[i] = fn(i * dx);
    return t;
  }
  static flat(width: number, height: number, y: number): Terrain { return Terrain.from(width, height, () => y); }
}
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
/** A basin from x0..x1, `depth` deep, with walls `wall` units wide. */
export const basin = (x: number, x0: number, x1: number, depth: number, wall: number) =>
  depth * Math.min(smooth((x - x0) / wall), smooth((x1 - x) / wall));
export const bump = (x: number, c: number, w: number, hgt: number) => hgt * smooth(1 - Math.abs(x - c) / w);

export interface Layout { width: number; height: number; base: number; pond: [number, number]; home: [number, number]; ditch: [number, number]; burrow: number; sources: Record<string, number>; }
/** The proof-of-concept strip: pond, sources, home, ditch, burrow. */
export const LAYOUT: Layout = {
  width: 5120, height: 900, base: 600,
  pond: [140, 760], home: [2500, 3250], ditch: [3420, 3740], burrow: 4700,
  sources: { tree: 1000, outcrop: 1260, vines: 1520, bramble: 1780, resin: 2040, bush: 2300 },
};
export function stripTerrain(L: Layout = LAYOUT): Terrain {
  return Terrain.from(L.width, L.height, (x) => {
    let y = L.base;
    y += basin(x, L.pond[0], L.pond[1], 130, 90);
    y += basin(x, L.ditch[0], L.ditch[1], 80, 60);
    y -= bump(x, 1400, 500, 26) + bump(x, 2050, 300, 14);
    y -= bump(x, L.burrow + 180, 260, 70); // burrow mound
    y -= bump(x, 0, 120, 120); // left wall so the pond cannot drain off-world
    return y;
  });
}
