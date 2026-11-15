import fs from 'node:fs';
const all = []; for (const f of process.argv.slice(3)) all.push(...JSON.parse(fs.readFileSync(f)));
all.sort((a, b) => b.f - a.f);
const n = +process.argv[2];
fs.writeFileSync('results/quick.json', JSON.stringify(all.slice(0, n).map((e, i) => ({ id: 'q' + i, name: 'Elite ' + i + ' ' + e.key, tag: 'speed ' + e.f.toFixed(2), blurb: JSON.stringify(e.m), rules: e.R, atoms: e.atoms }))));
