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
