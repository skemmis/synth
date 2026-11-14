// Build-time variants: the same game with one design question answered differently.
//   main   - the proof of concept as specified
//   garden - no raids and no costs: the physics toy with the synthesizer attached
//   tame   - open question 3: the player can build with hearts and make creatures
export type Variant = 'main' | 'garden' | 'tame';
export const VARIANT = ((import.meta as any).env?.VITE_VARIANT ?? 'main') as Variant;
export const TITLE = { main: 'SYNTH', garden: 'SYNTH · garden', tame: 'SYNTH · tame hearts' }[VARIANT];
