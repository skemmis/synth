# Parts

A building game's physics with named, readable pieces, in the spirit of World of Goo. It follows on from
`../universe`, where the atoms were all numbers and hard for a person to build with. Here the player sees
four atoms and four links; the numbers behind them are hidden in `params.json` and tuned by search.

Open `play/sandbox.html` in a browser. It is one self-contained file.

| piece | what it does |
|---|---|
| Bead | nothing: weight, and something to push water with |
| Jitter | tugs the springs and ropes it holds, a quick pull each beat; jitters fire in the order placed; spends energy |
| Sticky | glues itself to what it touches, up to three things |
| Pellet | loose energy; feeds the jitters of any build that touches it |
| Rod | keeps its length |
| Spring | stretches a long way and pulls back |
| Rope | pulls when taut, slack otherwise |
| Fuse | stiff until stretched a little, then snaps and kicks its ends apart |

Every link keeps the length it was built at. The water has splash and slipstream, because the universe
search showed nothing can swim without one of them.

```bash
node parts/search/try.mjs          # do the hand builds travel? (headless)
node parts/search/tune.mjs 1 5000  # tune hidden numbers so hand builds swim
node parts/search/bomb.mjs         # does a fuse cluster chain-react, and stay quiet when left alone?
node parts/build.mjs --page parts/play/sandbox.html
node parts/playtest.cjs            # scripted browser playtest (run from parts/)
```

## Playtest log

**2026-11-15, first build.**
- With hand-guessed numbers, none of four hand builds swam (0.02 to 0.06 widths/s). Tuning the numbers
  alone only reached 0.1 to 0.25 while the jitter worked by shortening its springs: a soft spring cannot
  make a fast stroke.
- Changing the jitter to a direct tug (strong, brief) with the spring doing the slow return made the
  difference: worm 0.8, tadpole 0.6, rope tadpole 0.6, ladder 0.2 widths/s at 1.7 beats a second.
- The first tuned numbers were too violent: the tug crushed atoms together and broke the worm's middle
  spring in the browser. The tug now fades as a link nears 60% of its length, and tuning rejects any
  numbers under which a build loses a link.
- Scripted browser playtest: all starters run with no errors; a worm built by four clicks crosses about 20
  widths in 8 s; a flick sets off all 12 fuses of the fuse cluster, which stays intact when left alone
  (kick 14; at kick 8 only 3 of 12 went).
- Not good yet: the ladder barely bends, so there is still no real cilium. Nothing steers. The flypaper
  catches the worm only sometimes.
