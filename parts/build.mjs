// Build the single-file sandbox. Usage: node build.mjs [--page] <out.html>
import fs from 'node:fs';
import path from 'node:path';
import { BEAD, JITTER, STICKY, ROCK, PELLET, FLOAT, ROD, SPRING, ROPE, FUSE } from './sim.js';
import { BUILDS } from './search/try.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const page = process.argv.includes('--page'), out = process.argv.filter(a => !a.startsWith('--'))[2];
const params = JSON.parse(fs.readFileSync(path.join(here, 'params.json'), 'utf8'));
const hex = (kind, link) => { const atoms = [[kind, 0, 0]], links = []; for (let k = 0; k < 6; k++) { atoms.push([kind, 1.05 * Math.cos(k * Math.PI / 3), 1.05 * Math.sin(k * Math.PI / 3)]); links.push([0, k + 1, link]); links.push([k + 1, (k + 1) % 6 + 1, link]); } return { atoms, links }; };
const paper = (() => { const atoms = [], links = []; for (let k = 0; k < 9; k++) { atoms.push([k % 2 ? STICKY : BEAD, 0, (k - 4) * 1.3]); if (k) links.push([k - 1, k, ROPE]); } return { atoms, links }; })();
const merge = (a, b, dx, dy) => ({ atoms: [...a.atoms, ...b.atoms.map(q => [q[0], q[1] + dx, q[2] + dy])], links: [...a.links, ...b.links.map(l => [l[0] + a.atoms.length, l[1] + a.atoms.length, l[2]])] });
const found = JSON.parse(fs.readFileSync(path.join(here, 'found.json'), 'utf8'));
// terrain: a few posts and a short wall, positions in pond units (48 x 30)
const POSTS = [[8, 29.4], [9, 29.4], [20, 20], [21, 20], [22, 20], [34, 14], [35, 14], [40, 29.4]];
const WALL = [...Array(6)].map((_, k) => [28, 24 + k]);
// a rod triangle with a float on top: rises slowly and stays upright
const buoy = { atoms: [[BEAD, 0, 0], [BEAD, 1, 0], [BEAD, 0.5, 0.87], [FLOAT, 0.5, -0.9]], links: [[0, 1, ROD], [1, 2, ROD], [0, 2, ROD], [3, 0, ROD], [3, 1, ROD]] };
// a spring cradle between two rocks with a loose bead resting in it
const sling = { atoms: [[ROCK, 0, -3.2], [ROCK, 0, 3.2], [BEAD, 0.5, 0], [JITTER, 1.6, 0]], links: [[0, 2, SPRING], [1, 2, SPRING], [2, 3, FUSE]] };
// a worm on a rope leash from a rock
const leash = (() => { const w = BUILDS.worm; return { atoms: [[ROCK, 0, 0], ...w.atoms.map(q => [q[0], q[1] + 3.2, q[2]])], links: [[0, 1, ROPE], ...w.links.map(l => [l[0] + 1, l[1] + 1, l[2]])] }; })();
const STARTERS = [
  { id: 'posts', name: 'Pond with posts', rocks: [...POSTS, ...WALL], run: false, tool: 'build', pellets: 20, tip: 'Things sink slowly, and the rich pellets are up top. Build up from a rock or a ledge, or hang a float on your build. The water holds still until you press Run.' },
  { id: 'buoy', name: 'Buoy', build: buoy, x: 14, y: 26, pellets: 20, tip: 'Three beads and one float. It rises slowly and stays upright. It has no jitter, so it cannot eat. What would you add?' },
  { id: 'leash', name: 'Worm on a leash', build: leash, x: 24, y: 15, pellets: 40, tip: 'The worm from before, roped to a rock. It can only circle, so it sweeps the pellets near its post.' },
  { id: 'worm', name: 'Worm', build: BUILDS.worm, x: 10, y: 15, tip: 'Two jitters on springs with a bead at each end. They fire one after the other, and that is enough to swim.' },
  { id: 'tadpole', name: 'Tadpole', build: BUILDS.tadpole, x: 24, y: 8, tip: 'A solid triangle of rods. One corner is a jitter, tugging a bead on a spring.' },
  { id: 'ladder', name: 'Ladder', build: BUILDS.ladder, x: 20, y: 12, tip: 'Rods on one side, springs with jitters on the other. A first try at something that bends.' },
  { id: 'whip', name: 'Whip (found)', build: found.whip.build, x: 12, y: 15, tip: `Found by the search, not designed: ${found.whip.n} atoms that bend as they swim. It uses spring, rope and rod together.` },
  { id: 'eel', name: 'Eel (found)', build: found.eel.build, x: 12, y: 10, tip: `Another search find: ${found.eel.n} atoms, the bendiest swimmer so far.` },
  { id: 'dart', name: 'Dart (found)', build: found.dart.build, x: 12, y: 20, tip: `The fastest build the search found with these parts: ${found.dart.n} atoms in a line.` },
  { id: 'burster', name: 'Burster (found)', build: found.burster.build, x: 10, y: 15, pellets: 40, tip: `The search was asked for pellets eaten, not speed. Its answer blows itself apart: fuses fling the jitters across the pond and each eats what it hits. ${found.burster.eats} of 40 pellets in 90 s.` },
  { id: 'grazer', name: 'Grazer (found)', build: found.grazer.build, x: 10, y: 15, pellets: 40, tip: `The best pellet eater with no fuses: ${found.grazer.n} atoms, ${found.grazer.eats} of 40 pellets in 90 s.` },
  { id: 'nibbler', name: 'Nibbler (found)', build: found.nibbler.build, x: 10, y: 15, pellets: 40, tip: `The best five-atom pellet eater: ${found.nibbler.eats} of 40 in 90 s.` },
  { id: 'bomb', name: 'Fuse cluster', build: hex(BEAD, FUSE), pellets: 0, tip: 'Seven beads held by fuses. Nothing happens until you pick Grab and yank one.' },
  { id: 'paper', name: 'Flypaper', build: merge(paper, BUILDS.worm, -14, 0), x: 30, y: 15, pellets: 0, tip: 'A rope strung with sticky atoms, and a worm heading for it.' },
  { id: 'empty', name: 'Empty pond', run: false, tool: 'build', tip: 'Empty pond, water held still. Place a few atoms, then press Run.' },
];
const sim = fs.readFileSync(path.join(here, 'sim.js'), 'utf8').replace(/^export /gm, '');
let html = fs.readFileSync(path.join(here, 'template.html'), 'utf8').replace('/*SIM*/', () => sim).replace('/*PARAMS*/{}', () => JSON.stringify(params)).replace('/*STARTERS*/[]', () => JSON.stringify(STARTERS));
if (page) html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>';
fs.writeFileSync(out, html); console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
