# Decisions log

Each default chosen, each rule added, each gate result. Newest at the bottom of each section.

## Defaults and deviations from the PRD

- **Prototypes over milestones.** The project instruction is "many small, playable prototypes", and Sam asked for continuous iteration without check-ins. So the milestone gates are run and reported here, but the build does not stop at them. The gates that need Sam ("fun to poke at for ten minutes", "wants a sixth night") are open until Sam plays.
- **Tooling.** TypeScript, esbuild for bundling, Vitest for tests. No Vite dev server: every prototype is bundled to one self-contained HTML file in `play/` so it opens with a double click and can be published as a page.
- **Units.** A node is 16 world units across. Gravity is 900 units/s². Mass 1 is a density-1 node; "unit weight" below means mass 1 under gravity.
- **Bond strength as data.** Each material has `strength` (unit weights a bond holds) and `stretch` (strain at break). Stiffness is derived from the two, so the tensile limit is a real static force.
- **Water is a fluid, not marbles.** Plain colliding circles pile up like sand and a bucket could not scoop them. Water particles use double-density relaxation (Clavet 2005) for pressure, viscosity and a little cohesion. Solids still collide with water as plain circles, so walls hold water with no special case.
- **Buoyancy** is an upward force scaled by how many water particles are near a node, divided by density. Known cheat: it has no reaction force on the water.
- **Damage** needs closing speed: resting contact with thorns does nothing. Crushing needs a heavy, fast impact. Nodes of one body never damage each other. Water and terrain take and deal no damage.
- **The hand** is a spring with a force cap (60 unit weights) on one node. Q and E apply a capped torque about the held node.

## Rules added beyond the PRD's list of eight

- **Rule 9, rigid materials resist bending (needs Sam's yes).** With only distance bonds, a one-node-wide line of wood is a floppy chain, so a U of wood collapsed into a blob and could not be a bucket. Now any straight run of three rigid cells (any of 8 directions) gets a brace that holds the middle node at the midpoint of its neighbours. Fiber and sinew are excluded, so rope, hinges and muscles still fold. It is a general material property (`mode: rigid`), not a per-object case. A brace dies when either bond under it breaks.

## Gate results

### Milestone 0 (physics toy), headless part: PASS

| Check | Result |
| --- | --- |
| Wood bucket, pond to ditch, keeps ≥ 70% of water | scooped 23 particles, arrived with 23 (100%), poured 23 into the ditch |
| Fiber chain hangs and swings as rope | 6 swings through vertical, max stretch 1.3%, hangs within 19 units of plumb |
| Thorn club damages a dummy, wood club does not | thorn: dummy destroyed; wood: 0 damage |
| Pitch sticks a block to the ground | pitch block moved 0.3 units under a shove that slid a plain block 126 |
| Same seed twice gives same hash; clone stays in step | pass |

"Sam finds it fun to poke at for ten minutes" is open.

Headless speed (one thread, 8 substeps): pond of 662 water particles 6.6x real time; 1,078 mixed nodes 4.1x. Below the PRD's 20x target for a 400-node arena; water is the cost.

### Milestone 1 (recipes and gathering): PASS

Every starter recipe exported to text and imported into a fresh world gives an identical state hash after 1.5 simulated seconds.

### Milestone 2 (synthesizer): PASS on the numbers, with caveats

| Provider | Valid grids | Pass physical test |
| --- | --- | --- |
| Offline helper (keyword rules) | 10 / 10 | 9 / 10 (fails ramp) |
| Sonnet, exact game prompt, one shot each, recorded in `packages/synth/fixtures/` | 10 / 10 | 8 / 10 (fails ramp, cage) |

Caveats: the model's net is a copy of the prompt's example; the live call from the published page (the page asks Claude on the viewer's account) has not been run by a person yet; "no hand fixes" holds, but three of the physical tests were adjusted while writing them (net is hung with slack, ramp is tested downhill, lid tub is nudged gently), so treat the count as a first reading.

## More defaults (prototype 3 onward)

- **Model access.** The published page asks Claude through the page's own "ask Claude" capability on the viewer's account. No API key anywhere. A bring-your-own-key provider can be added behind the same `Provider` interface if Sam wants one for the desktop build.
- **Library and cache.** Common requests are answered from a shipped library of model-drawn, bench-checked blueprints; everything else is cached locally by request, draft and report.
- **Crushing damage** uses the striker's own momentum (mass times closing speed) against a threshold, so stone crushes and wood does not.
- **Pitch** holds 30 unit weights per glue bond (was 18), so a two-wide wall with a pitch foot survives a shove.
- **Test bench** is seven fixed measurements, the same for every draft. It never knows what the draft is for.
