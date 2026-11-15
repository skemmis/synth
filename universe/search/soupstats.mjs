import fs from 'node:fs';
const rows = []; for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').trim().split('\n')) rows.push(JSON.parse(l));
function cls(m) {
  if (!m || m.bad || m.capHits > 0) return 'violent';
  if (m.temp > 3 * m.bathT + 0.3) return 'boiling';
  if (m.clusterFrac < 0.3) return 'gas';
  if (m.persist > 0.97 && m.turnover < 0.05) return m.bigFrac > 0.5 ? 'one frozen lump' : 'frozen clusters';
  if (m.turnover >= 0.05 && m.persist > 0.6) return 'living clusters';
  if (m.persist <= 0.6) return 'liquid';
  return 'slow clusters';
}
const tab = {}; const kinds = (o) => o.opts.bonds === false ? (o.opts.nonrecip ? 'forces, one-sided' : 'forces only') : 'bonds';
for (const o of rows) { const c = cls(o.m), k = kinds(o); o.cls = c; tab[k] = tab[k] || {}; tab[k][c] = (tab[k][c] || 0) + 1; tab[k].n = (tab[k].n || 0) + 1; }
for (const k in tab) console.log(k.padEnd(18), Object.entries(tab[k]).map(([a, b]) => a + ' ' + (a === 'n' ? b : (100 * b / tab[k].n).toFixed(0) + '%')).join(', '));
const ok = rows.filter(o => o.cls !== 'violent' && o.cls !== 'boiling');
const pct = (f, set = ok) => (100 * set.filter(f).length / set.length).toFixed(1) + '%';
for (const k of ['bonds', 'forces only', 'forces, one-sided']) { const s = ok.filter(o => kinds(o) === k);
  console.log(k, 'compartments>=1', pct(o => o.m.voids >= 1, s), '>=3', pct(o => o.m.voids >= 3, s), 'movers>=1', pct(o => o.m.movers >= 1, s), 'movers>=3', pct(o => o.m.movers >= 3, s), 'loops>20', pct(o => o.m.loops > 20, s)); }
console.log('by K (bonds): compartments / movers');
for (let K = 1; K <= 6; K++) { const s = ok.filter(o => o.R.K === K && kinds(o) === 'bonds'); console.log(K, s.length, pct(o => o.m.voids >= 1, s), pct(o => o.m.movers >= 1, s), 'living', pct(o => o.cls === 'living clusters', s)); }
const sc = (o) => o.m.voids * 2 + o.m.movers * 3 + (o.cls === 'living clusters' ? 2 : 0);
ok.sort((a, b) => sc(b) - sc(a));
for (const o of ok.slice(0, 15)) console.log(o.seed, o.i, kinds(o), 'K', o.R.K, o.cls, 'voids', o.m.voids, o.m.voidArea.toFixed(0), 'movers', o.m.movers, o.m.topDrift.toFixed(2), 'temp', o.m.temp.toFixed(2), o.m.bathT.toFixed(2), 'water', o.R.g2 > 0 ? 'splash' : '', o.R.shadow > 0 ? 'slip' : '');
fs.writeFileSync('results/soup-top.json', JSON.stringify(ok.slice(0, 60)));
