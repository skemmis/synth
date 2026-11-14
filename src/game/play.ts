import { MATERIALS, Mat } from '../sim';
import type { Game } from './game';
import { BUSH_STOCK, GATHER, GATHER_COOLDOWN, Player, makeScenery, sourceAt, spawnStash } from './state';
import type { Scenery } from './render';

/** Gathering, paying for what you place, and breaking things back down. */
export function installPlay(game: Game, player: Player) {
  game.scenery = makeScenery();
  spawnStash(game.world);
  let gathering: Scenery | null = null;
  let nextGather = 0;
  let regrow = 0;

  const gather = (s: Scenery) => {
    const src = GATHER[s.kind];
    const m = MATERIALS.find((mm) => mm.glyph === src.glyph)!;
    if (s.kind === 'bush') {
      if (player.bushStock < 1) { game.float(s.x, game.cursor.y, 'picked clean', '#8a5a4a'); return; }
      player.bushStock--;
    }
    player.add(src.glyph, src.perClick);
    game.float(game.cursor.x, game.cursor.y - 10, `+${src.perClick} ${m.name.toLowerCase()}`, '#3d5a2a');
  };

  game.canPlace = (_g, grid) => {
    const miss = player.missing(grid);
    const names = Object.entries(miss).map(([g, n]) => `${n} ${MATERIALS.find((m) => m.glyph === g)!.name.toLowerCase()}`);
    if (names.length) game.float(game.cursor.x, game.cursor.y - 20, `need ${names.join(', ')}`, '#b8423a');
    return names.length === 0;
  };
  game.onPlace.push((_g, grid) => player.spend(grid));

  game.onClick.push((g, node) => {
    if (node >= 0) return false;
    const s = sourceAt(g.world, g.scenery, g.cursor.x, g.cursor.y);
    if (!s) return false;
    gather(s);
    gathering = s;
    nextGather = g.world.time + GATHER_COOLDOWN * 1.5;
    return true;
  });

  // right-click: break an object back into materials
  game.onRightClick.push((g, node) => {
    if (node < 0) return;
    const w = g.world;
    const parts = w.component(node, false);
    if (parts.some((i) => w.mat[i] === Mat.Heart)) { g.float(w.x[node], w.y[node] - 14, 'it is alive', '#b8423a'); return; }
    const got: Record<string, number> = {};
    for (const i of parts) {
      const m = MATERIALS[w.mat[i]];
      if (!m.blueprint) continue;
      got[m.glyph] = (got[m.glyph] ?? 0) + 1;
    }
    for (const i of parts) w.removeNode(i);
    for (const [gl, n] of Object.entries(got)) player.add(gl, n);
    const text = Object.entries(got).map(([gl, n]) => `+${n} ${MATERIALS.find((m) => m.glyph === gl)!.name.toLowerCase()}`).join('  ');
    g.float(g.cursor.x, g.cursor.y - 12, text, '#3d5a2a');
  });

  game.onStep.push((g) => {
    if (gathering && g.cursor.down) {
      const s = sourceAt(g.world, g.scenery, g.cursor.x, g.cursor.y);
      if (s === gathering && g.world.time >= nextGather) { gather(s); nextGather = g.world.time + GATHER_COOLDOWN; }
    } else gathering = null;
    // the bush slowly regrows
    regrow += 1 / 60;
    if (regrow > 25) { regrow = 0; if (player.bushStock < BUSH_STOCK) player.bushStock++; }
  });

  game.onFrame.push((g) => {
    g.label = null;
    for (const s of g.scenery) if (s.kind === 'bush') s.stock = player.bushStock;
    if (!g.cursor.inside || g.ghost || g.world.hand.active) return;
    if (g.world.nodeAt(g.cursor.x, g.cursor.y) >= 0) return;
    const s = sourceAt(g.world, g.scenery, g.cursor.x, g.cursor.y);
    if (s) {
      const src = GATHER[s.kind];
      const m = MATERIALS.find((mm) => mm.glyph === src.glyph)!;
      g.label = { x: g.cursor.x, y: g.cursor.y, text: `${src.label}: click or hold to gather ${m.name.toLowerCase()}` };
    }
  });
}
