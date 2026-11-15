// CPU benchmark for the swim-test workload.
// Usage: node bench/bench.mjs [trials] [threads]
//   trials  default 4000
//   threads default: every core. The one-thread number is always measured too.
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { makeTrials, runTrial, checksum, summarize, SEED, CLOUD } from './workload.js';

if (!isMainThread) {
  const trials = makeTrials(workerData.count);
  for (let i = 0; i < 30; i++) runTrial(trials[i]); // warm up the JIT
  parentPort.on('message', ([a, b]) => {
    const out = new Float64Array(b - a);
    for (let i = a; i < b; i++) out[i - a] = runTrial(trials[i]);
    parentPort.postMessage({ a, out });
  });
  parentPort.postMessage('ready');
} else {
  const count = +process.argv[2] || 4000;
  const threads = +process.argv[3] || os.availableParallelism?.() || os.cpus().length;
  const self = fileURLToPath(import.meta.url);

  const single = () => {
    const trials = makeTrials(count), fits = new Float64Array(count);
    for (let i = 0; i < Math.min(200, count); i++) runTrial(trials[i]); // warm up the JIT
    const t0 = performance.now();
    for (let i = 0; i < count; i++) fits[i] = runTrial(trials[i]);
    return { fits, sec: (performance.now() - t0) / 1000 };
  };

  const multi = (nt) => new Promise((resolve, reject) => {
    const fits = new Float64Array(count), CH = 25;
    let next = 0, done = 0, ready = 0, t0 = 0;
    const ws = [];
    const give = (w) => { if (next < count) { const a = next; next = Math.min(count, a + CH); w.postMessage([a, next]); } };
    for (let k = 0; k < nt; k++) {
      const w = new Worker(self, { workerData: { count } });
      ws.push(w);
      w.on('error', reject);
      w.on('message', (m) => {
        if (m === 'ready') { if (++ready === nt) { t0 = performance.now(); ws.forEach(give); } return; }
        fits.set(m.out, m.a); done += m.out.length;
        if (done === count) { const sec = (performance.now() - t0) / 1000; ws.forEach(x => x.terminate()); resolve({ fits, sec }); }
        else give(w);
      });
    }
  });

  const cpu = os.cpus()[0]?.model || 'unknown CPU';
  console.log(`Swim-test benchmark: ${count} trials, seed ${SEED}`);
  console.log(`Machine: ${cpu}, ${threads} threads, ${process.platform} ${process.arch}, Node ${process.version}`);
  const s = single();
  const sum = checksum(s.fits), info = summarize(s.fits);
  console.log(`1 thread : ${(count / s.sec).toFixed(0)} trials/s  (${s.sec.toFixed(2)} s)`);
  const m = await multi(threads);
  console.log(`${threads} threads: ${(count / m.sec).toFixed(0)} trials/s  (${m.sec.toFixed(2)} s)`);
  const same = checksum(m.fits) === sum;
  console.log(`Results  : ${info.moving} moving, ${info.still} still, ${info.unstable} unstable, best fit ${info.bestFit.toFixed(5)}`);
  console.log(`Checksum : ${sum}${same ? '' : '  (threads disagree: ' + checksum(m.fits) + ')'}` +
    (count === CLOUD.trials ? (sum === CLOUD.checksum ? '  matches the cloud run' : '  DIFFERS from the cloud run (' + CLOUD.checksum + ')') : ''));
  console.log(`Cloud sandbox for comparison: ${CLOUD.single} trials/s on 1 thread, ${CLOUD.multi} on ${CLOUD.threads}.` +
    ` This machine: ${(count / s.sec / CLOUD.single).toFixed(1)}x per thread, ${(count / m.sec / CLOUD.multi).toFixed(1)}x overall.`);
}
