// Scripted playtest of prototype 08: gather, build a wall from the book, sleep, see the raid, salvage.
import { open } from './pw.mjs'; import { LAYOUT_BUSH, HOME1 } from './layout.mjs';
const t = await open('08-big-beasts'); const { page } = t; const st = () => page.evaluate(() => state());
// gather berries for 5 s
await page.evaluate((x) => game.centerOn(x), LAYOUT_BUSH); await page.waitForTimeout(200);
let [sx, sy] = await t.toScreen(LAYOUT_BUSH, 560); await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(5000); await page.mouse.up();
console.log('after gathering', JSON.stringify((await st()).inv));
// make a wall from the book and place it east of the stash
await page.evaluate((x) => game.centerOn(x), HOME1); await page.waitForTimeout(200);
await page.click('.bookrow:has-text("wall") button.primary'); [sx, sy] = await t.toScreen(HOME1 + 40, 540); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy); await page.waitForTimeout(1500);
await t.shot('08-day.png'); console.log('after wall', JSON.stringify(await st()));
for (let n = 1; n <= 8; n++) {
  await page.click('button.primary:has-text("Sleep")'); await page.waitForFunction(() => state().mode === 'raid', null, { timeout: 240000 });
  await page.waitForTimeout(12000); if (n === 1) await t.shot('08-raid.png');
  await page.waitForFunction(() => state().mode === 'dawn', null, { timeout: 120000 }); const s = await st(); const l = s.log[s.log.length - 1];
  console.log(`night ${n}: ${await page.textContent('.meter + p')} best ${Math.round(l.best)}, lost ${l.lost} (eaten ${l.eaten}), stash ${s.stash}, survived ${s.survived}, over ${s.over}, wrecked ${l.wrecked}hp/${l.pieces} pieces, party ${l.party.map((p) => `${p.name}/${p.niche} dream ${p.trialAte} raid ${p.ate} ${p.alive ? 'alive' : 'dead'}`).join('; ')}`);
}
await t.shot('08-dawn.png'); console.log('ms/step', await page.evaluate(() => game.stepMs.toFixed(2)), 'errors', t.errors); await t.browser.close();
