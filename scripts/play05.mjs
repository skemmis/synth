// Scripted playtest of prototype 05: sleep through N nights, screenshot the dream, the raid and the dawn report.
import { open } from './pw.mjs';
const nights = +(process.argv[2] ?? 2); const t = await open('05-night-raid'); const { page } = t;
await t.shot('05-day.png');
for (let n = 1; n <= nights; n++) {
  await page.click('button.primary:has-text("Sleep")'); await page.waitForTimeout(4000); if (n === 1) await t.shot('05-night.png');
  await page.waitForFunction(() => state().mode === 'raid', null, { timeout: 180000 }); const txt = await page.textContent('.side section p:last-of-type');
  await page.waitForTimeout(14000); if (n === nights) await t.shot('05-raid.png');
  await page.waitForFunction(() => state().mode === 'dawn', null, { timeout: 120000 });
  const s = await page.evaluate(() => state()); const l = s.log[s.log.length - 1];
  console.log(`night ${n}: best ${Math.round(l.best)}, lost ${l.lost} (eaten ${l.eaten}), party ${l.party.map((p) => `${p.name}/${p.niche} dream ${p.trialAte} raid ${p.ate} ${p.alive ? 'alive' : 'dead'}`).join('; ')}`);
}
console.log(await page.evaluate(() => document.querySelector('.side section p:nth-of-type(2)')?.textContent));
await t.shot('05-dawn.png'); console.log('errors', t.errors); await t.browser.close();
