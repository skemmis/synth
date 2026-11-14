import type { Genome } from './genome.ts';
/**
 * Seed crawlers. Found by a short search on flat ground (scripts/mkseeds.ts) scored on the worst of three
 * slightly different starts, then picked by hand for being different from each other.
 * The last three are berry-eaters: the same search, then the heart tried in every cell and a hill-climb on berries eaten (scripts/eatseeds.ts).
 * Proven to cross flat ground by packages/evo/test/gate3.test.ts.
 */
export const SEEDS: Genome[] = [
 {
  "grid": [
   ".........",
   "....W....",
   "...NH....",
   "..NN.....",
   "....W....",
   ".........",
   "........."
  ],
  "freq": 2.2,
  "cells": {
   "3,2": {
    "phase": 1.38,
    "amp": 0.4
   },
   "2,3": {
    "phase": 3.99,
    "amp": 0.22
   },
   "3,3": {
    "phase": 4.81,
    "amp": 0.27
   }
  },
  "name": "Skipper"
 },
 {
  "grid": [
   "TN.......",
   ".NWN.....",
   "..WN.....",
   ".N.NH....",
   "...F.....",
   ".........",
   "........."
  ],
  "freq": 2.2,
  "cells": {
   "1,0": {
    "phase": 3.25,
    "amp": 0.18
   },
   "1,1": {
    "phase": 3.79,
    "amp": 0.28
   },
   "3,1": {
    "phase": 3.21,
    "amp": 0.28
   },
   "3,2": {
    "phase": 1.84,
    "amp": 0.16
   },
   "1,3": {
    "phase": 5.71,
    "amp": 0.26
   },
   "3,3": {
    "phase": 1.92,
    "amp": 0.2
   }
  },
  "name": "Sprinter"
 },
 {
  "grid": [
   "...FT....",
   "...NP.NW.",
   "....HTN..",
   "...NWS...",
   "....NW...",
   ".....NW..",
   "........."
  ],
  "freq": 2.1,
  "cells": {
   "3,1": {
    "phase": 2.06,
    "amp": 0.3
   },
   "6,1": {
    "phase": 0.62,
    "amp": 0.39
   },
   "6,2": {
    "phase": 3,
    "amp": 0.29
   },
   "3,3": {
    "phase": 0.62,
    "amp": 0.39
   },
   "4,4": {
    "phase": 1.22,
    "amp": 0.27
   },
   "5,5": {
    "phase": 0.62,
    "amp": 0.28
   }
  },
  "name": "Bramble"
 },
 {
  "grid": [
   ".........",
   "..N......",
   "..NN.....",
   ".NWSFF...",
   "..HN.T...",
   ".........",
   "........."
  ],
  "freq": 1.97,
  "cells": {
   "2,1": {
    "phase": 3.95,
    "amp": 0.38
   },
   "2,2": {
    "phase": 4.53,
    "amp": 0.39
   },
   "3,2": {
    "phase": 0.24,
    "amp": 0.36
   },
   "1,3": {
    "phase": 3.13,
    "amp": 0.3
   },
   "3,4": {
    "phase": 0.77,
    "amp": 0.4
   }
  },
  "name": "Nibbler"
 },
 {
  "grid": [
   ".......TF",
   "......TNS",
   "....WWW..",
   "....N.ST.",
   "....W....",
   "...H.....",
   "........."
  ],
  "freq": 2.2,
  "cells": {
   "7,1": {
    "phase": 3.65,
    "amp": 0.4
   },
   "4,3": {
    "phase": 2.17,
    "amp": 0.37
   }
  },
  "name": "Thornback"
 },
 {
  "grid": [
   "HN.......",
   ".NWN.....",
   "..WN.....",
   ".N.N.....",
   "...F.....",
   ".........",
   "........."
  ],
  "freq": 2.2,
  "cells": {
   "1,0": {
    "phase": 3.25,
    "amp": 0.18
   },
   "1,1": {
    "phase": 3.79,
    "amp": 0.28
   },
   "3,1": {
    "phase": 3.21,
    "amp": 0.28
   },
   "3,2": {
    "phase": 1.84,
    "amp": 0.16
   },
   "1,3": {
    "phase": 5.71,
    "amp": 0.26
   },
   "3,3": {
    "phase": 2.45,
    "amp": 0.17
   }
  },
  "name": "Lasher"
 }
];
