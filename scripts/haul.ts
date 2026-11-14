// Can a container carry crop home? Put logs inside, pull it 1500 units by its handle with the hand, count what arrives.
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts'; import { stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts'; import { M } from '../packages/sim/src/materials.ts';
const CRATES: Record<string, { grid: string[]; logs: [string[], number, number][]; grab: [number, number] }> = {
  bucket2: { grid: RECIPES.bucket.grid, logs: [[['W', 'W'], -24, 10], [['W', 'W'], 24, 10], [['W', 'W'], -40, 10], [['W', 'W'], 40, 10]], grab: [0, -40] },
  pail3: { grid: RECIPES.pail.grid, logs: [[['WWW'], 0, 24], [['WWW'], 0, 8], [['WWW'], 0, -8]], grab: [0, -40] },
  basket: { grid: ['...F...', '..F.F..', '.F...F.', 'W.....W', 'W.....W', 'WWWWWWW'], logs: [[['WWW'], 0, 24], [['WWW'], 0, 8], [['WWW'], 0, -8], [['WWW'], 0, -24]], grab: [0, -40] },
};
for (const speed of [200, 400]) for (const [name, c] of Object.entries(CRATES)) {
  const w = new World(stripTerrain()); const X0 = 1070, y0 = w.terrain.groundY(X0) - 60; const s = spawnRecipe(w, { name, grid: c.grid }, X0, y0, { tag: 5 });
  for (let i = 0; i < 60; i++) w.step(); const cy = s.nodes.reduce((t, i) => t + w.y[i], 0) / s.nodes.length;
  for (const [g, dx, dy] of c.logs) spawnRecipe(w, { name: 'log', grid: g }, X0 + dx, cy + dy, { tag: 6 }); for (let i = 0; i < 90; i++) w.step();
  const top = s.nodes.reduce((a, i) => (w.y[i] < w.y[a] ? i : a), s.nodes[0]); w.grab(top, w.x[top], w.y[top]);
  let hx = w.x[top], hy = w.y[top]; const logs0 = w.count(M.WOOD);
  for (let t = 0; t < 60 * 60 && hx < 2700; t++) { if (hy > 430) hy -= 2; else hx += speed / 60; w.hand.x = hx; w.hand.y = Math.min(hy, w.terrain.groundY(hx) - 150); w.step(); }
  for (let i = 0; i < 60; i++) { w.hand.y += 1.5; w.step(); } w.release(); for (let i = 0; i < 120; i++) w.step();
  let home = 0, total = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] === 6) { total++; if (w.x[i] > 2460 && w.x[i] < 3390) home++; }
  console.log(`${name} at ${speed}/s: ${home} of ${total} log nodes reached home; crate intact ${s.nodes.every((i) => w.alive[i])}; crate x ${Math.round(w.x[top])}`);
}
