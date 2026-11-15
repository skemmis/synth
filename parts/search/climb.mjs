// Quick check: can a float keep a swimmer pointed up so it climbs? Pond with gravity, 60 s, height gained.
import fs from 'node:fs';
import { Parts, BEAD, JITTER, FLOAT, SPRING, ROD, ROPE } from '../sim.js';
const params = JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url)));
// worm drawn pointing up the screen (its head is the first bead; it swims head first)
const wormUp = (flip) => ({ atoms: [[BEAD, 0, 0], [JITTER, 0, 1.2 * flip], [JITTER, 0, 2.4 * flip], [BEAD, 0, 3.6 * flip]], links: [[0, 1, SPRING], [1, 2, SPRING], [2, 3, SPRING]] });
const withFloat = (b, at, link, dy) => ({ atoms: [...b.atoms, [FLOAT, b.atoms[at][1], b.atoms[at][2] + dy]], links: [...b.links, [at, b.atoms.length, link]] });
const V = {};
for (const flip of [1, -1]) { const w = wormUp(flip), top = flip === 1 ? 0 : 3, tag = flip === 1 ? 'head-up' : 'tail-up';
  V[`worm ${tag}, no float`] = w;
  for (const [ln, l] of [['rod', ROD], ['rope', ROPE], ['spring', SPRING]]) V[`worm ${tag}, float on ${ln} above top`] = withFloat(w, top, l, -1.2); }
export function climb(build, g = 0.1, secs = 60) { const w = new Parts({ ...params, gravity: g }, { W: 48, H: 30, cap: 64 }); w.load(build, 24, 24); const n = w.n; const y = () => { let s = 0; for (let i = 0; i < n; i++) s += w.y[i]; return s / n; };
  const a = y(); let best = a; for (let s = 0; s < secs / w.p.dt; s++) { w.step(); if ((s & 63) === 0) best = Math.min(best, y()); } return { end: a - y(), peak: a - best, links: w.nb }; }
if (process.argv[1].endsWith('climb.mjs')) for (const [name, b] of Object.entries(V)) { const r = climb(b); console.log(name.padEnd(42), 'height gained', r.end.toFixed(1).padStart(5), 'peak', r.peak.toFixed(1).padStart(5)); }
