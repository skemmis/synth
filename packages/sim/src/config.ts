// Every tunable number for the simulation lives here or in materials.ts.
export const config = {
  dt: 1 / 60,
  substeps: 8,
  bondIterations: 2, // bond passes per substep; more is stiffer
  gravity: 900, // world units / s^2 (a node is 16 units across)
  cell: 16, // recipe grid spacing = one node diameter
  maxSpeed: 900, // speed cap, units/s. Stops tunnelling.
  airDamping: 0.02, // fraction of velocity lost per second
  waterDamping: 0.6, // extra velocity loss per second for water particles (viscosity)
  // water as a fluid (double-density relaxation)
  fluidH: 20, // interaction radius
  fluidRest: 2.0, // rest density
  fluidK: 20000, // pressure stiffness
  fluidKNear: 40000, // near-pressure stiffness (keeps particles from stacking)
  fluidViscosity: 0.2, // fraction of relative speed removed per substep between close particles
  fluidCohesion: 0.15, // how far below rest density pressure may pull (surface tension)
  // buoyancy and drag (rule 6)
  wetMargin: 3, // extra reach when counting water neighbours
  wetFull: 6, // water neighbours that count as fully submerged
  waterDensity: 1,
  waterDrag: 4, // velocity loss per second when fully submerged
  // damage (rule 4)
  sharpMinSpeed: 25, // closing speed below which sharp contact does nothing
  sharpScale: 0.02, // damage per (sharpness * units/s) before hardness
  crushMinImpulse: 560, // striker mass * closing speed below which impacts do nothing
  crushScale: 0.02,
  // stickiness (rule 5)
  stickyMaxBonds: 3,
  stickyStrength: 30, // unit weights a single sticky bond holds
  stickyStretch: 0.3,
  // the hand
  handForce: 60, // max pull in unit weights (mass 1 under gravity)
  handReach: 30, // distance at which the pull saturates
  handDamping: 300,
  handTorque: 14, // max angular acceleration, rad/s^2
  handTorqueInertia: 40000, // bodies with more inertia than this turn slower
  // sinew phase offset per bond direction (8 directions around a cell)
  sinewDirPhase: Math.PI / 4,
  pairSlack: 4, // extra broadphase reach, covers acceleration within a step
  groundFriction: 0.8,
  maxNodes: 4096,
  maxBonds: 16384,
};
export type Config = typeof config;
