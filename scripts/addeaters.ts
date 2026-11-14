// Append chosen berry-eaters (from scripts/eatseeds.ts) to the seed list.
import fs from 'fs'; import { SEEDS } from '../packages/evo/src/seeds.ts';
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const names: Record<string, string> = { 'seed22.json': 'Nibbler', 'seed24.json': 'Thornback', 'seed26.json': 'Lasher' };
const round = (g: any) => ({ grid: g.grid, freq: Math.round(g.freq * 100) / 100, cells: Object.fromEntries(Object.entries(g.cells).map(([k, v]: any) => [k, { phase: Math.round(v.phase * 100) / 100, amp: Math.round(v.amp * 100) / 100 }])) });
const all = [...SEEDS.filter((s: any) => !Object.values(names).includes(s.name)), ...list.filter((e: any) => names[e.from]).map((e: any) => ({ ...round(e.g), name: names[e.from] }))];
const head = fs.readFileSync('packages/evo/src/seeds.ts', 'utf8').split('export const SEEDS')[0];
fs.writeFileSync('packages/evo/src/seeds.ts', head + 'export const SEEDS: Genome[] = ' + JSON.stringify(all, null, 1) + ';\n');
