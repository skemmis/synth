# Findings

Written 2026-11-15. Numbers are from this repository's searches; "widths/s" is atom diameters per second
of simulated time.

## What "a functional cilium" was turned into

**Swim test.** Place a body in open still water, let the rules run for 120 s, and measure how far the
centre of all its atoms travels in the second half. It scores only if every placed atom is still part of
one body, and the score is the worse of two runs in jiggling water. Each elite is then re-run at half the
time step, for three times as long, and in the control water. Because all forces between atoms cancel
and drag only removes motion, sustained travel can only come from a repeating cycle that pushes on the
water.

**Compartments.** Paint atoms and bonds onto a raster and flood-fill the empty space. Any empty region
other than the outside that is big enough to hold a few atoms is a compartment. A cell scores swim speed
times how much compartment survives the run.

**Soup test.** Scatter 200 atoms at random in a wrapped box and measure temperature, clustering, bond
turnover, how long neighbours stay neighbours, compartments, and whether a calm soup releases stored
energy when one atom is struck.

## What worked

1. **Swimmers exist in this physics, and they are small.** Three searches (about 2 million trials) found
   robust swimmers of 4 to 10 atoms built from two atom types. Typical: 2 to 3 beats a second at 2 to 3
   widths/s; the fastest reach 6.6 widths/s by beating about 18 times a second and spending roughly ten
   times the energy.
2. **The mechanism is a kicker, not a bending filament.** One atom makes a short-lived bond to the body;
   the bond stores a kick; when it lets go the two are shoved apart; the light, draggy atom is stopped by
   the water while the heavy body coasts; an ordinary attraction brings the kicker back. That is a
   beating structure with net propulsion, but it is closer to an oar or a jet than to a cilium.
3. **Plain water forbids swimming.** With drag proportional to speed, the drag-weighted centre of any set
   of atoms cannot move, whatever the atoms do. The self-test checks this to 1e-14 over 400 random
   universes, and of 133 validated swimmers, the 55 whose control ran cleanly all stop (fastest control
   0.09 widths/s against 0.3 to 6.6 swimming). The water needs splash or slipstream. Splash gives the
   fastest swimmers; slipstream alone gives up to about 4 widths/s.
4. **A membrane and a motor can share one universe.** With a ring of a two-bond atom type placed by hand,
   the cell search found motors that push the ring at about 4 widths/s while a compartment of 9 to 17
   square widths stays closed. The motor sits inside and shoves the wall, so the ring trails like a bag.
5. **Random soups are mostly calm.** Of 2,205 random universes with bonds, 38% settle into clusters that
   keep making and breaking bonds, 29% into slow clusters, 11% freeze, 10% stay liquid, 8% stay gas, and 2%
   boil. About 5% knit closed compartments unaided, mostly with one or two atom types. More types make
   livelier soups and fewer compartments.
6. **One-sided forces move for free.** Universes without bonds but with forces that are not equal and
   opposite ("particle life") fill with gliding clusters at once (46% of them), and 26% boil. Nothing
   beats and nothing is paid for, so there is nothing to earn. This is a reason to keep forces honest.

## What did not work, or is not there yet

- **No bending cilium.** Atoms have no stiffness between bonds, so a chain is a rope. A filament needs a
  truss two atoms wide, and the search never built one. It needs either a search that rewards elongated
  beating bodies, or one more raw property (resistance to bending).
- **No spontaneous swimmers.** In random soups the count of "moving clusters" matched what jiggling alone
  produces. Swimmers have to be built.
- **The membrane is placed, not grown, and it is floppy.** Nothing holds it round.
- **Fast beats win unless told otherwise.** Ask only for speed and the search returns buzzers. Binning by
  beat rate was needed to keep slow, readable swimmers.

## Mistakes the search exploited (now fixed and tested)

- Kicks were added straight to velocity, which let a body gain a little free momentum per kick in the
  integrator. Kicks now go through the force accumulator.
- Bonds formed in the order atoms were stored, so the same body behaved differently in the viewer and in
  the search. Bonds now form closest-first.
- The first swim test let a body shed atoms and count the recoil. All atoms must now stay attached.
- The speed cap removes momentum. Any run that hits it is discarded, and controls that hit it are not
  counted as evidence.

## Open design questions

- Is a kicker close enough to "cilium" for the game, or should atoms gain bending stiffness so filaments
  can exist?
- Energy currently recharges by itself at each type's rate. For the game, recharge would come from
  pellets, which would make every beat a spend.
- Calm cells and bombs under one rule set: the poke test is written, the survey is not yet analysed.
