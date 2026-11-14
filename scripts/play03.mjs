import { open } from './pw.mjs';
const t = await open('03-synthesizer'); const { page } = t;
const say = async (s) => { await page.fill('#synth-input', s); await page.keyboard.press('Enter'); await page.waitForTimeout(400); };
await say('I need a sword'); await say('The edges need to be lined with something that will kill hamsterbots'); await say('I need to be able to hold it');
await t.shot('03-a.png');
await page.click('.draft button:has-text("Test it")'); await page.waitForTimeout(3000);
await t.shot('03-b.png');
console.log('bench:', await page.evaluate(() => chat.report));
await page.evaluate(() => { gather.inv.T = 20; gather.onChange(); }); await page.click('.draft button.primary'); let [sx, sy] = await t.toScreen(1250, 420); await page.mouse.move(sx, sy, { steps: 5 }); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(800);
// hold by the bottom of the shaft and spin into the dummy
const grip = await page.evaluate(() => { const w = game.world; let b = -1; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.x[i] > 1150 && w.x[i] < 1350 && (b < 0 || w.y[i] > w.y[b])) b = i; return [w.x[b], w.y[b]]; });
[sx, sy] = await t.toScreen(...grip); await page.mouse.move(sx, sy); await page.mouse.down(); [sx, sy] = await t.toScreen(1310, 470); await page.mouse.move(sx, sy, { steps: 20 }); await page.waitForTimeout(500);
await page.keyboard.down('e'); await page.waitForTimeout(900); await page.keyboard.up('e'); await page.keyboard.down('q'); await page.waitForTimeout(900); await page.keyboard.up('q'); await page.keyboard.down('e'); await page.waitForTimeout(900); await page.keyboard.up('e');
await t.shot('03-c.png'); await page.mouse.up();
console.log('inv', await page.evaluate(() => gather.inv), 'damage', await page.evaluate(() => game.world.damageDealt), 'errors', t.errors);
await t.browser.close();
