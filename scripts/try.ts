import { bucketCarry, ropeSwing, clubHit, pitchStick, stripWorld, run } from '../packages/sim/src/scenarios.ts';
import { RECIPES } from '../packages/sim/src/recipes.ts';
const t0 = performance.now();
const w = stripWorld(); console.log('water', w.n); let t=performance.now(); run(w, 5); console.log('5s pond ms', performance.now()-t, 'steps/s', 300/((performance.now()-t)/1000));
const b = bucketCarry(); console.log('bucket', { ...b, world: undefined });
console.log('rope', ropeSwing());
console.log('thorn', clubHit(RECIPES.thornClub), 'wood', clubHit(RECIPES.woodClub));
console.log('pitch', pitchStick(RECIPES.pitchBlock), 'plain', pitchStick(RECIPES.woodBlock));
console.log('ms', performance.now() - t0);
