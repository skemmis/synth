// Builds the two things a person can run without this repository:
//   standalone/synth-bench.html  one self-contained page (CPU and WebGPU)
//   standalone/synth-bench.mjs   one self-contained Node script (CPU)
// Usage: node bench/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const strip = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  .replace(/^import .* from '\.{1,2}\/.*';\s*$/gm, '')
  .replace(/^export \{[^}]*\};\s*$/gm, '')
  .replace(/^export /gm, '');
const core = ['universe/sim.js', 'universe/rules.js', 'universe/metrics.js', 'bench/workload.js'].map(strip).join('\n');
const lib = `const SB = (() => {\n${core}\n${strip('bench/gpu.js')}\nreturn { makeTrials, runTrial, checksum, summarize, cpuSnapshots, snapshotFit, WGSL, gpuRun, compareFits, SEED, STEPS, CLOUD };\n})();`;
if (lib.includes('</script')) throw new Error('library text would close its script tag');
const frag = fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*__LIB__*/', () => lib);
fs.mkdirSync(path.join(here, 'standalone'), { recursive: true });
fs.mkdirSync(path.join(root, '.artifact'), { recursive: true });
fs.writeFileSync(path.join(root, '.artifact/synth-bench.html'), frag);
fs.writeFileSync(path.join(here, 'standalone/synth-bench.html'),
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<style>body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head><body>\n${frag}\n</body></html>\n`);
const node = fs.readFileSync(path.join(here, 'bench.mjs'), 'utf8').replace(/^import .* from '\.\/workload\.js';\s*$/m, () => core);
fs.writeFileSync(path.join(here, 'standalone/synth-bench.mjs'), node);
console.log('built standalone/synth-bench.html', (frag.length / 1024).toFixed(0) + ' KB', 'and standalone/synth-bench.mjs');
