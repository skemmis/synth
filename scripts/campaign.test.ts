// Balance report: fixed bases, eight nights each, full night budget.
// Run: npx vitest run -c vitest.scripts.config.ts campaign
import { test } from 'vitest';
import { appendFileSync, writeFileSync } from 'fs';
import { EVO_CONFIG, Evolver, LocalPool, SEEDS, makeArena, nicheOf, runNight, runRaid } from '../src/evo';
import { CONFIG, LAYOUT, Mat, World, makeTerrain, pourWater, spawnGrid } from '../src/sim';

const OUT = 'scripts/campaign-report.txt';
const g = (s: string) => s.trim().split('\n').map((l) => l.trim());
const CAGE = g(`WWWWWWWW\nW......W\nW......W\nW......W\nS......S\nS......S`);
const STONE_CAGE = g(`SSSSSSSS\nS......S\nS......S\nS......S\nS......S\nS......S`);
const SPIKES = g(`TTTTTTTTTT\nSSSSSSSSSS`);
const WALL = g(`WWW\nWWW\nWWW\nWWW\nWWW\nWWW\nWWW\nSSSSS`);

function base(kind: string): World {
  const w = new World(makeTerrain(CONFIG.world.width, 1), CONFIG, 1024, 4096);
  const sx = LAYOUT.home.stashX, gy = (x: number) => w.terrain.heightAt(x);
  for (let k = 0; k < 12; k++) w.addNode(Mat.Berry, sx - 20 + (k % 4) * 13, gy(sx) - 7 - Math.floor(k / 4) * 11);
  for (let s = 0; s < 60; s++) w.step();
  const put = (grid: string[], x: number) => spawnGrid(w, grid, x, gy(x) - grid.length * 6 - 1);
  if (kind.includes('cage')) put(CAGE, sx);
  if (kind.includes('vault')) put(STONE_CAGE, sx);
  if (kind.includes('spikes')) { put(SPIKES, sx + 150); put(SPIKES, sx - 150); }
  if (kind.includes('wall')) put(WALL, sx + 260);
  if (kind.includes('moat')) { const d = LAYOUT.ditch; pourWater(w, d.x - d.halfWidth + 10, LAYOUT.groundY + 12, d.x + d.halfWidth - 10, LAYOUT.groundY + d.depth + 4); }
  for (let s = 0; s < 180; s++) w.step();
  return w;
}

test('campaign', async () => {
  writeFileSync(OUT, `Campaign: 8 nights, ${EVO_CONFIG.nightBudgetSteps / (EVO_CONFIG.trialSeconds * 60)} trials a night, 12 berries, no rebuilding between nights\n\n`);
  for (const kind of ['open', 'wall', 'cage', 'cage+spikes', 'moat', 'vault+spikes+moat']) {
    const world = base(kind);
    const evo = new Evolver(4242, SEEDS);
    const pool = new LocalPool();
    const rows: string[] = [];
    for (let night = 1; night <= 8; night++) {
      const t0 = performance.now();
      const elites = await runNight(evo, makeArena(world), pool, { batch: 8 });
      const r = runRaid(world, elites);
      rows.push(`  night ${night}: dream best ${evo.history[night - 1].toFixed(0).padStart(5)}  raid ate ${r.eaten}, ${r.killed} killed, ${r.survivors} home, ${r.berriesLeft} left   [${elites.map((e) => nicheOf(e.genome) + ' ' + e.genome.grid.join('/')).join(' | ')}]  (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
      if (r.berriesLeft === 0) break;
    }
    appendFileSync(OUT, `${kind}\n${rows.join('\n')}\n\n`);
  }
}, 7200000);
