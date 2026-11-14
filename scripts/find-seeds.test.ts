// One-off search for seed crawlers (not part of the test suite: lives in scripts/).
// Run: npx vitest run --dir scripts find-seeds
import { test } from 'vitest';
import { writeFileSync } from 'fs';
import { Rng, World, flatTerrain } from '../src/sim';
import { genomeToText, mutate, randomGenome, spawnCreature, type Genome, cellCount } from '../src/evo/genome';

function crawl(g: Genome, seconds = 15): number {
  const world = new World(flatTerrain(3000, 600), undefined, 128, 512);
  const sp = spawnCreature(world, g, 1500);
  const b = sp.body;
  for (let s = 0; s < 30; s++) world.step();
  const h0 = world.bodyHeart[b];
  if (h0 < 0) return 0;
  const x0 = world.x[h0];
  for (let s = 0; s < seconds * 60; s++) world.step();
  const h1 = world.bodyHeart[b];
  if (h1 < 0) return 0;
  // whole body must still be together: count nodes still attached to the heart
  const attached = world.component(h1).length;
  if (attached < cellCount(g.grid) * 0.8) return 0;
  return (x0 - world.x[h1]) / 12; // node diameters travelled to the left
}

test('find seeds', () => {
  const out: { d: number; g: Genome }[] = [];
  for (let run = 0; run < 5; run++) {
    const rng = new Rng(100 + run);
    let pop = Array.from({ length: 40 }, () => { const g = randomGenome(rng); return { g, d: crawl(g) }; });
    for (let gen = 0; gen < 30; gen++) {
      pop.sort((a, b) => b.d - a.d);
      pop = pop.slice(0, 12);
      const kids = [];
      for (let k = 0; k < 28; k++) { let g = mutate(pop[rng.int(pop.length)].g, rng); if (rng.next() < 0.4) g = mutate(g, rng); kids.push({ g, d: crawl(g) }); }
      pop.push(...kids);
    }
    pop.sort((a, b) => b.d - a.d);
    console.log(`run ${run}: best ${pop[0].d.toFixed(1)} diameters  ${pop[0].g.grid.join('/')}`);
    out.push(pop[0]);
  }
  writeFileSync('scripts/seeds-found.json', out.map((o) => `// ${o.d.toFixed(1)} diameters in 15 s\n${genomeToText(o.g)}`).join('\n'));
}, 1200000);
