import { open } from './pw.mjs';
const t = await open('02-gather-and-craft'); const { page } = t;
await page.waitForTimeout(800);
// gather wood by holding on the tree for 4 seconds
let [sx, sy] = await t.toScreen(1000, 500); await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(4000); await page.mouse.up();
console.log('inv after tree', await page.evaluate(() => gather.inv));
await t.shot('02-a.png');
// make the bucket from the book
await page.click('.bookrow button.primary'); 
[sx, sy] = await t.toScreen(1150, 450); await page.mouse.move(sx, sy, { steps: 10 }); await t.shot('02-b.png'); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(1200);
console.log('inv after make', await page.evaluate(() => gather.inv), 'nodes', await page.evaluate(() => { let n = 0; for (let i = 0; i < game.world.n; i++) if (game.world.alive[i] && game.world.mat[i] === 0) n++; return n; }));
// take apart with X while holding
const p = await page.evaluate(() => { const w = game.world; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === 0) return [w.x[i], w.y[i]]; });
[sx, sy] = await t.toScreen(...p); await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(200); await page.keyboard.press('x'); await page.mouse.up();
console.log('inv after dismantle', await page.evaluate(() => gather.inv));
// export / import roundtrip via the book object
console.log('import', await page.evaluate(() => { const t = book.exportText(); const n = book.entries.length; book.entries = []; const r = book.importText(t); return [n, r.added, r.errors]; }));
await t.shot('02-c.png'); console.log('errors', t.errors);
await t.browser.close();
