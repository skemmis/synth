import fs from 'node:fs';
import { swimTest } from '../metrics.js';
const rows = JSON.parse(fs.readFileSync(process.argv[2]));
const maxRate = +process.argv[3] || 0.4, sel = [];
for (const e of rows) { const m = swimTest(e.R, e.atoms, { steps: 18000 }); if (m.fit > 0.3 && m.cyclesPerTime / e.atoms.length < maxRate) sel.push({ ...e, m2: m }); }
sel.sort((a, b) => b.m2.fit - a.m2.fit);
console.log(sel.length, 'pass');
fs.writeFileSync('results/quick.json', JSON.stringify(sel.slice(0, 8).map((e, i) => ({ id: 'q' + i, name: 'slow ' + i + ' ' + e.key, tag: e.stroke + ' ' + e.water + ' ' + e.m2.fit.toFixed(2), blurb: '', rules: e.R, atoms: e.atoms }))));
for (const e of sel.slice(0, 4)) {
  console.log(e.key, e.stroke, e.water, 'speed', e.m2.fit.toFixed(2), 'beats/s', e.m2.cyclesPerTime.toFixed(2), e.atoms.map(a => a.t).join(''));
  const used = [...new Set(e.atoms.map(a => a.t))];
  console.log(' types', used.map(t => t + ':' + JSON.stringify(e.R.types[t], (k, v) => typeof v === 'number' ? +v.toFixed(2) : v)).join(' '), 'g1', e.R.g1.toFixed(2), 'g2', e.R.g2.toFixed(2), 'sh', e.R.shadow.toFixed(2), 'eUnit', e.R.eUnit.toFixed(0));
  for (const i of used) for (const j of used) if (i <= j) { const b = e.R.bond[i][j]; if (b.on) console.log('  bond', i, j, JSON.stringify(b, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), 'a', e.R.pair[i][j].a.toFixed(2)); }
}
