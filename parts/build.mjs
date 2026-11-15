// Build the single-file sandbox. Usage: node build.mjs [--page] <out.html>
import fs from 'node:fs';
import path from 'node:path';
import { BEAD, JITTER, STICKY, ROD, SPRING, ROPE, FUSE } from './sim.js';
import { BUILDS } from './search/try.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const page = process.argv.includes('--page'), out = process.argv.filter(a => !a.startsWith('--'))[2];
const params = JSON.parse(fs.readFileSync(path.join(here, 'params.json'), 'utf8'));
const hex = (kind, link) => { const atoms = [[kind, 0, 0]], links = []; for (let k = 0; k < 6; k++) { atoms.push([kind, 1.05 * Math.cos(k * Math.PI / 3), 1.05 * Math.sin(k * Math.PI / 3)]); links.push([0, k + 1, link]); links.push([k + 1, (k + 1) % 6 + 1, link]); } return { atoms, links }; };
const paper = (() => { const atoms = [], links = []; for (let k = 0; k < 9; k++) { atoms.push([k % 2 ? STICKY : BEAD, 0, (k - 4) * 1.3]); if (k) links.push([k - 1, k, ROPE]); } return { atoms, links }; })();
const merge = (a, b, dx, dy) => ({ atoms: [...a.atoms, ...b.atoms.map(q => [q[0], q[1] + dx, q[2] + dy])], links: [...a.links, ...b.links.map(l => [l[0] + a.atoms.length, l[1] + a.atoms.length, l[2]])] });
const STARTERS = [
  { id: 'worm', name: 'Worm', build: BUILDS.worm, x: 10, y: 15, tip: 'Two jitters on springs with a bead at each end. They fire one after the other, and that is enough to swim.' },
  { id: 'tadpole', name: 'Tadpole', build: BUILDS.tadpole, x: 24, y: 8, tip: 'A solid triangle of rods. One corner is a jitter, tugging a bead on a spring.' },
  { id: 'ladder', name: 'Ladder', build: BUILDS.ladder, x: 20, y: 12, tip: 'Rods on one side, springs with jitters on the other. A first try at something that bends.' },
  { id: 'bomb', name: 'Fuse cluster', build: hex(BEAD, FUSE), pellets: 0, tip: 'Seven beads held by fuses. Nothing happens until you pick Grab and yank one.' },
  { id: 'paper', name: 'Flypaper', build: merge(paper, BUILDS.worm, -14, 0), x: 30, y: 15, pellets: 0, tip: 'A rope strung with sticky atoms, and a worm heading for it.' },
  { id: 'empty', name: 'Empty pond', run: false, tip: 'Empty pond, paused. Place a few atoms, then press Run.' },
];
const sim = fs.readFileSync(path.join(here, 'sim.js'), 'utf8').replace(/^export /gm, '');
let html = fs.readFileSync(path.join(here, 'template.html'), 'utf8').replace('/*SIM*/', () => sim).replace('/*PARAMS*/{}', () => JSON.stringify(params)).replace('/*STARTERS*/[]', () => JSON.stringify(STARTERS));
if (page) html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>';
fs.writeFileSync(out, html); console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
