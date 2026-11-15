import fs from 'node:fs';
import { forage } from './forage.mjs';
import { BUILDS } from './try.mjs';
const params = JSON.parse(fs.readFileSync(new URL('../params.json', import.meta.url))), found = JSON.parse(fs.readFileSync(new URL('../found.json', import.meta.url)));
for (const [n, b] of [...Object.entries(BUILDS), ...Object.entries(found).map(([k, v]) => [k, v.build])]) { const m = forage(b, params); console.log(n.padEnd(8), m ? `eats ${m.eaten} of 40, still running in ${m.alive * 2} of 2 ponds` : 'broke'); }
