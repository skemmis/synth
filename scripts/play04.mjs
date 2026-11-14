import { open } from './pw.mjs';
const t = await open('04-creature-pen'); const { page } = t;
for (const b of (await page.$$('.side section:first-child button.primary'))) { await b.click(); await page.waitForTimeout(700); }
await page.waitForTimeout(2500); await t.shot('04-a.png');
await page.waitForTimeout(9000);
const info = await page.evaluate(() => zoo.list.map((c) => ({ name: c.name, x: Math.round(game.world.x[c.heart]), alive: c.alive, ate: c.ate })));
await page.evaluate(() => { const c = zoo.list[0]; game.centerOn(game.world.x[c.heart]); }); await page.waitForTimeout(200); await t.shot('04-b.png');
console.log(info, 'ms/step', await page.evaluate(() => game.stepMs.toFixed(2)), 'errors', t.errors); await t.browser.close();
