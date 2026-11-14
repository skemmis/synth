import fs from 'fs';
import { SCRIPTED } from '../packages/synth/src/purpose.ts';
import { buildPrompt } from '../packages/synth/src/prompt.ts';
const out = process.argv[2];
for (const s of SCRIPTED) fs.writeFileSync(`${out}/${s.key.replace(' ', '-')}.prompt.txt`, buildPrompt({ message: s.request, history: [], draft: null, inventory: { W: 40, S: 12, F: 20, T: 10, P: 8, B: 6 }, style: 'literal' }));
