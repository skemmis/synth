// Run the ten scripted requests through a provider and the physical tests. Usage: gate2.ts [fixture.json]
import fs from 'fs';
import { SCRIPTED, judge } from '../packages/synth/src/purpose.ts';
import { stubProvider } from '../packages/synth/src/stub.ts';
import { parseBlueprint } from '../packages/synth/src/validate.ts';
const fixture = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
let valid = 0, pass = 0;
for (const s of SCRIPTED) {
  const raw = fixture ? fixture[s.key] : await stubProvider({ message: s.request, history: [], draft: null, inventory: {} });
  const p = parseBlueprint(raw);
  if (!p.ok) { console.log(`${s.key}: INVALID ${p.errors.join(' ')}`); continue; }
  valid++; const j = judge(s.key, p.recipe!); if (j.pass) pass++;
  console.log(`${s.key}: ${j.pass ? 'PASS' : 'FAIL'} (${j.detail})\n${p.recipe!.grid.join('\n')}`);
}
console.log(`\nvalid ${valid}/10, physically pass ${pass}/10`);
