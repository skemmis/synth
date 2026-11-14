// How does the night fare against a given base, and which levers help?  node scripts/siege.ts <base> <seed> [nights] [trials] [wreck] [maxCells] [seconds]
import { spawnRecipe } from '../packages/sim/src/grid.ts'; import { RECIPES } from '../packages/sim/src/recipes.ts'; import { setDown } from '../packages/sim/src/bench.ts';
import { LAYOUT, stripTerrain } from '../packages/sim/src/terrain.ts'; import { World } from '../packages/sim/src/world.ts'; import { M } from '../packages/sim/src/materials.ts';
import { Evolver, makeArena, nightConfig } from '../packages/evo/src/evolve.ts'; import { SEEDS } from '../packages/evo/src/seeds.ts'; import { fitnessConfig, spawnCreature } from '../packages/evo/src/trial.ts'; import { evoConfig, toRecipe } from '../packages/evo/src/genome.ts';
const [base, seed, nights = '6', trials = '200', wreck = '0', maxCells = '26', seconds = '20'] = process.argv.slice(2);
if (process.env.FAMILY) evoConfig.nicheBy = 'family'; fitnessConfig.wreck = +wreck; evoConfig.maxCells = +maxCells; nightConfig.trialSeconds = +seconds;
const STASH_X = LAYOUT.home[1] - 110, WALL_X = LAYOUT.home[1] + 40;
const w = new World(stripTerrain()); spawnRecipe(w, RECIPES.berryStack, STASH_X, w.terrain.groundY(STASH_X) - 32);
const defs: Record<string, string[]> = { wall3: ['WW', 'WW', 'WW'], book: RECIPES.wall.grid, stone: ['SS', 'SS', 'SS', 'SS'], spikes: RECIPES.spikeStrip.grid, glue: ['P'], glue3: ['PPP'], none: [] };
for (const [k, name] of base.split('+').entries()) if (defs[name].length) setDown(w, { name, grid: defs[name] }, WALL_X + k * 70, w.terrain.groundY(WALL_X + k * 70));
if (process.env.WATER) w.spawnWater(LAYOUT.pond[0] + 40, LAYOUT.base + 25, LAYOUT.pond[1] - 40, LAYOUT.base + 135);
for (let i = 0; i < 120; i++) w.step();
const evo = new Evolver(+seed, SEEDS); const t0 = performance.now(); const out: string[] = []; let tag = 1000;
const baseHp = () => { let t = 0, n = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] < 1000 && w.mat[i] !== M.BERRY && w.mat[i] !== M.WATER) { t += Math.max(0, w.hp[i]); n++; } return `${t.toFixed(0)}hp/${n}`; };
console.log('start', baseHp());
// the game's own rhythm: breed against the base as it stands, raid it for real (raiders 8 s apart), survivors leave, the dead stay
for (let n = 0; n < +nights; n++) {
  // a simple defender: every morning clear what is left of the defences and set down this many fresh ones (same kind as at the start)
  if (process.env.REBUILD && n > 0) { for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] < 1000 && w.mat[i] !== M.BERRY && w.mat[i] !== M.WATER) w.removeNode(i);
    const names = base.split('+'); for (let k = 0; k < +process.env.REBUILD; k++) setDown(w, { name: names[0], grid: defs[names[0]] }, WALL_X + k * 70, w.terrain.groundY(WALL_X + k * 70)); for (let i = 0; i < 90; i++) w.step(); }
  if (process.env.GROWCELLS) evoConfig.maxCells = Math.min(60, 26 + +process.env.GROWCELLS * n);
  if (process.env.GROWTRIALS) (globalThis as any).__trials = +trials + +process.env.GROWTRIALS * n;
  if (process.env.ROT) for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] >= 1000) w.removeNode(i);
  w.compact(); const h = evo.runNight(makeArena(w, LAYOUT.home[0] - 200), LAYOUT.burrow - 60, (globalThis as any).__trials ?? +trials); const size = process.env.GROW ? Math.min(7, 3 + Math.floor(n / +process.env.GROW)) : 3; const party = evo.raiders(size); const e0 = w.eaten, b0 = w.count(M.BERRY); const mine: number[] = [];
  for (let t = 0; t < +(process.env.RAID ?? 44) * 60; t++) { if (t % 480 === 0 && t / 480 < party.length) { mine.push(tag); spawnCreature(w, party[t / 480].g, LAYOUT.burrow - 60, tag++); } w.step(); }
  for (const tg of mine) { let live = false; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] === tg && w.mat[i] === M.HEART) live = true; if (live) for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] === tg) w.removeNode(i); }
  out.push(`night ${n + 1}: best ${h.best.toFixed(0)} dream ate ${party[0].result.eaten} | raid ate ${w.eaten - e0}, gone ${b0 - w.count(M.BERRY)} | base ${baseHp()} | ${party.map((p) => `${p.niche}[${p.g.root ?? p.g.name}]`).join(', ')}`);
}
console.log(`${base} seed ${seed} trials ${trials} wreck ${wreck} cells ${maxCells} secs ${seconds} (${((performance.now() - t0) / 1000).toFixed(0)} s)\n` + out.join('\n') + '\n' + toRecipe(evo.raiders(1)[0].g).grid.join('\n'));
