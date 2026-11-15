# Swim-test speed benchmark

How fast does the swimmer search's inner loop run on a given machine? This directory holds a fixed,
seeded workload and three ways to run it. It only reads `universe/`; it changes nothing there.

**Workload.** 4,000 trials, seed 20261115. Trial *i* is `randomRules` plus `randomOrganism` from one
seeded stream (the way `universe/search/cilia.mjs` draws its first generation), then `swimTest`:
4,000 steps in open still water, 3 to 16 atoms. Generated numbers are rounded to six decimals so every
JavaScript engine builds the same trials (Node 22 and Chrome 153 round `exp`/`log` differently in the
last bit, which otherwise changes 530 of 600 generated trials).

| Run it | Command |
| --- | --- |
| Node, from the repo | `node bench/bench.mjs [trials] [threads]` |
| Node, one file, no repo | `node synth-bench.mjs` (file: `bench/standalone/synth-bench.mjs`) |
| Browser, CPU and WebGPU | open `bench/standalone/synth-bench.html` |

`node bench/build.mjs` rebuilds the two standalone files from the sources.

## Cloud sandbox reference (2026-11-15)

Intel Xeon 2.1 GHz, 4 threads, Node 22.23, no GPU.

| | trials/s |
| --- | --- |
| 1 thread | about 250 (runs: 258, 248, 246) |
| 4 threads | about 965 (runs: 964, 967, 972) |

Checksum of the 4,000 results: `91801d7a`. Node and headless Chrome produce the same checksum.
The same page in headless Chrome on the same machine measured 216 and 766, so a browser number
understates Node by roughly 15 to 20 percent.

## The GPU version

`gpu.js` holds a WGSL compute shader that runs one whole trial per GPU thread, stepping atoms and
bonds in the same order as `universe/sim.js`. Positions come back at the half, three-quarter and end
marks and are scored on the CPU by `snapshotFit`, which repeats the swim test's arithmetic
(`snapshotFit(cpuSnapshots(t))` equals `swimTest(t).fit` exactly; checked on 600 trials).

How it differs from the CPU: 32-bit floats instead of 64-bit. Checked here on Chrome's software
WebGPU adapter (SwiftShader), which tests the logic but is not a GPU speed measurement:

- After 100 steps, positions agree to a median of 1.2e-6 atom widths (worst 9.3e-5) and bond counts
  are equal in all 256 trials checked.
- After the full 4,000 steps, 99.2% of 4,000 trials land in the same class (moving, still, unstable):
  394 movers on the GPU against 387 on the CPU. Of 375 that move on both, 77% score within 10%;
  correlation of scores is 0.85. The dynamics are chaotic, so rounding differences grow.

So a GPU search would be a fast first pass whose finds get re-scored on the CPU. Bond lifetimes are
compared as whole step counts, precomputed in 64-bit, so expiry happens on the same step as the CPU.

Not covered: thermal noise (`T > 0`), which needs a random stream on the GPU; periodic and box
boundaries; bodies over 16 atoms; the swim test's beat and void measures.

One driver gotcha found on the way: a `var` array declared inside the step loop was not re-zeroed on
each pass under SwiftShader, so forces are cleared by hand.
