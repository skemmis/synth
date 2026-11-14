// Scripted playtest of prototype 09: play a night, reload the page, check the game came back, play another night.
import { open } from './pw.mjs'; import { LAYOUT_BUSH, HOME1 } from './layout.mjs';
const t = await open('09-saved-games'); const { page } = t; const st = () => page.evaluate(() => { const s = state(); return { mode: s.mode, day: s.day, nights: s.log.length, stash: s.stash, inv: s.inv, survived: s.survived, archive: s.archive, light: s.light }; });
await page.evaluate((x) => game.centerOn(x), LAYOUT_BUSH); await page.waitForTimeout(200);
let [sx, sy] = await t.toScreen(LAYOUT_BUSH, 560); await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
await page.evaluate((x) => game.centerOn(x), HOME1); await page.waitForTimeout(200);
await page.click('.bookrow:has-text("wall") button.primary'); [sx, sy] = await t.toScreen(HOME1 + 40, 540); await page.mouse.click(sx, sy); await page.waitForTimeout(1200);
await page.click('button.primary:has-text("Sleep")'); await page.waitForFunction(() => state().mode === 'dawn', null, { timeout: 300000 }); await page.waitForTimeout(500);
const before = await st(); const nodes = await page.evaluate(() => game.world.count(0) + '/' + game.world.count(8)); console.log('before reload', JSON.stringify(before), 'wood/water', nodes, '|', await page.textContent('.side section p:last-of-type'));
await page.reload(); await page.waitForTimeout(1200);
const after = await st(); console.log('after reload ', JSON.stringify(after), 'wood/water', await page.evaluate(() => game.world.count(0) + '/' + game.world.count(8)), '|', await page.textContent('.side section p:last-of-type'));
await t.shot('09-loaded.png');
await page.click('button.primary:has-text("Sleep")'); await page.waitForFunction(() => state().mode === 'dawn' && state().log.length === 2, null, { timeout: 300000 });
const s2 = await st(); console.log('second night ', JSON.stringify(s2)); console.log('errors', t.errors); await t.browser.close();
