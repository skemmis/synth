// Turn the single-file Vite build into a page fragment for publishing:
//   node scripts/artifact.cjs "<Title>" builds/<name>.html
// (no doctype/html/head/body; title and style first, then markup, then the script)
const fs = require('fs');
const [title, out] = process.argv.slice(2);
const html = fs.readFileSync('dist/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
const page = `<title>${title}</title>\n<style>\n${styles}\n</style>\n${body}\n${scripts.map((s) => `<script type="module">${s}</script>`).join('\n')}\n`;
fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + ' KB');
