const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/11-brood.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r=[];for(let k=0;k<3;k++){t.reset();const t0=performance.now();for(let i=0;i<28800;i++){t.step();if(i%7200==7199){const s=t.stats();r.push([k,i+1,s.n,s.gen,s.births,s.pel,'cross',((s.g[1]+s.g[2])/2).toFixed(2),'same',((s.g[0]+s.g[3])/2).toFixed(2),'base',s.g[10],s.g[11]])}}r.push(Math.round(performance.now()-t0)+'ms')}return r});
console.log(out.map(o=>JSON.stringify(o)).join('\n'),errs);await p.screenshot({path:path.resolve(__dirname,'11-brood.png'),fullPage:true});await b.close()})();
