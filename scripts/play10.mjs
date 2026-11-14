// Scripted playtest of prototype 10: pocket pieces of the daily crop, check the crop is finite and comes back at dawn.
import { open } from './pw.mjs';
const TREE = 960, BUSH = 2060; const t = await open('10-daily-crop'); const { page } = t;
const near = (mat, x) => page.evaluate(([m, x]) => { const w = game.world; const i = w.nearestNode(x, w.terrain.groundY(x) - 20, 140, (k) => w.mat[k] === m); return i < 0 ? null : [w.x[i], w.y[i]]; }, [mat, x]);
const count = (mat, x) => page.evaluate(([m, x]) => game.world.countIn(m, x - 130, x + 130), [mat, x]);
await page.waitForTimeout(1500);
for (const [name, mat, x] of [['wood', 0, TREE], ['berry', 6, BUSH]]) {
  await page.evaluate((x) => game.centerOn(x), x); await page.waitForTimeout(300); if (name === 'wood') await t.shot('10-crop.png');
  const t0 = Date.now(); let n = 0;
  for (;;) { const p = await near(mat, x); if (!p) break; const [sx, sy] = await t.toScreen(p[0], p[1]); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 30, { steps: 4 }); await page.keyboard.press('x'); await page.mouse.up(); n++; if (n > 40) break; }
  console.log(`${name}: ${n} pieces pocketed in ${((Date.now() - t0) / 1000).toFixed(1)} s, left at source ${await count(mat, x)}, inventory ${JSON.stringify((await page.evaluate(() => state())).inv)}`);
}
await page.click('button.primary:has-text("Sleep")'); await page.waitForFunction(() => state().mode === 'dawn', null, { timeout: 300000 }); await page.waitForTimeout(1500);
console.log('after dawn: wood at tree', await count(0, TREE), 'berries at bush', await count(6, BUSH), 'stash', (await page.evaluate(() => state())).stash, 'errors', t.errors); await t.browser.close();
