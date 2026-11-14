// The single source of truth for materials. The simulation, the synthesizer
// prompt and the UI are all generated from this table. One row per material.

export type BondMode = 'rigid' | 'tension';

export interface Material {
  id: number;
  glyph: string;
  name: string;
  source: string;
  /** mass per node (relative). Water is 1.0: below floats, above sinks. */
  density: number;
  /** radius in world units */
  radius: number;
  /** 0..1, how hard a bond pulls back per solver pass */
  bondStiffness: number;
  bondMode: BondMode;
  /** 0..1: resistance to bending. The middle of a straight run of three braced cells
   *  is held at the midpoint of its ends, so a one-cell-thick stick is a stick and not a chain. */
  brace: number;
  /** strain (fraction of rest length) at which a bond snaps */
  tensile: number;
  /** subtracted from incoming damage */
  hardness: number;
  hitPoints: number;
  /** contact damage per unit of relative speed */
  sharpness: number;
  /** max number of sticky bonds this node will form on touch */
  stickiness: number;
  friction: number;
  /** amplitude of rhythmic rest-length change for bonds touching it */
  actuation: number;
  /** may appear in a player blueprint */
  blueprint: boolean;
  /** may only appear in creatures */
  creatureOnly: boolean;
  color: string;
  useful: string;
}

export const NODE_RADIUS = 6;

const row = (
  id: number, glyph: string, name: string, source: string,
  density: number, radius: number, bondStiffness: number, bondMode: BondMode, brace: number,
  tensile: number, hardness: number, hitPoints: number, sharpness: number,
  stickiness: number, friction: number, actuation: number,
  blueprint: boolean, creatureOnly: boolean, color: string, useful: string,
): Material => ({
  id, glyph, name, source, density, radius, bondStiffness, bondMode, brace, tensile,
  hardness, hitPoints, sharpness, stickiness, friction, actuation, blueprint,
  creatureOnly, color, useful,
});

//                 id g    name     source            dens rad  stiff mode      tens  hard hp  sharp stick fric act
export const MATERIALS: Material[] = [
  row(0, 'W', 'Wood', 'Tree', 0.6, 6, 0.9, 'rigid', 0.9, 0.3, 3, 30, 0, 0, 0.6, 0, true, false, '#c9965a',
    'Light (floats), rigid bonds, medium hardness'),
  row(1, 'S', 'Stone', 'Outcrop', 3.0, 6, 1.0, 'rigid', 1, 0.2, 10, 80, 0, 0, 0.8, 0, true, false, '#8d93a0',
    'Heavy (sinks, crushes), rigid bonds, very hard'),
  row(2, 'F', 'Fiber', 'Vines', 0.3, 6, 1.0, 'tension', 0, 0.6, 1, 12, 0, 0, 0.5, 0, true, false, '#9fc56a',
    'Very light; bonds resist stretch only, so chains act as rope, grids as net, single links as hinges'),
  row(3, 'T', 'Thorn', 'Bramble', 0.5, 6, 0.9, 'rigid', 0.9, 0.25, 2, 14, 1.0, 0, 0.4, 0, true, false, '#7a3d58',
    'Sharp: deals damage on contact, scaled by relative speed'),
  row(4, 'P', 'Pitch', 'Resin tree', 1.2, 6, 0.35, 'rigid', 0.3, 0.5, 1, 14, 0, 3, 1.0, 0, true, false, '#3c3430',
    'Sticky: forms a breakable bond with anything it touches, including the ground'),
  row(5, 'N', 'Sinew', 'Creature corpses only', 0.9, 6, 0.8, 'rigid', 0, 0.6, 1, 12, 0, 0, 0.7, 0.28, true, false, '#e0736d',
    'Any bond touching it contracts and relaxes rhythmically (the only actuator)'),
  row(6, 'B', 'Berry', 'Bush', 0.8, 6, 0.3, 'rigid', 0, 0.5, 0.5, 5, 0, 0, 0.7, 0, true, false, '#d6336c',
    'Food. Soft. What enemies want. Also bait'),
  row(7, 'H', 'Heart', 'Creatures only', 1.0, 6, 0.8, 'rigid', 0.6, 0.5, 1, 10, 0, 0, 0.6, 0, false, true, '#ff5d5d',
    'A creature dies when it is destroyed; eats berries on contact'),
  row(8, '~', 'Water', 'Pond', 1.0, 3.6, 0, 'rigid', 0, 0, 0, 1, 0, 0, 0, 0, false, false, '#5aa9e6',
    'Fluid particles; cannot appear in a blueprint, must be scooped'),
];

export const Mat = {
  Wood: 0, Stone: 1, Fiber: 2, Thorn: 3, Pitch: 4, Sinew: 5, Berry: 6, Heart: 7, Water: 8,
} as const;

export const GLYPH_TO_MAT: Record<string, number> = Object.fromEntries(
  MATERIALS.map((m) => [m.glyph, m.id]),
);

export const BLUEPRINT_GLYPHS = MATERIALS.filter((m) => m.blueprint).map((m) => m.glyph);
export const CREATURE_GLYPHS = MATERIALS.filter((m) => m.blueprint || m.creatureOnly)
  .filter((m) => m.id !== Mat.Berry).map((m) => m.glyph);
