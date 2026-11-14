import { CONFIG, World, makeTerrain, type Recipe, type WorldSnapshot } from '../sim';
import type { EvolverState } from '../evo';
import type { Game } from './game';
import type { Player } from './state';

const SAVE_KEY = 'synth.save.v2';

export interface SaveFile {
  v: 1;
  seed: number;
  day: number;
  world: WorldSnapshot;
  inventory: Record<string, number>;
  book: Recipe[];
  bushStock: number;
  population: EvolverState;
}

const plain = (_k: string, v: unknown) => (ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v);

/** One JSON document per world. The API key is not part of it. */
export function makeSave(game: Game, player: Player, population: EvolverState): string {
  const s: SaveFile = {
    v: 1, seed: game.seed, day: player.day, world: game.world.snapshot(),
    inventory: { ...player.inventory }, book: player.book, bushStock: player.bushStock, population,
  };
  return JSON.stringify(s, plain);
}

export function applySave(text: string, game: Game, player: Player): EvolverState {
  const s = JSON.parse(text) as SaveFile;
  if (s.v !== 1 || !s.world) throw new Error('not a Synth save file');
  game.seed = s.seed;
  game.world = World.restore(s.world, makeTerrain(CONFIG.world.width, s.seed));
  game.ghost = null;
  player.day = s.day;
  player.inventory = { ...player.inventory, ...s.inventory };
  player.book = s.book;
  player.bushStock = s.bushStock;
  return s.population;
}

export function storeSave(text: string): boolean {
  try { localStorage.setItem(SAVE_KEY, text); return true; } catch { return false; }
}
export function readSave(): string | null {
  try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
