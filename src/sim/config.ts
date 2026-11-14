// Every tunable number that is not a material property lives here.

export const CONFIG = {
  dt: 1 / 60,
  substeps: 8,
  gravity: 1200,
  /** fraction of velocity lost per second to air */
  airDamping: 0.25,
  /** world units per second; keeps fast things from tunnelling */
  maxSpeed: 1300,

  world: { width: 4200, height: 900 },
  hash: { cell: 13, tableBits: 13 },

  hand: {
    stiffness: 1600,
    damping: 80,
    /** the hand also holds nodes bonded to the picked one within this distance */
    gripRadius: 26,
    /** mass units x acceleration. gravity*N lifts N mass units. */
    maxForce: 1200 * 45,
    rotateSpeed: 2.6,
    pickRadius: 14,
  },

  damage: {
    /** damage = sharpness * speed * sharpScale - hardness */
    sharpScale: 0.03,
    /** damage = reducedMass * approachSpeed * crushScale - hardness */
    crushScale: 0.006,
    /** contacts slower than this never hurt */
    minSpeed: 10,
    /** a node can be hurt at most once per this many seconds */
    cooldown: 0.1,
  },

  sticky: {
    /** seconds before a node that lost a sticky bond may stick again */
    cooldown: 0.6,
    /** ground anchors: pull-back per pass, and stretch at which they let go */
    anchorStiffness: 0.08,
    anchorBreak: 1.2,
  },

  water: {
    radiusJitter: 0.5,
    /** water-solid pairs closer than (r1+r2)*range exchange buoyancy and drag */
    range: 1.25,
    /** number of touching water particles that count as fully submerged */
    fullContacts: 8,
    /** per second velocity exchange between a node and touching water */
    drag: 3.0,
  },

  sinew: { frequency: 1.4 },

  recipe: { maxSize: 16 },
} as const;

export type Config = typeof CONFIG;
