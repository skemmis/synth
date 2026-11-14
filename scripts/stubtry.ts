import { stubProvider } from '../packages/synth/src/stub.ts';
import { validateRecipe } from '../packages/sim/src/grid.ts';
let draft: any = null; const inv = { W: 30, T: 10 };
for (const m of ['I need a sword', 'The edges need to be lined with something that will kill hamsterbots', 'I need to be able to hold it', 'make it heavier', 'I need a bucket to move this water', 'a tall wall', 'something to frob the wug']) {
  const b = await stubProvider({ message: m, history: [], draft, inventory: inv });
  draft = { name: b.name, grid: b.grid }; console.log(`\n> ${m}\n${b.name}: ${b.note} ${b.question ?? ''}\n${b.grid.join('\n')}`, validateRecipe(draft).ok);
}
