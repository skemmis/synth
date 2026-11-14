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

## 04 Creature pen (`play/04-creature-pen.html`)

PRD milestone 3. Six seed crawlers to release at the burrow, a mutant button, an inspector, a grid editor for your own creature with a beat slider, things to put in the way, and salvage (X on a dead body gives up its sinew).

**What worked**
- Creatures made only of nodes, bonds and pulsing sinew do walk, and they look alive: Skipper is six cells and hops, Sprinter gallops.
- In the scripted run all six crossed to home and Nibbler ate 6 of 9 loose berries.
- Dragging a live creature by a leg and dropping it on its back is the most fun thing in the prototype. It keeps pulsing and sometimes rights itself.
- Runs at 0.14 ms a step with six creatures out.

**What did not**
- Hand-drawn creatures almost never walk. The editor gives every muscle the same strength and a phase from its position, which is a guess. Walking needs search, not drawing; the editor is a toy for now.
- Walkers bred only for distance cannot eat: heart in the middle, berries pushed ahead of the chest. See the decisions log.
- Nothing shows why a creature died.

## 05 Night raid (`play/05-night-raid.html`)

PRD milestone 4. Day: free defences and your own grid designs. Sleep: 100, 200 or 400 trials against a copy of the base at dusk, while the view follows the current champion's attempt. Then the best of three niches come from the burrow one at a time. Dawn: survivors leave, the dead stay, and a report shows each raider's grid, its parent, what it ate in its dream and in the raid.

**What worked**
- The loop reads at a glance: sky goes dark, a meter fills in 9 to 16 seconds, the sky goes dusk-red and things come out of the hole.
- Watching the champion's dream is a real tell. You see the thing that will come, and how it gets in, before it comes.
- Raid report with names and parents ("Brukusk, medium thorny, bred from Thornback") makes the arms race legible.
- Scripted three-night run: night one's top raider ate 1 in its dream and 1 in the raid.

**What did not**
- Raids are weak more often than not. In the three-night run only the first raid took a berry. After a raid the wall is shoved against the stash and that jam is a better defence than the wall was.
- The score bar falls when the base changes, which reads as the creatures getting worse. It should be drawn against what the base was.
- Sleeping twice without touching anything is the best strategy so far. There is no cost to waiting and no reason to rebuild.
- The party is three cousins, so one defence answers all of them.

## 06 Day and night (`play/06-day-and-night.html`)

PRD milestone 5, first pass. Pond, sources, home with nine berries, burrow. Daylight is a 100 second clock; night falls when it runs out or when you press Sleep. Inventory and costs, the synthesizer (offline helper, or Claude when opened on claude.ai), a recipe book, the night and raid from 05, salvage with X.

**What worked**
- All the parts run together in one page without special wiring: the same hand gathers, places, fights and salvages.
- The clock makes gathering a choice. Five seconds at the bush is 26 berries and a twentieth of the day.
- Scripted run: gather, make the book's wall (10 wood, 2 pitch), place it between stash and burrow, sleep twice. Both nights took about 21 s with the pond in the world.

**What did not**
- One book wall wins the game. It is six nodes tall with a pitch foot; nothing bred in two nights got past it or even damaged it (best scores 278 and 225, which is "walked up to the wall"). The raiders then die or stall in front of it and their bodies add to the barricade.
- So there is no arms race yet. The night needs to be stronger or the wall weaker before anything else in the loop matters.
- No save. Reloading the page starts over (the recipe book alone persists).
- Nothing tells the player the stash is the score, or what a good day looks like.
- The main world runs at 2.3 ms a step with the pond in it. Fine at 60 a second, no headroom for fast-forward.

## 07 Siege (`play/07-siege.html`)

Prototype 06 with one lever: raiders are also scored on the hit points they take off what you built (4 points per hit point). A switch in the Night panel turns it off, which gives 06's raiders back.

**What worked**
- The wall now wears. Scripted run, same book wall as 06: the first raid took 110 hit points and 3 pieces off it, the second 28, the third 4. Headless, five nights, three seeds: the wall went from 340 hit points to 46, 175 and 275.
- Damage shows as darkened nodes and stays until you take the thing apart and rebuild it, so the morning has a job: look at what was chewed and decide whether to spend light on it.
- The raid report says what the defences lost.
- A raider now does in the raid exactly what it did in its dream, to the last digit, even with the pond in the world (`scripts/fidelity.ts`). Before this version it did not, and that was most of why raids looked random. Two fixes, both in the decisions log.

**What did not**
- No berry was eaten in any of these runs. Wearing a wall down is slower than a player rebuilds it, so this is pressure, not yet a threat.
- Wrecking and eating pull against each other. A body covered in thorns chews wood well and tramples the berries when it gets to them.
- Attrition differs a lot by seed (46 to 275 hit points left after five nights). One player gets a siege and the next gets a quiet week.
- Taking a damaged wall apart gives back every surviving piece at full value, so repair costs only light. Probably right for now; it makes daylight the currency.

## 08 Big beasts (`play/08-big-beasts.html`)

Siege (07) with four changes: raiders may grow to 40 cells instead of 26; raids last up to a minute; whatever is left of dead raiders is gone by the next nightfall; the header counts mornings survived and the game ends, with a summary, the morning the stash is empty.

**What worked**
- Headless, one recipe-book wall and nobody repairing it: the wall fell and all nine berries were lost on night 6, 7 and 7 across three seeds. Two walls back to back were still half standing after eight nights. That is the first version where "how much do I build" has an answer that is neither "nothing" nor "one wall".
- Bodies lasting one day turns salvage into a choice against the clock. In 07 the dead piled up in front of the wall and became a better barricade than the wall: by the third night raiders could not reach it.
- Size alone gets a creature over. With wrecking switched off and 40 cells allowed, one raider in eight nights got past the intact six-high wall and ate two berries, in its dream and again in the raid.
- In the browser the first raid took 124 hit points and 4 pieces off the wall.

**What did not**
- The same browser run then stalled for seven nights with the stash untouched. What was left of the wall was its pitch foot, and raiders that touched it stuck to it. Pitch on the ground is flypaper, and nothing bred learned to avoid or chew it. This is a real defence the player can find, and also a hole in the night.
- Berries are lost by trampling, not eating. The wreckers are thorny; when the wall goes they roll over the stash and burst it. The report says so, but "eaten 0, trampled 9" reads oddly for creatures that are supposed to be hungry.
- Results swing a lot between a headless run and a browser run of what should be the same game, because the wall lands a pixel differently. Each run is repeatable; the game as a whole is not predictable.
- The ending has not been reached in a scripted run (the script never loses its stash), so the summary card is untested beyond opening it by hand in code.

## 09 Saved games (`play/09-saved-games.html`)

Big beasts (08) plus a save file in the browser: the world, the burrow's stock and history, inventory, daylight and score. It saves at every dawn, when you leave the page by day, and on a button. Start over clears it.

**What worked**
- Scripted run: gather, build a wall, sleep through a raid, reload the page. Day, daylight, inventory, stash, raid report, the 16 kinds in the burrow and every node in the world (7 wood, 662 water) came back, and a second night then ran normally and bred a 17th kind.
- A loaded world carries on step for step as the original would have (test in `packages/sim/test/gate0.test.ts`).
- The file is small: about 150 KB with the pond in it.

**What did not**
- A night or a raid in progress is not saved. Close the page then and you return to the last dawn or the last daytime save.
- The save lives in one browser. There is no export, so it cannot move between machines yet. The recipe book has text export; the world does not.
- Dead raiders lose their names on reload (the bodies are there and can be salvaged; the labels are gone).

## 10 Daily crop (`play/10-daily-crop.html`)

Saved games (09) with gathering changed. Click-and-wait is gone. Each dawn every source drops loose pieces on the ground (a day's crop: 24 wood, 8 stone, 12 fiber, 8 thorn, 6 pitch, 12 berries). Pick one up, press X, and it is in your pocket. A source keeps at most two days' worth. You start with much less (12 wood, 6 fiber, 2 pitch).

**What worked**
- Materials are finite for the first time. A recipe-book wall is 10 wood and 2 pitch: nearly half the day's wood and a third of its pitch. "Design small" now has a reason.
- The crop is made of the same nodes as everything else, so it rolls. Logs dropped on the slope by the pond end up floating in it.
- Scripted run: 8 logs pocketed for 24 wood, 6 berry pairs for 12 berries; all of it back the next dawn.
- With no wall built, the first raid emptied the stash (9 berries) and the ending card came up. That is the first scripted run to reach it.

**What did not**
- The script pockets a whole tree's crop in under a second. A person will be slower, but grab-and-X is still quick; the limit is the crop, not the clock. Daylight may no longer matter in this variant.
- Pocketing works anywhere, so nothing has to be carried home. Hauling (a cart, a raft across the pond) would be the physical version; it is not tried here.
- First attempt scattered the logs at random angles, some inside each other, and they burst into single nodes on spawn. Now laid out in rows.
- Pitch pieces glue themselves to the ground where they land. You can still pick them up; it looks odd.
