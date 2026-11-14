import { parseRecipe, type Recipe } from './grid.ts';
const R = (name: string, grid: string, note?: string): Recipe => ({ ...parseRecipe(grid), name, note });
/** Hand-written starter recipes. Used by tests, the offline synthesizer stub and the toy's paste buttons. */
export const RECIPES: Record<string, Recipe> = {
  bucket: R('bucket', `
...W...
...W...
W..W..W
W..W..W
W..W..W
WWWWWWW`, 'Wood walls block water. The centre post is a rigid handle: it hangs level and can be pushed under.'),
  pail: R('pail', `
..FFF..
.F...F.
W.....W
W.....W
W.....W
WWWWWWW`, 'A fiber loop handle hangs level, but rope cannot push: it floats unless filled from above.'),
  rope: R('rope', 'FFFFFFFFFFFF', 'A fiber chain only resists stretch, so it hangs and swings.'),
  thornClub: R('thorn club', `
.TTT.
TWWWT
.TWT.
..W..
..W..
..W..
..W..`, 'Thorns on the head do damage when swung; the bare wood shaft is the grip.'),
  woodClub: R('wood club', `
.WWW.
WWWWW
.WWW.
..W..
..W..
..W..
..W..`),
  dummy: R('dummy', `
WW
WW
WW
WW
WW`),
  pitchBlock: R('pitch block', `
WWW
WWW
PPP`, 'Pitch along the bottom glues it to whatever it lands on.'),
  woodBlock: R('wood block', `
WWW
WWW
WWW`),
  wall: R('wall', `
WW
WW
WW
WW
WW
PP`),
  raft: R('raft', `
W.......W
WWWWWWWWW`),
  stoneBlock: R('stone block', `
SSS
SSS
SSS`),
  net: R('net', `
WF.F.F.F.FW
..F.F.F.F..`, 'A zigzag of fiber sags between its wood ends and catches what falls in. A solid sheet of fiber cannot fold: the nodes are in each other\'s way.'),
  spikeStrip: R('spike strip', `
T.T.T.T.T
WWWWWWWWW
PPPPPPPPP`),
  berryPile: R('berries', `
B.B.B
.....
B.B.B`),
};
