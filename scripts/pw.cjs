// Shared Playwright helpers for playtest scripts.
const { chromium } = require('playwright');
exports.open = async (url = 'http://localhost:5173/', size = { width: 1280, height: 720 }) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__game);
  // world -> screen
  const toScreen = (x, y) => page.evaluate(([x, y]) => {
    const g = window.__game, r = g.canvas.getBoundingClientRect(), dpr = g.canvas.width / r.width;
    return [(x - g.cam.x) * g.cam.scale / dpr + r.left, (y - g.cam.y) * g.cam.scale / dpr + r.top];
  }, [x, y]);
  const moveTo = async (x, y, steps = 20) => { const [sx, sy] = await toScreen(x, y); await page.mouse.move(sx, sy, { steps }); };
  return { browser, page, errors, toScreen, moveTo };
};
