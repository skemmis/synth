# Universe

A separate line of work from the rest of this repository. It asks whether a world of atoms with only a few
raw properties can produce the things a game needs (something that swims, something that holds an inside
apart from an outside) without any of that being written in. Nothing here uses the PRD's materials, grid,
fluid or raids.

Open `play/specimens.html` in a browser to watch and poke the finds. It is one self-contained file.

## The laws

Atoms are unit discs floating in still water, off any grid. A rule set (a "universe") is plain JSON:

| | properties |
|---|---|
| each atom type | mass, drag, how many bonds it can hold, how fast it recharges energy |
| each pair of types | push or pull strength, and its reach |
| each pair of types | bond rule: can they bond, at what distance, rest length, stiffness, how far it stretches before tearing, how long it lasts, how hard it kicks the two apart when it breaks |
| the water | plain drag, splash (drag that grows with speed), slipstream (neighbours shield each other's drag), jiggle (temperature) |

Energy is conserved. A bond that snaps shut from a distance, or stores a kick, is paid for from the two
atoms' energy stores, and atoms recharge at their type's rate. All forces between atoms are equal and
opposite, so the only way to travel is to push on the water.

A body is nothing but a placement of atoms. Which bonds form is up to the rules.

## Run it

```bash
node universe/search/selftest.mjs                       # determinism and the conservation law
node universe/search/cilia.mjs 1 100000 universe/results/cilia-1.json   # swimmer search, seed 1
node universe/search/report.mjs universe/results/swimmers.json universe/results/cilia-1.json
node universe/search/cell.mjs 1 40000 universe/results/cell-1.json universe/results/swimmers.json
node universe/search/soup.mjs 1 1000 universe/results/soup-1.jsonl      # random soup survey
node universe/search/pick.mjs                           # (from universe/) build gallery/presets.json
node universe/viewer/build.mjs universe/gallery/presets.json universe/play/specimens.html --page "Universe Specimens"
```

Every search is seeded. The same seed gives the same result on any machine, because the step uses only
add, subtract, multiply, divide and square root.

See `FINDINGS.md` for what was tried and what worked.
