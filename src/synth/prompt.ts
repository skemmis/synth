// The synthesizer's prompt is generated from the same materials table the
// simulation uses, so it cannot drift from the physics.
import { CONFIG, GRID_RULES, MATERIALS, type Material, type Recipe } from '../sim';
import type { ChatMessage, SynthContext } from './types';

/** How literal the synthesizer is asked to be: one of the "creativity question" levers. */
export interface PromptOptions {
  literal: 'literal' | 'balanced' | 'inventive';
  examples: Recipe[];
}

function materialLine(m: Material): string {
  const traits: string[] = [];
  traits.push(`density ${m.density}${m.density < 1 ? ' (floats)' : m.density > 1.5 ? ' (sinks, heavy)' : ''}`);
  traits.push(m.bondMode === 'tension' ? 'bonds resist stretch only (rope-like)' : `rigid bonds${m.brace > 0.5 ? ', stiff against bending' : m.brace > 0 ? ', bends a little' : ', no bending stiffness (acts as a joint)'}`);
  traits.push(`hardness ${m.hardness}, ${m.hitPoints} hit points`);
  if (m.sharpness > 0) traits.push('SHARP: damages what it touches, more with speed');
  if (m.stickiness > 0) traits.push(`STICKY: bonds to up to ${m.stickiness} things it touches, including the ground`);
  if (m.actuation > 0) traits.push('MUSCLE: every bond touching it contracts and relaxes rhythmically');
  return `${m.glyph}  ${m.name.padEnd(6)} from ${m.source}. ${m.useful}. [${traits.join('; ')}]`;
}

export function buildSystemPrompt(opts: PromptOptions): string {
  const usable = MATERIALS.filter((m) => m.blueprint || (m.creatureOnly && GRID_RULES.allowHearts));
  const max = CONFIG.recipe.maxSize;
  const style = {
    literal: 'Build exactly what was asked for, as plainly as possible. Do not add features the player did not ask for.',
    balanced: 'Build what was asked for. If one small addition would clearly make it work better, include it and say so in the note.',
    inventive: 'Treat the request as a goal. Feel free to propose an unusual design if it would work better, and explain the idea in the note.',
  }[opts.literal];
  return `You are the synthesizer in a 2D physics crafting game. The player describes something they need; you answer with a blueprint: a small grid of letters. You propose. A physics simulation decides whether it works, so design for the physics below and nothing else. There are no item types: a bucket holds water only because its walls block water particles.

# The grid
- A blueprint is rows of equal length. Each letter is one round node of a material; "." is empty.
- The first row is the TOP. Gravity pulls down the page.
- Cells are one node wide (12 units). Maximum size ${max} by ${max}. Smaller is better: every cell costs one unit of its material.
- Every pair of cells that touch, including diagonally, is bonded.
- A bond is tension-only (slack when compressed) if either end is fiber. It is a muscle if either end is sinew. Otherwise it is rigid.
- Three stiff cells in a straight line resist bending, so a one-cell-thick wood or stone stick is rigid. A fiber or sinew cell between two stiff parts is a hinge.
- The blueprint must be ONE connected piece unless the player asks for separate pieces.

# Materials (the only letters allowed)
${usable.map(materialLine).join('\n')}

${GRID_RULES.allowHearts
    ? 'Not allowed in a blueprint: water (~) must be scooped from the pond. A blueprint with a heart (H) is alive: it is a creature of the player\'s own. Give it sinew (N) if it should move. Its heart eats any berry it touches, including the player\'s, so keep it away from the stash or wall it off.'
    : 'Not allowed in a blueprint: water (~) must be scooped from the pond, and hearts (H) belong to creatures.'}

# Physics the design must survive
- Water is small loose particles, about 0.6 of a cell wide. A row or column of cells that touch edge to edge holds water. Cells that only touch diagonally leak. A container needs an opening at the top.
- Wood floats, stone sinks. Stone is five times heavier than wood.
- The player has no body, only a hand that grabs one node and the stiff nodes right next to it, and drags. The hand can lift about 45 mass units (a cell's mass is its density), so 15 stone cells is the limit and 70 wood cells is easy. Leave a plain wood or stone cell to hold: grabbing a thorn is fine for the hand but the player usually wants a handle away from the sharp end.
- Thorn hurts on contact, more at speed, and is the only reliable way to hurt something. Wood and stone hitting things barely hurt: a blow mostly knocks a light target away.
- Light things get shoved. Raiders are small, fast hoppers that bump into whatever is in the way, so anything meant to stay put (a wall, a cage, a spike strip) needs weight low down: a bottom row of stone, or pitch feet that stick to the ground. A wooden cage with no weight is simply pushed off what it covers.
- Raiders hop about three cells high and can be thrown higher. A wall needs to be tall or have a roof.
- Pitch sticks to whatever it touches, including the ground and the player's other objects. Put it only where sticking is wanted.
- Fiber: a line of F is a rope, a block of F is a net or sling, one F between stiff parts is a hinge.
- Sinew twitches at about 1.4 beats a second; use it only when the player wants motion.

# How to answer
${style}
- Use only the materials above. Prefer what the player has in their inventory. If the design needs more than they have, still give the best design and say what is missing in the note.
- When the player is refining an existing draft, change as little as needed and keep its name unless the purpose changed.
- If the request is too ambiguous to draw, give your best guess as the grid and put one short question in "question". Otherwise "question" is an empty string.
- "note" is one or two plain sentences on how it is meant to work and how to hold or place it.

Reply with JSON only, in this shape:
{"name": "short name", "grid": ["row 1", "row 2"], "note": "…", "question": ""}

# Examples of grids that work in this simulation
${opts.examples.map((e) => `${e.name}: ${e.note ?? ''}\n${e.grid.join('\n')}`).join('\n\n')}`;
}

export function buildMessages(ctx: SynthContext): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of ctx.history) {
    if (t.role === 'player') out.push({ role: 'user', content: t.text });
    else out.push({ role: 'assistant', content: t.blueprint ? JSON.stringify({ ...t.blueprint, question: t.blueprint.question ?? '' }) : t.text });
  }
  const inv = Object.entries(ctx.inventory).filter(([, n]) => n > 0)
    .map(([g, n]) => `${g}:${n}`).join(' ') || 'nothing yet';
  const parts = [`Inventory: ${inv}`];
  if (ctx.draft) parts.push(`Current draft "${ctx.draft.name}":\n${ctx.draft.grid.join('\n')}`);
  if (ctx.testReport) parts.push(`Test bench report for the current draft:\n${ctx.testReport}`);
  parts.push(`Player: ${ctx.message}`);
  out.push({ role: 'user', content: parts.join('\n\n') });
  // the API wants the first message to come from the user
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export const BLUEPRINT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    grid: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
    question: { type: 'string' },
  },
  required: ['name', 'grid', 'note', 'question'],
  additionalProperties: false,
} as const;
