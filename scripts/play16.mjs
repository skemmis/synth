// Scripted playtest of prototype 16: walk the guide's six goals in order and report when each one ticks.
import { open } from './pw.mjs'; import { LAYOUT_BUSH, HOME1 } from './layout.mjs';
const t = await open('16-first-days'); const { page } = t; const st = () => page.evaluate(() => state());
const goals = async (when) => { await page.waitForTimeout(700); const s = await st(); console.log(when.padEnd(26), Object.keys(s.goals).filter((k) => s.goals[k]).join(', ') || 'none', '| now:', await page.textContent('.goals li.now b').catch(() => 'all done')); };
await goals('at the start'); await t.shot('16-start.png');
await page.click('.goals li.now button'); await page.waitForTimeout(300); // Show me: pans to the tree
let c = await page.evaluate(() => game.cam.x); console.log('Show me panned the camera to', Math.round(c));
await page.evaluate((x) => game.centerOn(x), LAYOUT_BUSH); await page.waitForTimeout(200);
let [sx, sy] = await t.toScreen(LAYOUT_BUSH, 560); await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up(); await goals('after gathering');
await page.evaluate((x) => game.centerOn(x), HOME1); await page.waitForTimeout(200);
await page.click('.bookrow:has-text("thorn wall") button.primary'); [sx, sy] = await t.toScreen(HOME1 + 40, 540); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy); await page.waitForTimeout(1500); await goals('after a thorn wall');
const dead = () => page.evaluate(() => { const w = cycle.real; const live = new Set(); for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] >= 1000 && w.mat[i] === 7) live.add(w.tag[i]); for (let i = 0; i < w.n; i++) if (w.alive[i] && w.tag[i] >= 1000 && !live.has(w.tag[i])) return [w.x[i], w.y[i]]; return null; });
let salvaged = false;
for (let n = 1; n <= 6; n++) {
  if ((await st()).over) break;
  await page.waitForTimeout(15000); await page.click('button.primary:has-text("Sleep")'); await page.waitForFunction(() => state().mode === 'raid', null, { timeout: 240000 }); await page.waitForFunction(() => state().mode === 'dawn', null, { timeout: 240000 });
  const s = await st(); const l = s.log[s.log.length - 1]; console.log(`night ${n}: wrecked ${l.wrecked}hp, lost ${l.lost}, stash ${s.stash}, dead ${l.party.filter((p) => !p.alive).length}`); await goals(`after night ${n}`);
  if (!salvaged) { const p = await dead(); if (p) { await page.evaluate((x) => game.centerOn(x), p[0]); await page.waitForTimeout(300); [sx, sy] = await t.toScreen(p[0], p[1]); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 30, { steps: 4 }); await page.keyboard.press('x'); await page.mouse.up(); salvaged = true; await goals('after salvage'); } }
  if (n === 1) { await page.fill('#synth-input', 'Build me a wall to keep things out'); await page.keyboard.press('Enter'); await page.waitForTimeout(800); await page.click('button.primary:has-text("Synthesize")'); await page.evaluate((x) => game.centerOn(x), HOME1); await page.waitForTimeout(200); [sx, sy] = await t.toScreen(HOME1 + 120, 540); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy); await goals('after asking'); await t.shot('16-mid.png'); }
  if ((await st()).goals.three) break;
}
await t.shot('16-end.png'); console.log('note:', await page.textContent('.goals + p'), '| errors', t.errors); await t.browser.close();
