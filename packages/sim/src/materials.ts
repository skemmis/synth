// The single materials data file. The sim, the synthesizer prompt and the UI all read from here.
export interface Material {
  glyph: string;
  name: string;
  source: string;
  blurb: string;
  density: number; // mass = density * (radius/8)^2
  radius: number;
  mode: 'rigid' | 'tension';
  strength: number; // unit weights a bond holds before breaking
  stretch: number; // strain at which the bond breaks (also sets stiffness)
  hardness: number; // divides incoming damage
  hp: number;
  sharpness: number;
  stickiness: number; // 0 or 1
  friction: number;
  actuation: number; // default amplitude of rest-length oscillation
  fluid?: boolean;
  creatureOnly?: boolean;
  inBlueprint: boolean;
  color: string;
  edge: string;
}
const m = (o: Material) => o;
export const MATERIALS: Material[] = [
  m({ glyph: 'W', name: 'wood', source: 'tree', blurb: 'Light (floats), rigid bonds, medium hardness',
    density: 0.6, radius: 8, mode: 'rigid', strength: 400, stretch: 0.1, hardness: 2, hp: 30, sharpness: 0, stickiness: 0, friction: 0.6, actuation: 0, inBlueprint: true, color: '#c8935a', edge: '#7a5230' }),
  m({ glyph: 'S', name: 'stone', source: 'outcrop', blurb: 'Heavy (sinks, crushes), rigid bonds, very hard',
    density: 3, radius: 8, mode: 'rigid', strength: 1500, stretch: 0.06, hardness: 8, hp: 120, sharpness: 0, stickiness: 0, friction: 0.7, actuation: 0, inBlueprint: true, color: '#9aa0a8', edge: '#555b63' }),
  m({ glyph: 'F', name: 'fiber', source: 'vines', blurb: 'Very light; bonds resist stretch only: chains are rope, grids are net, single links are hinges',
    density: 0.25, radius: 8, mode: 'tension', strength: 250, stretch: 0.3, hardness: 1, hp: 12, sharpness: 0, stickiness: 0, friction: 0.5, actuation: 0, inBlueprint: true, color: '#b9d67a', edge: '#6f8f3a' }),
  m({ glyph: 'T', name: 'thorn', source: 'bramble', blurb: 'Sharp: deals damage on contact, scaled by relative speed',
    density: 0.5, radius: 8, mode: 'rigid', strength: 150, stretch: 0.1, hardness: 2, hp: 20, sharpness: 1, stickiness: 0, friction: 0.4, actuation: 0, inBlueprint: true, color: '#b0486a', edge: '#5e1f36' }),
  m({ glyph: 'P', name: 'pitch', source: 'resin tree', blurb: 'Sticky: forms a breakable bond with anything it touches, including the ground',
    density: 0.9, radius: 8, mode: 'rigid', strength: 100, stretch: 0.25, hardness: 1, hp: 20, sharpness: 0, stickiness: 1, friction: 0.9, actuation: 0, inBlueprint: true, color: '#e0a526', edge: '#8a5f0a' }),
  m({ glyph: 'N', name: 'sinew', source: 'creature corpses', blurb: 'Any bond touching it contracts and relaxes rhythmically (the only actuator)',
    density: 0.8, radius: 8, mode: 'rigid', strength: 200, stretch: 0.6, hardness: 1, hp: 15, sharpness: 0, stickiness: 0, friction: 0.8, actuation: 0.25, inBlueprint: true, color: '#e8877f', edge: '#9c4039' }),
  m({ glyph: 'B', name: 'berry', source: 'bush', blurb: 'Food. Soft. What enemies want. Also bait.',
    density: 0.7, radius: 8, mode: 'rigid', strength: 10, stretch: 0.3, hardness: 0.5, hp: 6, sharpness: 0, stickiness: 0, friction: 0.6, actuation: 0, inBlueprint: true, color: '#6b4fd8', edge: '#35237a' }),
  m({ glyph: 'H', name: 'heart', source: 'creatures only', blurb: 'A creature dies when it is destroyed; eats berries on contact',
    density: 0.8, radius: 8, mode: 'rigid', strength: 150, stretch: 0.2, hardness: 1, hp: 25, sharpness: 0, stickiness: 0, friction: 0.6, actuation: 0, creatureOnly: true, inBlueprint: false, color: '#e23b3b', edge: '#7d1212' }),
  m({ glyph: '~', name: 'water', source: 'pond', blurb: 'Fluid particles; cannot appear in a blueprint, must be scooped',
    density: 1, radius: 4.5, mode: 'rigid', strength: 0, stretch: 0, hardness: 1, hp: 1, sharpness: 0, stickiness: 0, friction: 0, actuation: 0, fluid: true, inBlueprint: false, color: '#58b4e8', edge: '#2a78b0' }),
];
export const GLYPH: Record<string, number> = {};
MATERIALS.forEach((mat, i) => (GLYPH[mat.glyph] = i));
export const M = { WOOD: 0, STONE: 1, FIBER: 2, THORN: 3, PITCH: 4, SINEW: 5, BERRY: 6, HEART: 7, WATER: 8 } as const;
export const massOf = (mat: number) => { const t = MATERIALS[mat]; return t.density * (t.radius / 8) ** 2; };
