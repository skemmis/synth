# wild/ : eight toys cribbed from prior art

Started 2026-11-15. Sam asked for a wide range of genuinely different things to play with, cribbed from existing
simulations, rather than more variants of his own suggestions. Nothing here shares code with `universe/`, `parts/`
or the older PRD prototypes. Plain JS, no dependencies.

- `src/NN-name.html` is the source of each toy (a page fragment). `shared.css` and `shared.js` are pasted in by the build.
- `node wild/build.mjs` writes `play/NN-name.html` (open it in a browser, runs on its own) and `frag/NN-name.html` (what gets published).
- `node wild/test/thumbs.cjs && node wild/gallery.mjs` rebuilds the gallery (`play/index.html`, `frag/00-gallery.html`) from `gallery.json`.
- `node wild/test/all.cjs` loads every build at desktop and phone width, steps it and fails on any error or overflow.
- Each toy exposes `window.__t` (`step()`, `stats()`, plus a few hooks) so playtests can be scripted. The scripts are in `test/`.

Gallery: https://claude.ai/artifact/Kzh4XfTS9fcLXSS6xTfjcm

| # | Name | Cribbed from | Published |
|---|------|--------------|-----------|
| 01 | Motley | Particle Life | https://claude.ai/artifact/Es7humxnDj5nFnYNWWoQcn |
| 02 | Bloomfield | Gray-Scott reaction-diffusion | https://claude.ai/artifact/UqobtTZb2bU7QURx1KY2RV |
| 03 | Wirehead | Braitenberg vehicles, Bibites breeding | https://claude.ai/artifact/GvHMiPpv1DQpJaTrR46fSj |
| 04 | Gaitkeeper | Sodarace, Karl Sims | https://claude.ai/artifact/U6R3BSYN2VxcZJTnK5kVX6 |
| 05 | Cinderpit | falling sand, Noita | https://claude.ai/artifact/RN4z3X1sC1qpjLM9Ybn4Eh |
| 06 | Gulp | pressure soft bodies, Spore cell stage | https://claude.ai/artifact/UkGx1iWj4V9zgRZnh7HAds |
| 07 | Mycel | Physarum | https://claude.ai/artifact/FzPo4YC4jkB8MU3ZPFBFvB |
| 08 | Sprout | Cell Lab, Karl Sims | https://claude.ai/artifact/YM4pczR1N6WTBh477pcY5e |
| 09 | Twitch | 06 Gulp crossed with 03 Wirehead | https://claude.ai/artifact/KMyfuvEMFECz2YLho6gu2m |
| 10 | Pitdiver | 06 Gulp crossed with 05 Cinderpit | https://claude.ai/artifact/ELm6hV3vF1tZ4i9eFNeSr8 |
| 11 | Brood | The Bibites, with 03's swimmers | https://claude.ai/artifact/WiLheDo1fTrX45eU89DdVk |

To republish one, publish `frag/NN-name.html` to its URL above.

## Playtest log (scripted, headless; no person has played these yet)

**01 Motley.** First version let every colour smell pellets. A table with appetite on every colour cracked 2,463 pellets
in 25 s against 0 to 826 for random tables, so structure did not matter. Changed: only pale motes smell pellets and they
cannot crack them; cracking needs three coloured motes. Now blank scores 0, "everyone follows pale" 237, random tables
0 to 176, wide spread. Worked: live editing, the stir. Unknown: whether a person can read a 5x5 table.

**02 Bloomfield.** Feed 0.030 / kill 0.062 was meant to be quiet but spots divided and filled the dish. Scanned 24
pairs; 0.030 / 0.065 holds spots perfectly still (mass constant over 600 frames). Feed paint adds 0.008 to feed and takes
0.004 off kill; spots then bud along a painted line and reach a pellet a third of the dish away in about 15 s. Worked:
the look, the budding. Weak: slow, and little to decide.

**03 Wirehead.** Pellet smell first saturated at both antennae (range too long), so crossed wires barely helped
(18 vs 9 for drifting). Shortened the smell range: drifting 9, crossed seeker 27, seeker with poison veer 30, seeker with
a pulse on one cilium 38, bred 81. Poison as a brake is worse than no poison wires (8). The bred wiring idles lopsided
(1.0 and 0.5) so it spirals when it smells nothing. Worked: the gap between drawn and bred.

**04 Gaitkeeper.** Untrained Tripod 16, bred 408 to 495 over three runs; Caterpillar 14, bred 145 to 208. Breeding
30 generations of 30 takes 0.5 to 0.9 s. Worked: instant payoff. Risk: close to what the parts sandbox already is.

**05 Cinderpit.** Scripted run: sparks on moss freed 36 of 287 pellets (plug and sand hopper), flooding from the top
then floated out the two cups (129 home). The powder keg fuse stopped 4 grains short of the powder; lengthened. Flooding
the oil cup pushes the oil out over the rim and the pellets follow. Moss fills any flooded chamber within a minute.

**06 Gulp.** Gap test, cell pushed at a slot between two rocks: girth 60 passes 36 but not 26; girth 80 passes 36
slowly; girth 101 passes 50 but not 36. A greedy bot clears caves but leaks constantly on urchins. Worked: squeeze,
size trade-off. Unknown: whether spit feels good by hand.

**07 Mycel.** First economy: colony peaked in 6 s and every speck died at once. Changes: specks only feed when
hungry, pellets hold 6,000 feeds, deaths are spread out, and the heart buds one speck every 3 ticks so it cannot go
extinct. At medium life (400 ticks) idle average is about 1,190 specks and a script that draws a lure line to the
second-nearest pellet every 4 s averages about 2,100. Still strongly boom and bust.

**08 Sprout.** A sitting mouth starves, and bodies that swam into a wall stuck there, so the dish now wraps and tails
wobble. Tadpole filled the dish (160 cells) in 6 of 6 runs; Solar skiff stays at 3 to 6 cells; Leaf raft makes one
128-cell sheet; a lone mouth survives without growing; "ribbon" (a mouth that keeps budding tails) dies because the tails
oppose each other.

**09 Twitch.** Soft cell, four patches (nose + cilia tuft), 40 wires. First pass: raw pellet smell saturated on all four
noses, all tufts fired inward and crushed the cell in place; an urchin contact was counted per bead per substep, so one
snag scored −280. Changes: pellet noses fire on contrast (own smell minus the mean of the four), stings count once per
tick, one point per second. Test dish, 40 s: blank 0, same-side wiring −2.5, opposite-side seeker 32.5, seeker plus
urchin fear 35.1, bred (8 generations of 14, 3.5 s) 43.4. A slow pulse does not help. Fixed size, no growth yet.

**10 Pitdiver.** Soft cell (20 beads) in the grain world; beads are blocked by stone, sand, moss and bangdust and pass
through liquids. Squirting costs juice (starts 60, pellets refill). Scripted: swim around a ledge, sit under the moss plug,
40 ticks of sparks; the plug burned, 33 pellets fell into the cell, no damage. A straight-line bot sticks under ledges.
Not yet tested: blasts, acid, popping, flooding from inside.

**11 Brood.** Swimmers split at energy 1.5 with each wire miscopied 25% of the time. Three ponds from random wiring,
8 minutes of sim each (0.9 s to compute): mean crossed pellet wires went 0.00 to 0.37, 0.30 to 0.38, −0.01 to 0.34;
same-side wires stayed near 0; family depth 17 to 26; population 20 to 35 of a 110 cap, limited by rain. Poison wires
showed no clear trend.

## Ideas proposed to Sam (see gallery.json `next`)

Wired cell (06 + 03), Cell in the pit (06 + 05), Grown machines (08 + parts sandbox), Bigger brains, Living pond,
Species hunt. Not built: Lenia / neural CA, Avida.
