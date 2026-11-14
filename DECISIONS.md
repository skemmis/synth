# Decisions log

Each default chosen, each rule added, each gate result. Newest milestone last.
Items marked **NEEDS SAM** were decided to keep the build moving while Sam was away and are easy to reverse.

## Standing notes

- Sam asked (2026-11-14) for continuous iteration through the milestones while away. Gates that need a
  person ("Sam finds it fun") are recorded as *pending* and not treated as blockers; every numeric gate is
  enforced by a headless test in `tests/`.
- One npm package with four folders (`src/sim`, `src/evo`, `src/synth`, `src/game`) instead of four
  workspaces. The dependency rules from the PRD are kept by convention: `sim` imports nothing, `evo`
  imports only `sim`, `synth` has no simulation logic, only `game` touches the DOM.
- Units: one node is 12 world units across. Gravity is 1200 units/s². The view is 640 units tall.

## Milestone 0: physics toy

### Rule added: bending stiffness (`brace`) — NEEDS SAM
The PRD rule list gives a lattice only distance bonds between touching cells. With only those, a
one-cell-thick wooden wall is a chain of hinges: the first bucket (a one-thick U) folded up like rope the
moment the hand touched it. Options were (a) require every rigid thing to be two cells thick, which makes
grids from people and language models fail in an unintuitive way, or (b) give materials bending stiffness.

Chosen: (b), as a new numeric material property `brace` (0..1) in the materials table. Where three cells
sit in a straight line (any of the four lattice axes) and all three have `brace > 0`, the middle one is held
at the midpoint of the other two. Wood, stone and thorn are stiff; pitch and heart slightly; fiber, sinew
and berry not at all. So a fiber or sinew cell between two wooden parts is still a hinge. A brace
disappears when either of the two bonds it runs along breaks. No object type is involved; it is one more
row property and one more solver pass.

### Defaults chosen
- **Solver**: position-based with 8 substeps per 1/60 s step, one pass each of bonds, braces, anchors,
  contacts, terrain. Collision lookup is a hashed uniform grid rebuilt each substep.
- **Water**: unbonded circles of radius 3.6 (jittered ±0.5 so they do not crystallise), frictionless.
  Rule 6 (buoyancy and drag) is applied pairwise between a node and each touching water particle, with an
  equal and opposite push on the water, so a full bucket does not get lighter and no energy is created.
- **Damage**: `sharpness × relative speed × 0.03 − hardness`, or for crushing
  `reduced mass × approach speed × 0.006 − hardness`. A node can be hurt at most once per 0.1 s; without
  that limit a slow rub did the same damage per substep as a swing.
- **Pitch on ground**: a sticky node touching terrain is anchored to that spot by a soft spring that lets
  go past 1.2 units of stretch. Three pitch feet hold against the hand; one pulls free. After letting go a
  node cannot stick again for 0.6 s.
- **The hand** closes on the picked node and the nodes rigidly bonded to it within 26 units (a palm, not a
  pin), which is what lets it hold an object's angle. It does not spread along fiber. Total force is capped
  at the weight of 45 mass units, so a full bucket (about 30) is liftable and a stone block of 20 nodes
  (60) is not.
- **Sinew** keeps twitching after a creature's heart is destroyed (rule 7 has no exception), so corpses
  twitch. Flagged for review at milestone 3.

### Gate results
See the table at the end of this file, regenerated at each milestone.

## Milestone 1: recipes and gathering

### Defaults chosen
- **Gathering** is click or hold on a source: +4 wood, +3 stone, +4 fiber, +2 thorn, +2 pitch per click,
  about four clicks a second. The bush holds 6 berries and regrows one every 25 s (it will regrow at dawn
  once days exist). These numbers are the scarcity lever from "the creativity question"; they sit in
  `src/game/state.ts`.
- **Breaking down**: right-click an object to get its materials back. Not in the PRD; added because without
  it a wrong guess costs a trip back to the sources, which punishes experimenting.
- **Recipe text format**: `# name`, optional `# note:` and `# parent:` lines, then the grid; recipes
  separated by blank lines. If a pasted grid contains dots, spaces are ignored (`W . . W`); if it has no
  dots, spaces are the empty cells.
- **Recipe book** is kept in the browser's local storage; export and import are plain text.
- **Free build** checkbox keeps the milestone 0 toy available.
- **Stash**: 12 loose berries at the home site, counted in the top bar.
