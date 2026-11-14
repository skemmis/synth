import type { Recipe } from '../sim';

const r = (name: string, note: string, grid: string): Recipe => ({
  name, note, grid: grid.trim().split('\n').map((l) => l.trim()),
});

/** Starter recipes. Plain grids; nothing here is special to the simulation. */
export const PRESETS: Recipe[] = [
  r('Bucket', 'A wooden U. Wood blocks water, so it holds what you scoop.', `
    W.....W
    W.....W
    W.....W
    W.....W
    WWWWWWW`),
  r('Pail with handle', 'A fiber bail lets it hang level from the hand.', `
    ..FFF..
    .F...F.
    W.....W
    W.....W
    W.....W
    WWWWWWW`),
  r('Rope', 'Fiber only resists stretch: a chain of it is rope.', `FFFFFFFFFFFFFF`),
  r('Thorn club', 'A stick with a sharp head. Hurts what it hits, scaled by speed.', `
    WWWWWWT
    ......T`),
  r('Plank', 'A plain wooden stick.', `WWWWWWWWWW`),
  r('Stone block', 'Heavy. Sinks, and crushes what it lands on.', `
    SSS
    SSS`),
  r('Sticky foot', 'Pitch bonds to whatever it touches, including the ground.', `
    WWW
    WWW
    PPP`),
  r('Raft', 'Wood is lighter than water.', `
    W.......W
    WWWWWWWWW`),
  r('Net', 'A grid of fiber: slack until pulled tight.', `
    WFFFFFFW
    .FFFFFF.
    .FFFFFF.`),
  r('Flail', 'A rope hinge between handle and head.', `WWWWFFFSS`),
  r('Spike strip', 'Lay it where something will walk.', `
    TTTTTTTT
    WWWWWWWW`),
  r('Wall', 'Three thick so it stands.', `
    WWW
    WWW
    WWW
    WWW
    WWW
    WWW
    SSS`),
];
