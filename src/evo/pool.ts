import type { World } from '../sim';
import type { Genome } from './genome';
import { EVO_CONFIG, runTrial, type TrialResult } from './trial';

export interface Pool {
  readonly size: number;
  /** resolves once every worker holds the arena; rejects if workers cannot be used */
  setArena(arena: World): Promise<void>;
  /** results come back in the same order as the genomes, whatever order they finish in */
  run(genomes: Genome[], seconds?: number): Promise<TrialResult[]>;
  dispose(): void;
}

/** Trials on web workers. */
export class WorkerPool implements Pool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { id: number; genome: Genome; seconds: number }[] = [];
  private waiting = new Map<number, { resolve: (r: TrialResult) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private ready: (() => void) | null = null;
  private readyCount = 0;
  private failed: ((e: Error) => void) | null = null;

  constructor(make: () => Worker, readonly size: number) {
    for (let i = 0; i < size; i++) {
      const w = make();
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { if (++this.readyCount >= this.size) this.ready?.(); return; }
        if (m.type !== 'result') return;
        this.waiting.get(m.id)?.resolve(m.result);
        this.waiting.delete(m.id);
        this.idle.push(w);
        this.pump();
      };
      w.onerror = (e) => this.fail(new Error(`worker failed: ${e.message || 'could not start'}`));
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  private fail(err: Error) {
    this.failed?.(err);
    for (const p of this.waiting.values()) p.reject(err);
    this.waiting.clear();
    this.queue = [];
  }

  setArena(arena: World): Promise<void> {
    const snap = arena.snapshot();
    this.readyCount = 0;
    return new Promise<void>((resolve, reject) => {
      // some sandboxes refuse workers without raising an error, so do not wait forever
      const timer = setTimeout(() => reject(new Error('workers did not answer')), 4000);
      this.ready = () => { clearTimeout(timer); resolve(); };
      this.failed = (e) => { clearTimeout(timer); reject(e); };
      for (const w of this.workers) w.postMessage({ type: 'arena', snap, width: arena.terrain.width, h: arena.terrain.h });
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const job = this.queue.shift()!;
      this.idle.pop()!.postMessage({ type: 'trial', ...job });
    }
  }

  run(genomes: Genome[], seconds = EVO_CONFIG.trialSeconds): Promise<TrialResult[]> {
    const jobs = genomes.map((genome) => new Promise<TrialResult>((resolve, reject) => {
      const id = this.nextId++;
      this.waiting.set(id, { resolve, reject });
      this.queue.push({ id, genome, seconds });
    }));
    this.pump();
    return Promise.all(jobs);
  }

  dispose() { for (const w of this.workers) w.terminate(); this.workers = []; }
}

/** Trials on the calling thread, yielding between them. Used in tests and where workers are unavailable. */
export class LocalPool implements Pool {
  readonly size = 1;
  private arena: World | null = null;
  constructor(private pause: () => Promise<void> = () => Promise.resolve()) {}
  setArena(arena: World) { this.arena = arena; return Promise.resolve(); }
  async run(genomes: Genome[], seconds = EVO_CONFIG.trialSeconds): Promise<TrialResult[]> {
    const out: TrialResult[] = [];
    for (const g of genomes) { out.push(runTrial(this.arena!, g, seconds)); await this.pause(); }
    return out;
  }
  dispose() { /* nothing to free */ }
}
