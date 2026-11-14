import { open } from './pw.mjs';
const t = await open('01-physics-toy');
const { page } = t;
await page.waitForTimeout(1500); await t.shot('01-a.png');
// find the bucket's top post node and carry it into the pond
const post = await page.evaluate(() => { const w = game.world; let best = -1; for (let i = 0; i < w.n; i++) if (w.alive[i] && w.mat[i] === 0 && w.x[i] > 800 && w.x[i] < 920 && (best < 0 || w.y[i] < w.y[best])) best = i; return [w.x[best], w.y[best]]; });
await t.dragWorld([post, [700, 480], [600, 640]], 40, 2500);
await t.shot('01-b.png');
const [sx, sy] = await t.toScreen(620, 430); await page.mouse.move(sx, sy, { steps: 60 }); await page.waitForTimeout(1500);
await t.shot('01-c.png');
const held = await page.evaluate(() => { const w = game.world; const ns = w.bodyNodes(w.hand.node); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const i of ns) { x0 = Math.min(x0, w.x[i]); x1 = Math.max(x1, w.x[i]); y0 = Math.min(y0, w.y[i]); y1 = Math.max(y1, w.y[i]); } return { water: w.countIn(8, x0, x1, y0, y1), ms: game.stepMs, fps: game.fps }; });
console.log('in bucket', held, 'errors', t.errors);
await page.mouse.up();
await t.browser.close();
