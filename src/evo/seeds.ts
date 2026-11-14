import type { Genome } from './genome';

/**
 * Hand-kept crawlers that are proven by test to cross flat ground
 * (tests/m3.gate.test.ts). Evolution starts from these plus random variants.
 * They were found by scripts/find-seeds.test.ts and then frozen here.
 */
export const SEEDS: Genome[] = [
  {"grid": [".H.F", "WFN.", "NFN."], "freq": 0.605, "cells": {"2,1": {"phase": -0.529, "amp": 0.32}, "0,2": {"phase": 2.713, "amp": 0.225}, "2,2": {"phase": 5.97, "amp": 0.332}}, "name": "Flea"},
  {"grid": ["SN.N.", "THNNN", ".WFNF", "..W.N", "..W.."], "freq": 2.2, "cells": {"1,0": {"phase": 5.129, "amp": 0.277}, "3,0": {"phase": 1.653, "amp": 0.231}, "2,1": {"phase": 5.422, "amp": 0.161}, "3,1": {"phase": 6.006, "amp": 0.28}, "4,1": {"phase": 0.271, "amp": 0.316}, "3,2": {"phase": -0.26, "amp": 0.298}, "4,3": {"phase": 2.216, "amp": 0.262}}, "name": "Tumbler"},
  {"grid": ["NNHWFS", ".NNPNN"], "freq": 2.065, "cells": {"0,0": {"phase": 0.604, "amp": 0.157}, "1,0": {"phase": 5.717, "amp": 0.299}, "1,1": {"phase": 1.027, "amp": 0.205}, "2,1": {"phase": -0.567, "amp": 0.241}, "4,1": {"phase": 1.131, "amp": 0.285}, "5,1": {"phase": -1.25, "amp": 0.32}}, "name": "Strider"},
  {"grid": ["..N...", "P.HNFF", "TNTTF.", "WF.FW.", "NNSWN."], "freq": 2.19, "cells": {"2,0": {"phase": 3.51, "amp": 0.216}, "3,1": {"phase": 1.387, "amp": 0.267}, "1,2": {"phase": 6.081, "amp": 0.301}, "0,4": {"phase": 1.366, "amp": 0.32}, "1,4": {"phase": 2.947, "amp": 0.318}, "4,4": {"phase": 5.483, "amp": 0.296}}, "name": "Lump"},
];
