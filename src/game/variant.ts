// Build-time variants: the same game with one design question answered differently.
//   main   - the proof of concept as specified
//   garden - no raids and no costs: the physics toy with the synthesizer attached
//   tame   - open question 3: the player can build with hearts and make creatures
//   avatar - open question 1: the player has a body that walks, reaches and can be hurt
export type Variant = 'main' | 'garden' | 'tame' | 'avatar';
export const VARIANT = ((import.meta as any).env?.VITE_VARIANT ?? 'main') as Variant;
export const TITLE = { main: 'SYNTH', garden: 'SYNTH · garden', tame: 'SYNTH · tame hearts', avatar: 'SYNTH · with a body' }[VARIANT];
