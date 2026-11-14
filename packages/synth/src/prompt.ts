// The prompt is generated from the same materials file the simulation reads, so it cannot drift from the physics.
import { MATERIALS } from '../../sim/src/materials.ts';
import { config } from '../../sim/src/config.ts';
import { MAX_GRID } from '../../sim/src/grid.ts';
import { RECIPES } from '../../sim/src/recipes.ts';
import type { SynthContext } from './types.ts';

export function materialsTable(inv: Record<string, number>): string {
  const rows = MATERIALS.filter((m) => m.inBlueprint && (m.glyph !== 'N' || (inv.N ?? 0) > 0)).map((m) => {
    const bits = [`density ${m.density} (${m.density < config.waterDensity ? 'floats' : 'sinks'})`, m.mode === 'tension' ? 'bonds resist stretch only, so it folds freely' : 'rigid bonds, resists bending',
      `a bond holds about ${m.strength} unit weights`, `hardness ${m.hardness}`, `${m.hp} hit points`];
    if (m.sharpness) bits.push('SHARP: damages what it hits, more at speed');
    if (m.stickiness) bits.push(`STICKY: glues itself to anything it touches, the ground included (each glue bond holds about ${config.stickyStrength} unit weights)`);
    if (m.actuation) bits.push('MUSCLE: bonds touching it shorten and lengthen in rhythm');
    return `${m.glyph} = ${m.name}. ${m.blurb}. ${bits.join('; ')}.`;
  });
  return rows.join('\n');
}
const ex = (k: string) => `${RECIPES[k].name}:\n${RECIPES[k].grid.join('\n')}\n(${RECIPES[k].note ?? ''})`;

export function buildPrompt(ctx: SynthContext): string {
  const inv = Object.entries(ctx.inventory).filter(([, n]) => n > 0).map(([g, n]) => `${g}:${n}`).join(' ') || 'nothing yet';
  const style = ctx.style === 'inventive'
    ? 'Be inventive: if there is a cleverer or stranger way to do what they ask with these materials, use it and say why in the note.'
    : 'Be literal: build what the player described, as simply as it can be built. Do not add features they did not ask for. If their idea has a flaw, build it anyway and mention the flaw in the note so they can decide.';
  return `You are the synthesizer in a 2D side-view physics crafting game. The player describes a need; you answer with a blueprint, a small grid of letters. You only propose. A physics simulation decides whether it works, so never claim that it will.

HOW A BLUEPRINT BECOMES AN OBJECT
- Each letter is one round node 16 units across. "." is empty. Row 1 is the top; gravity pulls toward the last row.
- Every pair of cells that touch, diagonals included, is bonded. Nothing else holds an object together.
- A bond is rope-like if either end is fiber, a muscle if either end is sinew, otherwise rigid, with the weaker material's strength.
- Three rigid cells in a straight line stay straight. A line of fiber is a rope; one fiber cell between rigid parts is a hinge.
- Water is small loose drops, about half a node wide. Any unbroken line of touching cells holds water, so a container needs a floor and two walls and an open top. Water cannot be in a blueprint.
- The player is a hand that grabs ONE node and pulls with limited strength (it can lift about ${Math.round(config.handForce / 0.6)} wood nodes or ${Math.round(config.handForce / 3)} stone nodes). Q and E spin the held object around the grabbed node. Rope cannot push, only pull.
- Sharp nodes hurt whatever they hit, including whatever is holding them, so leave bare cells to grab.
- The grid is at most ${MAX_GRID} by ${MAX_GRID}. It must be one connected piece. Every letter costs one unit of that material, so smaller is better.

MATERIALS
${materialsTable(ctx.inventory)}

EXAMPLES OF THE FORMAT (not a list of allowed objects; anything that follows the rules above is allowed)
${['bucket', 'rope', 'thornClub', 'wall', 'net'].map(ex).join('\n\n')}

STYLE
${style}
Use only materials listed above. Prefer what the player already has, and if the design needs something they lack, say what and how many in the note.
If the request is too vague to draw, still give your best small guess and put one short question in "question".
If there is a current draft and the player is asking for a change, change that draft; keep what they did not mention.

THE PLAYER HAS: ${inv}
${ctx.draft ? `\nCURRENT DRAFT ("${ctx.draft.name}"):\n${ctx.draft.grid.join('\n')}\n` : '\nThere is no draft yet.\n'}${ctx.report ? `\nTEST BENCH REPORT FOR THE CURRENT DRAFT (measured by the simulation):\n${ctx.report}\n` : ''}${ctx.history.length ? `\nCONVERSATION SO FAR\n${ctx.history.slice(-8).map((t) => `${t.role === 'player' ? 'Player' : 'You'}: ${t.text}`).join('\n')}\n` : ''}
PLAYER: ${ctx.message}

Answer with one JSON object and nothing else:
{"name": "short name", "grid": ["row 1", "row 2", "..."], "note": "one or two plain sentences on how it is meant to work", "question": "optional, only if you need to ask"}
All rows must be the same length. Use only the letters ${MATERIALS.filter((m) => m.inBlueprint && (m.glyph !== 'N' || (ctx.inventory.N ?? 0) > 0)).map((m) => m.glyph).join(' ')} and "."`;
}
