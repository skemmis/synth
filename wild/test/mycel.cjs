const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/07-mycel.html'));await p.waitForFunction(()=>!!window.__t);
const C=(process.argv[2]||'6000,.5,.3,700').split(',').map(Number);const idle=await p.evaluate((C)=>{const t=window.__t,r=[];t.cfg(...C);t.reset();const t0=performance.now();for(let i=0;i<3600;i++){t.step();if(i%400==399)r.push(t.stats().n)}return{r,st:t.stats(),ms:Math.round(performance.now()-t0)}},C);
console.log('idle',JSON.stringify(idle));await p.screenshot({path:path.resolve(__dirname,'07-mycel-idle.png')});
const led=await p.evaluate((C)=>{const t=window.__t,r=[];t.cfg(...C);t.reset();t.reset();for(let i=0;i<3600;i++){if(i%240==0){const c=t.centroid();const ps=t.pel();if(c&&ps.length){let far=ps.filter(q=>q.amt>100).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));const q=far[Math.min(1,far.length-1)];if(q)t.line(c.x,c.y,q.x,q.y)}}t.step();if(i%400==399)r.push(t.stats().n)}return{r,st:t.stats()}},C);
console.log('led',JSON.stringify(led),errs);await p.screenshot({path:path.resolve(__dirname,'07-mycel.png')});await b.close()})();
