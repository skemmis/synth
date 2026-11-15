const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/06-gulp.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r=[];
 // greedy bot: chase nearest pellet for 60 s
 for(let i=0;i<3600;i++){const s=t.stats();const ps=t.pel();if(ps.length&&i%10==0){let b=ps[0],bd=1e9;for(const q of ps){const d=(q.x-s.x)**2+(q.y-s.y)**2;if(d<bd){bd=d;b=q}}t.setTarget(b.x,b.y)}t.step();if(i%600==599)r.push(t.stats())}
 return r});
console.log(out.map(o=>JSON.stringify(o)).join('\n'),errs);await p.screenshot({path:path.resolve(__dirname,'06-gulp.png')});
const gaps=await p.evaluate(()=>{const t=window.__t,r=[];for(const A of [2827,5000,8000])for(const g of [50,36,26,18])r.push({A,...t.gapTest(g,A)});return r});
console.log(gaps.map(o=>JSON.stringify(o)).join('\n'));await p.screenshot({path:path.resolve(__dirname,'06-gulp-gap.png')});await b.close()})();
