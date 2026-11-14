import type { Recipe } from '../../sim/src/grid.ts';
export interface Turn { role: 'player' | 'synth'; text: string; }
export interface SynthContext {
  message: string; // the player's newest message
  history: Turn[]; // earlier turns
  draft: Recipe | null;
  inventory: Record<string, number>;
  report?: string; // plain-text test bench report for the current draft
  style?: 'literal' | 'inventive';
}
export interface Blueprint { name: string; grid: string[]; note: string; question?: string; }
export type Provider = (ctx: SynthContext) => Promise<Blueprint>;
/** Anything that takes a prompt string and returns the model's text. */
export type AskModel = (prompt: string) => Promise<string>;
