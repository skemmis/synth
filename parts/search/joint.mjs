// Joint search: tune the hidden numbers so that what a person can build is as lively as possible.
// A candidate set of numbers is scored by (a) how well four plain hand builds swim, (b) the best long,
// bending swimmer a short build search can find under it, (c) the fastest build of any shape, and
// (d) whether a fuse cluster sits quiet when left alone and goes off when flicked.
// Usage: node search/joint.mjs <seed> <candidates> <out.json> [buildEvals]
import fs from 'node:fs';
import { DEFAULTS, Parts, rng32, BEAD, FUSE } from '../sim.js';
import { travel, BUILDS } from './try.mjs';
import { runSearch } from './builds.mjs';
const seed = +process.argv[2] || 1, CANDS = +process.argv[3] || 50, out = process.argv[4] || `rounds/joint-${seed}.json`, BE = +process.argv[5] || 5000;
const r = rng32(seed * 31337 + 7);
const base = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url))) };
const prior = JSON.parse(fs.readFileSync(new URL('../seeds.json', import.meta.url)));
const KNOBS = [['g1', -1, 0.08, 1, 1], ['g2', -1, 0.05, 1.5, 1], ['shadow', -1, 0.3, 0.95, 0], ['mass', 0, 0.5, 3, 1], ['mass', 1, 0.5, 3, 1], ['mass', 2, 0.5, 3, 1], ['drag', 0, 0.3, 3, 1], ['drag', 1, 0.3, 3, 1], ['drag', 2, 0.3, 3, 1],
  ['k', 1, 8, 120, 1], ['k', 2, 40, 300, 1], ['damp', 1, 0, 3, 0], ['jitHz', -1, 0.7, 2.2, 1], ['jitForce', -1, 10, 150, 1], ['jitDuty', -1, 0.05, 0.5, 0], ['jitLag', -1, 0.05, 0.5, 0], ['fuseKick', -1, 6, 30, 1]];
const get = (p, k) => k[1] < 0 ? p[k[0]] : p[k[0]][k[1]];
const set = (p, k, v) => { if (k[1] < 0) p[k[0]] = v; else { p[k[0]] = [...p[k[0]]]; p[k[0]][k[1]] = v; } };
function bomb(p) {
  const w = new Parts(p, { W: 48, H: 30 }); w.add(BEAD, 24, 15); for (let k = 0; k < 6; k++) w.add(BEAD, 24 + 1.05 * Math.cos(k * Math.PI / 3), 15 + 1.05 * Math.sin(k * Math.PI / 3));
  for (let k = 0; k < 6; k++) { w.link(0, k + 1, FUSE); w.link(k + 1, (k + 1) % 6 + 1, FUSE); }
  for (let s = 0; s < 200; s++) w.step(); const quiet = w.stat.snapped; w.vx[1] += 12; for (let s = 0; s < 300; s++) w.step();
  return { quiet, chain: w.stat.snapped, cap: w.stat.capHits };
}
function score(p, tag) {
  let g = 0; const names = Object.keys(BUILDS), hand = {};
  for (const n of names) { const t = travel(BUILDS[n], p, 40); if (t.cap || t.links < BUILDS[n].links.length) return null; hand[n] = +t.speed.toFixed(3); g += Math.log(t.speed + 0.01); }
  const handG = Math.exp(g / names.length), bm = bomb(p), bombOk = bm.quiet === 0 && bm.chain >= 10 && !bm.cap;
  const arch = runSearch(p, seed * 1000 + tag, BE, prior);
  if (!arch.length) return null;
  const benders = arch.filter(e => e.m.aspect >= 2.5 && e.m.bendAmp >= 0.25), bender = benders.length ? benders[0].f : 0;
  const f = Math.pow(handG + 0.01, 0.3) * Math.pow(bender + 0.01, 0.5) * Math.pow(arch[0].f + 0.01, 0.2) * (bombOk ? 1 : 0.3);
  return { f, handG, hand, bender, benders: benders.length, top: arch[0].f, bomb: bm, arch };
}
const t0 = Date.now(); fs.mkdirSync(new URL('../rounds/', import.meta.url), { recursive: true });
let best = base, bs = score(best, 0);
const save = (i) => fs.writeFileSync(out, JSON.stringify({ seed, candidates: i, f: bs.f, handG: bs.handG, hand: bs.hand, bender: bs.bender, benders: bs.benders, top: bs.top, bomb: bs.bomb, params: best, elites: bs.arch.slice(0, 40) }));
console.log(`seed ${seed} start f ${bs.f.toFixed(3)} hand ${bs.handG.toFixed(2)} bender ${bs.bender.toFixed(2)} top ${bs.top.toFixed(2)}`); save(0);
for (let i = 1; i <= CANDS; i++) {
  const p = { ...best }, nm = 1 + Math.floor(r() * 3);
  for (let m = 0; m < nm; m++) { const k = KNOBS[Math.floor(r() * KNOBS.length)], v = get(p, k), g = (r() + r() + r() - 1.5) * 0.5;
    const nv = k[4] ? Math.exp(Math.log(v) + g * Math.log(k[3] / k[2]) * 0.5) : v + g * (k[3] - k[2]) * 0.5; set(p, k, Math.min(k[3], Math.max(k[2], nv))); }
  // every candidate is scored with the same build-search seed, so better numbers win and luck does not
  const s = score(p, 0);
  if (s && s.f > bs.f) { best = p; bs = s; save(i); console.log(`seed ${seed} cand ${i} f ${s.f.toFixed(3)} hand ${s.handG.toFixed(2)} bender ${s.bender.toFixed(2)} (${s.benders}) top ${s.top.toFixed(2)} bomb ${s.bomb.chain} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
}
save(CANDS); console.log(`seed ${seed} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
