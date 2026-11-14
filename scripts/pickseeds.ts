import fs from 'fs';
import { toRecipe, nicheOf } from '../packages/evo/src/genome.ts';
for (const f of fs.readdirSync(process.argv[2])) { const s = JSON.parse(fs.readFileSync(process.argv[2] + '/' + f, 'utf8')); console.log(`\nseed ${s.seed} ${nicheOf(s.g)} worst-of-3 ${s.dx} freq ${s.g.freq}\n${toRecipe(s.g).grid.join('\n')}`); }
