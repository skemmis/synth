// Scripted playtest of prototype 11: X fails at the source; one log by hand; then a pail of logs hauled home.
import { open } from './pw.mjs';
const TREE = 960, HOME = 2700; const t = await open('11-haul-it-home'); const { page } = t;
const inv = async () => (await page.evaluate(() => state())).inv.W;
const nearWood = (x, r = 140) => page.evaluate(([x, r]) => { const w = game.world; const i = w.nearestNode(x, w.terrain.groundY(x) - 20, r, (k) => w.mat[k] === 0 && w.bodyNodes(k).length === 3); return i < 0 ? null : [w.x[i], w.y[i]]; }, [x, r]);
// carry: grab at world point, walk the mouse so the camera scrolls with it, end at world x
async function carry(from, toX, toY, speed = 9) {
  let [sx, sy] = await t.toScreen(from[0], from[1]); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 60, { steps: 6 });
  for (let k = 0; k < 400; k++) { const hx = await page.evaluate(() => game.world.hand.active ? game.world.x[game.world.hand.node] : null); if (hx === null) return false; if (Math.abs(hx - toX) < 30) break;
    const edge = toX > hx ? 1180 * 0.71 : 60; await page.mouse.move(edge, 300 + (k % 2), { steps: 2 }); await page.waitForTimeout(speed * 10); }
  const [ex, ey] = await t.toScreen(toX, toY); await page.mouse.move(ex, ey, { steps: 8 }); await page.waitForTimeout(300); return true;
}
await page.waitForTimeout(1500); await page.evaluate((x) => game.centerOn(x), TREE); await page.waitForTimeout(300);
const w0 = await inv(); let p = await nearWood(TREE); let [sx, sy] = await t.toScreen(p[0], p[1]); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 30, { steps: 4 }); await page.keyboard.press('x'); await page.waitForTimeout(200); await page.mouse.up();
console.log('X at the tree: wood', w0, '->', await inv());
let t0 = Date.now(); p = await nearWood(TREE); let ok = await carry(p, HOME, 520); await page.keyboard.press('x'); await page.mouse.up(); console.log('one log by hand:', ok, 'wood ->', await inv(), `in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// a pail by the tree, three logs dropped in, hauled home by its handle
await page.evaluate((x) => game.centerOn(x), TREE + 150); await page.waitForTimeout(300);
await page.click('.bookrow:has-text("pail") button.primary'); const PX = TREE + 230; [sx, sy] = await t.toScreen(PX, 470); await page.mouse.click(sx, sy); await page.waitForTimeout(1500);
for (let k = 0; k < 3; k++) { p = await nearWood(TREE, 160); if (!p) break; [sx, sy] = await t.toScreen(p[0], p[1]); await page.mouse.move(sx, sy); await page.mouse.down(); const [dx, dy] = await t.toScreen(PX, 430); await page.mouse.move(dx, dy, { steps: 25 }); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(700); }
await t.shot('11-pail.png');
const handle = await page.evaluate((x) => { const w = game.world; let best = -1; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === 2 && Math.abs(w.x[i] - x) < 60 && (best < 0 || w.y[i] < w.y[best])) best = i; return [w.x[best], w.y[best]]; }, PX);
t0 = Date.now(); ok = await carry(handle, HOME, 470, 14); await page.waitForTimeout(800); await t.shot('11-home.png'); await page.mouse.up(); await page.waitForTimeout(800);
const arrived = await page.evaluate(() => { const w = game.world; let n = 0; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === 0 && w.x[i] > 2460 && w.x[i] < 3390 && w.bodyNodes(i).length === 3) n++; return n / 3; });
console.log('pail haul:', ok, 'logs that reached home', arrived, `in ${((Date.now() - t0) / 1000).toFixed(1)} s`, 'errors', t.errors); await t.browser.close();
