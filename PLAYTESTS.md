# Prototypes and playtest notes

Every prototype is one self-contained file in `play/`. Open it with a double click; nothing to install.
To rebuild: `npm install && npm run build`. Tests: `npm test`.

Playtests here are Claude driving the real page in a headless browser (mouse drags, key presses, screenshots) plus the headless scenario numbers. They say whether things work and read clearly. They cannot say whether it is fun; that needs Sam.

## 01 Physics toy (`play/01-physics-toy.html`)

PRD milestone 0. The strip world, all seven solid materials, water, the hand, and recipes pasted as letter grids. No AI, no enemies, no costs.

**What worked**
- Scooping is real. Pushing the bucket under the pond by its centre post and lifting brought up 24 to 30 water particles, and they stayed in on the carry. The headless gate keeps 100% from pond to ditch.
- Water reads as water once it became a fluid: level surface, fills what you dunk, pours when you tip with Q/E.
- The uneven load tilts the bucket in the hand, so carrying takes a little care. That felt like the right kind of fiddly.
- Rope, pitch and thorns each do the one thing their row in the table says, with no extra code.

**What did not, and what changed**
- First water was colliding circles. It piled like sand, kept craters, and a bucket pushed it aside instead of filling. Replaced with a small fluid solver.
- A one-node-wide wooden U folded into a blob. Wood needed to resist bending, which is a new rule (DECISIONS.md, rule 9).
- A bucket with a rope handle cannot be pushed under water, because rope cannot push. It floats. That is correct and a nice discovery, so it stays as the "pail" recipe, and the default bucket got a rigid centre post instead.
- You cannot swing a club by dragging it: held by one point, the head trails behind the hand like a flail. Spinning with Q/E is the swing. Worth a hint in the UI; later maybe a two-point grip.

**Open**
- Thorn damage is strong (a thorn club deletes a wooden dummy in three swings). Tune once creatures exist.
- Headless speed is 4 to 7x real time with lots of water, short of the 20x target.

## 02 Gather and craft (`play/02-gather-and-craft.html`)

PRD milestone 1. Six sources to gather from, an inventory, costs, a recipe book saved in the browser, the grid editor, and export and import as text.

**What worked**
- Hold-to-gather (about five units a second) is quick enough that cost is a constraint, not a chore: 4 seconds on the tree pays for a bucket.
- Taking an object apart with X gives every node back. That makes trying a design nearly free, which matters more for creativity than the gathering does.
- The book shows what each recipe is short of, in the material's colour, so "go and get 12 fiber" needs no reading.
- Gate: every starter recipe exported to text and re-imported into a fresh world gives the same state hash after 1.5 simulated seconds.

**What did not**
- Gathering is the least interesting thing on screen. It is a click-and-wait with no physics in it. Idea for a later variant: sources are physical (a tree is a tall wood lattice you break pieces off).
- Nothing yet makes material scarce, so there is no reason to design small.

## 03 Synthesizer (`play/03-synthesizer.html`)

PRD milestone 2. A conversation panel that turns requests into letter-grid drafts, a test bench that reports what the draft does, and Synthesize to build it. Two helpers: an offline one (keyword rules, no model) and Claude. Claude is reachable when the page is opened on claude.ai; it asks on the viewer's own account, so no API key is needed. Opened as a local file, only the offline helper is available.

**How model use is kept light**
- The ten scripted requests are answered from a saved library (drawn by a Claude model once, kept only if they passed their physical test). No call is made.
- Every other answer is cached in the browser by request text, draft and bench report.
- The panel says where each answer came from and counts live calls.

**What worked**
- The PRD's own conversation plays through offline: "I need a sword", "line the edges with something that kills hamsterbots", "I need to be able to hold it" gives a blade, then thorns on the edges, then a bare shaft clear of the thorns.
- Cost shows up as a real constraint the moment thorns enter: the thorned sword needs 13 thorn and the starter kit has 10, so the draft sits there with a red chip until you gather or ask for something smaller.
- The test bench is the best thing in this prototype. Same seven measurements for any draft (set down, pour water, shove, float, hold by the middle, drop a block, spin into a post), written as plain sentences. It told me the first thorned sword "did no damage" when spun, which was a bug in the bench's post placement, and it tells the model the same things on the next turn.
- Gate, live model: Sonnet given the exact game prompt for the ten scripted requests returned 10 of 10 valid grids and 8 of 10 passed their physical test (gate is 9 and 6). Offline helper: 10 valid, 9 pass.

**What did not**
- Ramps do not work as ramps. A grid wedge is a staircase of round nodes, single nodes cannot roll, and a ball set on the high end sits in the first notch. Both the model and the offline helper fail this one. A plank the player tilts with Q/E is the real ramp in this world.
- A sheet of fiber is not a net. Fiber nodes are as fat as any other and get in each other's way, so a filled fiber grid is a stiff slab. A zigzag (diagonal links only) sags and caught 6 of 6 dropped nodes. The model copied that zigzag from the prompt's examples, so its net result is not independent evidence.
- For "a cage to keep my berries in" the model drew an open-topped box and said so. Valid, honest, and not a cage. The literal style may be too literal about cost.
- A 13-node sword is too long for the hand: it droops and drags on the ground. Nothing tells the player that before they pay for it. The bench should probably report "the hand can barely lift it".
- Live Claude from the published page has not been exercised: it needs a person to open the page and allow it. The recorded-answer test covers the prompt and validation, not the page's call.

**Creativity levers now exposed for playtests**: Literal or Inventive style (one switch), editing the draft's letters by hand, and the bench report feeding the next turn.
